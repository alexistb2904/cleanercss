import type { CleanReport } from '../types/analysis';
import type { SelectorToken } from '../types/selector';
import type { UsageMatch } from '../types/usage';

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface AnalyzeFileInput {
  filePath: string;
  workspaceRoot?: string;
}

export interface AnalyzeWorkspaceInput {
  workspaceRoot: string;
}

export interface ProposePatchInput {
  filePath: string;
  workspaceRoot?: string;
}

export interface ApplyCleaningInput {
  filePath: string;
  workspaceRoot?: string;
  mode?: 'safe' | 'aggressive';
  reviewMode?: 'autoApply' | 'proposeOnly';
  requireSnapshot?: boolean;
  maxDeletionRatio?: number;
  minConfidenceToRemove?: number;
  includeUncertain?: boolean;
  reason?: string;
}

export interface ApplyCleaningResult {
  status: 'applied' | 'proposed' | 'blocked' | 'error';
  filePath: string;
  reviewMode?: 'autoApply' | 'proposeOnly';
  reviewSessionId?: string;
  snapshotId?: string;
  historyEntryId?: string;
  originalLength?: number;
  cleanedLength?: number;
  changedCharacters?: number;
  removedRules?: number;
  removedBranches?: number;
  keptUncertainBranches?: number;
  deletionRatio?: number;
  patch?: string;
  report?: CleanReport;
  warnings: string[];
  blockedReasons?: string[];
  error?: string;
  safety: {
    snapshotCreated: boolean;
    reversibleFromActivityBar: boolean;
    appliedByMcp: boolean;
    canUndoFromActivityBar: boolean;
    mode: 'safe' | 'aggressive';
  };
}

export interface ExplainSelectorInput {
  selector: string;
  filePath?: string;
  workspaceRoot?: string;
}

export interface RevertSnapshotInput {
  snapshotId: string;
  workspaceRoot?: string;
  reason?: string;
}

export interface ExplainSelectorResult {
  selector: string;
  status: 'used' | 'unused' | 'uncertain';
  confidence: number;
  filesExplored: number;
  reasons: string[];
  missingTokens: SelectorToken[];
  matchedUsages: UsageMatch[];
  recommendation: string;
}

export interface CleanerMcpConfig {
  enableApplyTool: boolean;
  enableRevertTool: boolean;
  defaultApplyMode: 'safe' | 'aggressive';
  maxDeletionRatio: number;
  minConfidenceToRemove: number;
  allowCleaningUncertain: boolean;
  requireSnapshotBeforeApply: boolean;
  defaultReviewMode: 'autoApply' | 'proposeOnly';
}
