import * as fs from 'fs/promises';
import * as path from 'path';
import type { HistoryEntry } from '../types/history';

export class HistoryStore {
  constructor(private readonly storageRoot: string, private readonly limit = 25) {}

  async list(): Promise<HistoryEntry[]> {
    try {
      const raw = await fs.readFile(this.historyFile, 'utf8');
      const parsed = JSON.parse(raw) as HistoryEntry[];
      return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  async add(entry: HistoryEntry): Promise<void> {
    await this.ensure();
    const entries = [entry, ...(await this.list()).filter(existing => existing.id !== entry.id)].slice(0, this.limit);
    await fs.writeFile(this.historyFile, JSON.stringify(entries, null, 2), 'utf8');
  }

  async clear(): Promise<void> {
    await this.ensure();
    await fs.writeFile(this.historyFile, '[]', 'utf8');
  }

  async delete(id: string): Promise<boolean> {
    await this.ensure();
    const entries = await this.list();
    const next = entries.filter(entry => entry.id !== id);
    if (next.length === entries.length) return false;
    await fs.writeFile(this.historyFile, JSON.stringify(next, null, 2), 'utf8');
    return true;
  }

  async pruneOlderThan(cutoff: Date): Promise<HistoryEntry[]> {
    await this.ensure();
    const entries = await this.list();
    const removed = entries.filter(entry => isOlderThan(entry.createdAt, cutoff));
    if (!removed.length) return [];

    const next = entries.filter(entry => !isOlderThan(entry.createdAt, cutoff));
    await fs.writeFile(this.historyFile, JSON.stringify(next, null, 2), 'utf8');
    return removed;
  }

  async get(id: string): Promise<HistoryEntry | undefined> {
    return (await this.list()).find(entry => entry.id === id);
  }

  async latest(): Promise<HistoryEntry | undefined> {
    return (await this.list())[0];
  }

  private async ensure(): Promise<void> {
    await fs.mkdir(this.storageRoot, { recursive: true });
  }

  private get historyFile(): string {
    return path.join(this.storageRoot, 'history.json');
  }
}

function isOlderThan(value: string, cutoff: Date): boolean {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < cutoff.getTime();
}
