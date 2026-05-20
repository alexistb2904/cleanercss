import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ReviewSession } from './reviewTypes';

export class ReviewSessionStore {
  constructor(private readonly storageRoot: string) {}

  async getAll(): Promise<ReviewSession[]> {
    try {
      const raw = await fs.readFile(this.sessionsFile, 'utf8');
      const sessions = JSON.parse(raw) as ReviewSession[];
      return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<ReviewSession | undefined> {
    return (await this.getAll()).find(session => session.id === id);
  }

  async save(session: ReviewSession): Promise<void> {
    await this.ensure();
    const sessions = [session, ...(await this.getAll()).filter(existing => existing.id !== session.id)];
    await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
  }

  async update(session: ReviewSession): Promise<void> {
    await this.save(session);
  }

  async remove(id: string): Promise<void> {
    await this.ensure();
    const sessions = (await this.getAll()).filter(session => session.id !== id);
    await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
  }

  async clearResolved(): Promise<void> {
    await this.ensure();
    const sessions = (await this.getAll()).filter(session => session.status === 'pending' || session.status === 'partially-reviewed');
    await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
  }

  private async ensure(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  private get sessionsDir(): string {
    return path.join(this.storageRoot, 'reviews');
  }

  private get sessionsFile(): string {
    return path.join(this.sessionsDir, 'sessions.json');
  }
}
