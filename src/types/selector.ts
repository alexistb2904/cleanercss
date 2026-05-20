export type SelectorTokenType = 'class' | 'id' | 'tag' | 'attribute' | 'pseudo' | 'unknown';
export type SelectorBranchStatus = 'used' | 'unused' | 'uncertain';

export interface SelectorToken {
  type: SelectorTokenType;
  value: string;
  raw: string;
  optional?: boolean;
  source?: 'selector' | 'pseudo';
}

export interface SelectorBranch {
  selector: string;
  tokens: SelectorToken[];
  hasComplexPseudo: boolean;
  hasDynamicSyntax: boolean;
  hasScssNesting: boolean;
  warnings: string[];
}

export interface SelectorBranchAnalysis {
  selector: string;
  tokens: SelectorToken[];
  status: SelectorBranchStatus;
  confidence: number;
  reasons: string[];
  matchedUsages: import('./usage').UsageMatch[];
  missingTokens: SelectorToken[];
}
