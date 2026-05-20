import * as vscode from 'vscode';
import * as path from 'path';
import { getCleanerCSSConfig } from '../config/configuration';
import { cleanStylesheet } from '../core/cleaner';
import { reportToMarkdown } from '../core/reportGenerator';
import { activeCssEditor, type CleanerCommandContext } from './commandContext';
import { showStrongConfirmation } from '../vscode/notifications';
import { withCleanerProgress } from '../vscode/progress';
import { relativePathFor } from '../vscode/historyTreeProvider';

export type CleanCurrentFileResult = 'applied' | 'rejected' | 'patched' | 'noChanges' | 'noEditor' | 'applyFailed';

export interface CleanCurrentFileOptions {
  silent?: boolean;
}

export async function cleanCurrentFile(ctx: CleanerCommandContext, options: CleanCurrentFileOptions = {}): Promise<CleanCurrentFileResult> {
  const editor = activeCssEditor();
  if (!editor) {
    await vscode.window.showWarningMessage('CleanerCSS only cleans the active .css or .scss file.');
    return 'noEditor';
  }

  const config = getCleanerCSSConfig();
  const document = editor.document;
  const filePath = document.uri.fsPath;
  const originalText = document.getText();

  const result = await withCleanerProgress('CleanerCSS: analyzing workspace', async (progress, token) => {
    progress.report({ message: 'Building workspace usage index...' });
    const usageIndex = await ctx.scanner.scan(config, progress, token);
    progress.report({ message: 'Analyzing selector branches...' });
    return cleanStylesheet({ text: originalText, filePath, isScss: filePath.endsWith('.scss'), usageIndex, config });
  });

  await ctx.setLastReport(result.report);

  if (!result.hasChanges) {
    if (options.silent) {
      void vscode.window.setStatusBarMessage('CleanerCSS found no safe cleanup to apply.', 3000);
    } else {
      const choice = await vscode.window.showInformationMessage('CleanerCSS found no safe cleanup to apply.', 'View Report');
      if (choice === 'View Report') await openReport(result.report);
    }
    return 'noChanges';
  }

  const previewUri = await ctx.diffProvider.openDiff(document.uri, result.cleanedText, `CleanerCSS Preview: ${path.basename(filePath)}`);

  let choice = await ctx.diffPreviewControls.waitForChoice();
  while (choice === 'report') {
    await openReport(result.report);
    choice = await ctx.diffPreviewControls.waitForChoice();
  }

  if (choice === 'patch') {
    await ctx.diffProvider.closePreview(previewUri);
    await savePatch(ctx, filePath, result.originalText, result.cleanedText);
    if (options.silent) {
      void vscode.window.setStatusBarMessage('CleanerCSS patch exported.', 3000);
    }
    return 'patched';
  }

  if (choice !== 'accept') {
    // Close the diff preview and show a notification when the user rejects changes
    await ctx.diffProvider.closePreview(previewUri);
    if (options.silent) {
      void vscode.window.setStatusBarMessage('CleanerCSS changes rejected. No file was modified.', 3000);
    } else {
      await vscode.window.showInformationMessage('CleanerCSS changes rejected. No file was modified.');
    }
    return 'rejected';
  }

  if (result.deletionRatio >= config.maxDeletionRatioBeforeStrongConfirmation) {
    const ok = await showStrongConfirmation(`CleanerCSS proposes deleting ${(result.deletionRatio * 100).toFixed(1)}% of this file. Apply anyway?`);
    if (!ok) return 'rejected';
  }

  // Close the preview as the user accepted, then continue applying edits without blocking popups
  await ctx.diffProvider.closePreview(previewUri);
  void vscode.window.setStatusBarMessage('CleanerCSS: applying changes...', 2000);

  const snapshot = await ctx.snapshotStore.create(filePath, originalText, result.cleanedText);
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(originalText.length));
  edit.replace(document.uri, fullRange, result.cleanedText);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    await vscode.window.showErrorMessage('CleanerCSS could not apply the WorkspaceEdit. No history entry was created.');
    return 'applyFailed';
  }
  await document.save();

  await ctx.historyStore.add({
    id: result.report.id,
    createdAt: new Date().toISOString(),
    fileName: path.basename(filePath),
    filePath,
    relativePath: relativePathFor(filePath),
    charsChanged: Math.abs(result.originalText.length - result.cleanedText.length),
    rulesRemoved: result.report.proposedRemovals,
    rulesKeptBecauseUncertain: result.report.uncertainBranches,
    snapshotId: snapshot.id,
    report: result.report
  });
  ctx.historyTreeProvider.refresh();
  if (options.silent) {
    void vscode.window.setStatusBarMessage(`CleanerCSS applied ${result.report.proposedRemovals} full removal(s) and ${result.report.proposedPartialRemovals} partial cleanup(s).`, 3000);
  } else {
    await vscode.window.showInformationMessage(`CleanerCSS applied ${result.report.proposedRemovals} full removal(s) and ${result.report.proposedPartialRemovals} partial cleanup(s).`);
  }
  return 'applied';
}

async function openReport(report: any): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: reportToMarkdown(report) });
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function savePatch(ctx: CleanerCommandContext, filePath: string, before: string, after: string): Promise<void> {
  const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${filePath}.cleanercss.patch`), filters: { Patch: ['patch', 'diff'] } });
  if (!target) return;
  const patch = ctx.diffProvider.createPatch(filePath, before, after);
  await vscode.workspace.fs.writeFile(target, Buffer.from(patch, 'utf8'));
  vscode.window.setStatusBarMessage('CleanerCSS patch exported.', 5000);
}
