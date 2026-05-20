import * as fs from 'fs/promises';
import * as path from 'path';
import type { SnapshotEntry } from '../types/history';

export class SnapshotStore {
  constructor(private readonly storageRoot: string) {}

  async ensure(): Promise<void> {
    await fs.mkdir(this.snapshotDir, { recursive: true });
  }

  async create(filePath: string, originalText: string, cleanedText?: string): Promise<SnapshotEntry> {
    await this.ensure();
    const entry: SnapshotEntry = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filePath,
      createdAt: new Date().toISOString(),
      originalText,
      cleanedText
    };
    await fs.writeFile(this.fileFor(entry.id), JSON.stringify(entry, null, 2), 'utf8');
    return entry;
  }

  async read(id: string): Promise<SnapshotEntry | undefined> {
    try {
      const raw = await fs.readFile(this.fileFor(id), 'utf8');
      return JSON.parse(raw) as SnapshotEntry;
    } catch {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.fileFor(id));
      return true;
    } catch {
      return false;
    }
  }

  async clear(ids: string[]): Promise<number> {
    let removed = 0;
    for (const id of ids) {
      if (await this.delete(id)) removed += 1;
    }
    return removed;
  }

  async pruneOlderThan(cutoff: Date, keepIds = new Set<string>()): Promise<number> {
    await this.ensure();
    let removed = 0;
    for (const file of await fs.readdir(this.snapshotDir)) {
      if (!file.endsWith('.json')) continue;

      const id = file.slice(0, -'.json'.length);
      if (keepIds.has(id)) continue;

      const filePath = this.fileFor(id);
      const createdAt = await this.snapshotCreatedAt(filePath);
      if (createdAt.getTime() < cutoff.getTime()) {
        try {
          await fs.unlink(filePath);
          removed += 1;
        } catch {
          // Ignore races with manual cleanup.
        }
      }
    }
    return removed;
  }

  private get snapshotDir(): string {
    return path.join(this.storageRoot, 'snapshots');
  }

  private fileFor(id: string): string {
    return path.join(this.snapshotDir, `${id}.json`);
  }

  private async snapshotCreatedAt(filePath: string): Promise<Date> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const snapshot = JSON.parse(raw) as Partial<SnapshotEntry>;
      if (snapshot.createdAt) {
        const parsed = new Date(snapshot.createdAt);
        if (Number.isFinite(parsed.getTime())) return parsed;
      }
    } catch {
      // Fall back to file metadata for malformed snapshots.
    }

    const stat = await fs.stat(filePath);
    return stat.mtime;
  }
}
