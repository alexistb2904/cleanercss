import * as vscode from 'vscode';
import * as path from 'path';
import { getCleanerCSSConfig } from '../config/configuration';
import { cleanStylesheet } from '../core/cleaner';
import type { CleanerCommandContext } from './commandContext';
import { showStrongConfirmation } from '../vscode/notifications';
import { withCleanerProgress } from '../vscode/progress';
import { relativePathFor } from '../vscode/historyTreeProvider';
import { cleanCurrentFile } from './cleanCurrentFile';

type WorkspaceCleanupMode = 'review' | 'applyAll';

interface WorkspaceCleanupCandidate {
  uri: vscode.Uri;
  filePath: string;
  originalText: string;
  cleanedText: string;
  deletionRatio: number;
  report: ReturnType<typeof cleanStylesheet>['report'];
}

export async function cleanWorkspace(ctx: CleanerCommandContext, mode: WorkspaceCleanupMode = 'review'): Promise<void> {
  const config = getCleanerCSSConfig();
  const exclude = `{${[...config.excludeGlobs, ...config.ignoreFiles].join(',')}}`;
  const styleFiles = await vscode.workspace.findFiles('**/*.{css,scss}', exclude, 1000);
  if (styleFiles.length === 0) {
    await vscode.window.showInformationMessage('CleanerCSS found no CSS or SCSS files in this workspace.');
    return;
  }

  const usageIndex = await withCleanerProgress('CleanerCSS: scanning workspace', (progress, token) => ctx.scanner.scan(config, progress, token));
  const candidates: WorkspaceCleanupCandidate[] = [];

  await withCleanerProgress('CleanerCSS: analyzing stylesheets', async (progress) => {
    for (const uri of styleFiles) {
      try {
        const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
        const result = cleanStylesheet({ text, filePath: uri.fsPath, isScss: uri.fsPath.endsWith('.scss'), usageIndex, config });
        if (result.hasChanges) {
          candidates.push({
            uri,
            filePath: uri.fsPath,
            originalText: result.originalText,
            cleanedText: result.cleanedText,
            deletionRatio: result.deletionRatio,
            report: result.report
          });
        }
        progress.report({ message: vscode.workspace.asRelativePath(uri) });
      } catch {
        // ignored; individual file warnings appear in normal scans
      }
    }
  });

  if (candidates.length === 0) {
    await vscode.window.showInformationMessage('CleanerCSS found no safe workspace cleanup candidates.');
    return;
  }

  if (mode === 'applyAll') {
    await applyAllWithoutReview(ctx, candidates, config);
    return;
  }

  const pickedMode = await vscode.window.showQuickPick([
    {
      label: 'Review files one by one',
      description: 'Preview each file before applying cleanup',
      detail: `Inspect ${candidates.length} candidate file(s) with the native diff view.`,
      mode: 'review' as const
    },
    {
      label: 'Clean All Without Review',
      description: 'Apply all safe workspace cleanup candidates immediately',
      detail: `CleanerCSS will clean ${candidates.length} file(s) without opening review previews.`,
      mode: 'applyAll' as const
    }
  ], {
    title: 'CleanerCSS Workspace Cleanup',
    placeHolder: 'Choose how to apply workspace cleanup.'
  });

  if (!pickedMode) return;
  if (pickedMode.mode === 'applyAll') {
    await applyAllWithoutReview(ctx, candidates, config);
    return;
  }

  const picked = await vscode.window.showQuickPick(candidates.map(candidate => ({
    label: path.basename(candidate.filePath),
    description: vscode.workspace.asRelativePath(candidate.uri),
    detail: `${candidate.report.proposedRemovals} full removal(s), ${candidate.report.proposedPartialRemovals} partial cleanup(s), ${candidate.report.uncertainBranches} uncertain branch(es)`,
    uri: candidate.uri
  })), { title: 'CleanerCSS Workspace Cleanup', placeHolder: 'Choose a file to preview and clean.' });
  if (!picked) return;

  const startIndex = candidates.findIndex(candidate => candidate.uri.toString() === picked.uri.toString());
  if (startIndex < 0) return;

  for (let index = startIndex; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const doc = await vscode.workspace.openTextDocument(candidate.uri);
    await vscode.window.showTextDocument(doc, { preview: false });

    const outcome = await cleanCurrentFile(ctx, { silent: true });
    if (outcome === 'noEditor') {
      break;
    }
  }
}

async function applyAllWithoutReview(ctx: CleanerCommandContext, candidates: WorkspaceCleanupCandidate[], config: ReturnType<typeof getCleanerCSSConfig>): Promise<void> {
  const riskyCandidates = candidates.filter(candidate => candidate.deletionRatio >= config.maxDeletionRatioBeforeStrongConfirmation);
  if (riskyCandidates.length > 0) {
    const message = riskyCandidates.length === 1
      ? `CleanerCSS proposes deleting ${(riskyCandidates[0].deletionRatio * 100).toFixed(1)}% of ${vscode.workspace.asRelativePath(riskyCandidates[0].uri)}. Apply all workspace changes anyway?`
      : `CleanerCSS proposes large deletions in ${riskyCandidates.length} file(s). Apply all workspace changes anyway?`;
    const ok = await showStrongConfirmation(message);
    if (!ok) return;
  }

  const failures: string[] = [];

  await withCleanerProgress('CleanerCSS: applying workspace cleanup', async (progress) => {
    for (const candidate of candidates) {
      progress.report({ message: vscode.workspace.asRelativePath(candidate.uri) });
      try {
        await applyCleanupCandidate(ctx, candidate);
      } catch (error) {
        failures.push(`${vscode.workspace.asRelativePath(candidate.uri)}: ${String(error)}`);
      }
    }
  });

  ctx.historyTreeProvider.refresh();

  if (failures.length > 0) {
    await vscode.window.showWarningMessage(`CleanerCSS applied workspace cleanup with ${failures.length} failure(s).`);
    return;
  }

  await vscode.window.showInformationMessage(`CleanerCSS applied workspace cleanup to ${candidates.length} file(s) without review.`);
}

async function applyCleanupCandidate(ctx: CleanerCommandContext, candidate: WorkspaceCleanupCandidate): Promise<void> {
  const document = await vscode.workspace.openTextDocument(candidate.uri);
  if (document.isDirty) {
    throw new Error('file has unsaved changes');
  }

  const snapshot = await ctx.snapshotStore.create(candidate.filePath, candidate.originalText, candidate.cleanedText);
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(candidate.originalText.length));
  edit.replace(candidate.uri, fullRange, candidate.cleanedText);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    throw new Error('WorkspaceEdit could not be applied');
  }

  await document.save();

  await ctx.historyStore.add({
    id: candidate.report.id,
    createdAt: new Date().toISOString(),
    fileName: path.basename(candidate.filePath),
    filePath: candidate.filePath,
    relativePath: relativePathFor(candidate.filePath),
    charsChanged: Math.abs(candidate.originalText.length - candidate.cleanedText.length),
    rulesRemoved: candidate.report.proposedRemovals,
    rulesKeptBecauseUncertain: candidate.report.uncertainBranches,
    snapshotId: snapshot.id,
    report: candidate.report
  });
}
