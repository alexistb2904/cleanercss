import type { CleanReport } from '../types/analysis';

export type CleanerCSSReviewMode = 'nativeDiff' | 'ask';

export type CleanerCSSMcpReviewMode = 'autoApply' | 'proposeOnly';

export type ReviewSessionSource = 'command' | 'mcp' | 'workspace';

export type ReviewChangeStatus = 'pending' | 'kept' | 'undone' | 'failed';

export type ReviewSessionStatus = 'pending' | 'partially-reviewed' | 'kept' | 'undone' | 'failed';

export interface SerializedRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface ReviewChange {
  id: string;
  filePath: string;
  selector?: string;
  ruleId?: string;
  title: string;
  explanation: string;
  originalText: string;
  replacementText: string;
  originalRange: SerializedRange;
  currentRange?: SerializedRange;
  status: ReviewChangeStatus;
  removedBranches: string[];
  keptBranches: string[];
  confidence: number;
  reasons: string[];
}

export interface ReviewFileEntry {
  filePath: string;
  originalContent: string;
  cleanedContent: string;
  snapshotId: string;
  changes: ReviewChange[];
  status: ReviewSessionStatus;
}

export interface ReviewSession {
  id: string;
  source: ReviewSessionSource;
  createdAt: string;
  workspaceRoot?: string;
  report: CleanReport;
  reportPath?: string;
  historyEntryId?: string;
  files: ReviewFileEntry[];
  status: ReviewSessionStatus;
}
