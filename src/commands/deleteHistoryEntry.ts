import * as vscode from 'vscode';
import type { HistoryEntry } from '../types/history';
import type { CleanerCommandContext } from './commandContext';
import { pickHistory } from './openHistory';
import { resolveHistoryEntry, type HistoryTarget } from './historyTarget';

export async function deleteHistoryEntry(ctx: CleanerCommandContext, entry?: HistoryTarget): Promise<void> {
  const chosen = resolveHistoryEntry(entry) ?? await pickHistory(ctx);
  if (!chosen) return;

  const confirm = await vscode.window.showWarningMessage(
    `Delete CleanerCSS history entry for ${chosen.relativePath} and its snapshot file from disk?`,
    { modal: true },
    'Delete Entry',
    'Cancel'
  );
  if (confirm !== 'Delete Entry') return;

  const deleted = await ctx.historyStore.delete(chosen.id);
  if (!deleted) {
    await vscode.window.showWarningMessage('CleanerCSS history entry was not found.');
    return;
  }

  const snapshotDeleted = await ctx.snapshotStore.delete(chosen.snapshotId);
  if (!snapshotDeleted) {
    await vscode.window.showWarningMessage(`CleanerCSS history entry was deleted, but snapshot file ${chosen.snapshotId} was not found on disk.`);
  }

  ctx.historyTreeProvider.refresh();
  await vscode.window.showInformationMessage('CleanerCSS history entry and snapshot file deleted.');
}
