import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { HistoryStore } from '../storage/historyStore';
import { SnapshotStore } from '../storage/snapshotStore';
import { cleanupExpiredHistory } from '../storage/historyCleanup';

describe('historyStore', () => {
  it('stores and limits history entries', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanercss-'));
    const store = new HistoryStore(dir, 1);
    const base: any = { createdAt: new Date().toISOString(), fileName: 'a.css', filePath: '/a.css', relativePath: 'a.css', charsChanged: 1, rulesRemoved: 1, rulesKeptBecauseUncertain: 0, snapshotId: 's', report: { id: 'r' } };
    await store.add({ ...base, id: '1' });
    await store.add({ ...base, id: '2' });
    const entries = await store.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('2');
  });

  it('deletes a single history entry', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanercss-'));
    const store = new HistoryStore(dir, 10);
    const base: any = { createdAt: new Date().toISOString(), fileName: 'a.css', filePath: '/a.css', relativePath: 'a.css', charsChanged: 1, rulesRemoved: 1, rulesKeptBecauseUncertain: 0, snapshotId: 's', report: { id: 'r' } };
    await store.add({ ...base, id: '1' });
    await store.add({ ...base, id: '2' });

    expect(await store.delete('1')).toBe(true);
    expect(await store.delete('missing')).toBe(false);
    expect((await store.list()).map(entry => entry.id)).toEqual(['2']);
  });

  it('prunes expired history entries and snapshot files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanercss-'));
    const historyStore = new HistoryStore(dir, 10);
    const snapshotStore = new SnapshotStore(dir);
    const oldSnapshot = await snapshotStore.create('/old.css', 'old');
    const freshSnapshot = await snapshotStore.create('/fresh.css', 'fresh');
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const freshDate = new Date().toISOString();
    const base: any = { fileName: 'a.css', filePath: '/a.css', relativePath: 'a.css', charsChanged: 1, rulesRemoved: 1, rulesKeptBecauseUncertain: 0, report: { id: 'r' } };

    await historyStore.add({ ...base, id: 'old', createdAt: oldDate, snapshotId: oldSnapshot.id });
    await historyStore.add({ ...base, id: 'fresh', createdAt: freshDate, snapshotId: freshSnapshot.id });

    await cleanupExpiredHistory(historyStore, snapshotStore, 2);

    expect((await historyStore.list()).map(entry => entry.id)).toEqual(['fresh']);
    expect(await snapshotStore.read(oldSnapshot.id)).toBeUndefined();
    expect(await snapshotStore.read(freshSnapshot.id)).toBeTruthy();
  });
});
