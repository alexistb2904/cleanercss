import type { SelectorBranchAnalysis } from './selector';
import type { UsageIndexSnapshot } from './usage';

export type RuleStatus = 'unchanged' | 'partially-cleaned' | 'removed' | 'uncertain';

export interface RuleAnalysis {
  originalSelector: string;
  keptSelectors: string[];
  removedSelectors: string[];
  uncertainSelectors: string[];
  status: RuleStatus;
  confidence: number;
  reasons: string[];
  branches: SelectorBranchAnalysis[];
  startLine?: number;
  endLine?: number;
}

export interface CleanReport {
  id: string;
  file: string;
  date: string;
  durationMs: number;
  filesScanned: string[];
  filesIgnored: string[];
  totalRules: number;
  totalBranches: number;
  usedBranches: number;
  unusedBranches: number;
  uncertainBranches: number;
  proposedRemovals: number;
  proposedPartialRemovals: number;
  removableCharacters: number;
  rules: RuleAnalysis[];
  warnings: string[];
  suggestions: string[];
  usageIndex: UsageIndexSnapshot;
}

export interface CleanResult {
  originalText: string;
  cleanedText: string;
  report: CleanReport;
  hasChanges: boolean;
  deletionRatio: number;
}
