import * as vscode from 'vscode';
import { HistoryStore } from './historyStore';
import { SnapshotStore } from './snapshotStore';

const cleanupIntervalMs = 2 * 24 * 60 * 60 * 1000;

export async function cleanupExpiredHistory(historyStore: HistoryStore, snapshotStore: SnapshotStore, retentionDays: number): Promise<void> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const expiredEntries = await historyStore.pruneOlderThan(cutoff);
  await snapshotStore.clear(expiredEntries.map(entry => entry.snapshotId));

  const activeEntries = await historyStore.list();
  await snapshotStore.pruneOlderThan(cutoff, new Set(activeEntries.map(entry => entry.snapshotId)));
}

export function startHistoryCleanup(
  subscriptions: vscode.ExtensionContext['subscriptions'],
  historyStore: HistoryStore,
  snapshotStore: SnapshotStore,
  retentionDays: number
): void {
  void cleanupExpiredHistory(historyStore, snapshotStore, retentionDays);

  const timer = setInterval(() => {
    void cleanupExpiredHistory(historyStore, snapshotStore, retentionDays);
  }, cleanupIntervalMs);
  subscriptions.push({ dispose: () => clearInterval(timer) });
}
