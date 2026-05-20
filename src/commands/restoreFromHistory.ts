import * as vscode from 'vscode';
import type { HistoryEntry } from '../types/history';
import type { CleanerCommandContext } from './commandContext';
import { pickHistory } from './openHistory';
import { resolveHistoryEntry, type HistoryTarget } from './historyTarget';

export async function restoreFromHistory(ctx: CleanerCommandContext, entry?: HistoryTarget): Promise<void> {
  const chosen = resolveHistoryEntry(entry) ?? await pickHistory(ctx);
  if (!chosen) return;
  const snapshot = await ctx.snapshotStore.read(chosen.snapshotId);
  if (!snapshot) {
    await vscode.window.showErrorMessage('CleanerCSS snapshot not found.');
    return;
  }
  const uri = vscode.Uri.file(chosen.filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const preview = await ctx.diffProvider.openSnapshotDiff(uri, snapshot.originalText, `CleanerCSS Restore Preview: ${chosen.relativePath}`);
  const confirm = await vscode.window.showWarningMessage(`Restore ${chosen.relativePath} from CleanerCSS snapshot?`, { modal: true }, 'Restore', 'Cancel');
  if (confirm !== 'Restore') {
    await ctx.diffProvider.closePreview(preview);
    return;
  }
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), snapshot.originalText);
  const applied = await vscode.workspace.applyEdit(edit);
  if (applied) {
    await doc.save();
    await vscode.window.showInformationMessage('CleanerCSS snapshot restored.');
  }
  await ctx.diffProvider.closePreview(preview);
}
