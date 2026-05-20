import type { CleanReport } from './analysis';

export interface SnapshotEntry {
  id: string;
  filePath: string;
  createdAt: string;
  originalText: string;
  cleanedText?: string;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  fileName: string;
  filePath: string;
  relativePath: string;
  charsChanged: number;
  rulesRemoved: number;
  rulesKeptBecauseUncertain: number;
  snapshotId: string;
  report: CleanReport;
  appliedBy?: 'vscode' | 'mcp';
  reason?: string;
}
