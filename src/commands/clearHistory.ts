import * as vscode from 'vscode';
import type { CleanerCommandContext } from './commandContext';

export async function clearHistory(ctx: CleanerCommandContext): Promise<void> {
  const confirm = await vscode.window.showWarningMessage('Clear CleanerCSS local history and delete snapshot files from disk?', { modal: true }, 'Clear History', 'Cancel');
  if (confirm !== 'Clear History') return;

  const entries = await ctx.historyStore.list();
  await ctx.historyStore.clear();
  await ctx.snapshotStore.clear(entries.map(entry => entry.snapshotId));
  ctx.historyTreeProvider.refresh();
  await vscode.window.showInformationMessage('CleanerCSS history and snapshot files cleared.');
}
