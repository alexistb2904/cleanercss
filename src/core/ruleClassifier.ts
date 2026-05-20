import type { RuleAnalysis } from '../types/analysis';
import type { CleanerCSSConfig } from '../types/config';
import type { SelectorBranchAnalysis } from '../types/selector';

export function classifyRule(originalSelector: string, branches: SelectorBranchAnalysis[], config: CleanerCSSConfig): RuleAnalysis {
  const keptSelectors: string[] = [];
  const removedSelectors: string[] = [];
  const uncertainSelectors: string[] = [];
  const reasons: string[] = [];

  for (const branch of branches) {
    if (branch.status === 'unused' && branch.confidence >= config.minConfidenceToRemove) {
      removedSelectors.push(branch.selector);
      reasons.push(...branch.reasons.map(reason => `${branch.selector}: ${reason}`));
      continue;
    }

    if (branch.status === 'uncertain') {
      uncertainSelectors.push(branch.selector);
      reasons.push(...branch.reasons.map(reason => `${branch.selector}: ${reason}`));
      if (!config.cleanUncertainSelectors) {
        keptSelectors.push(branch.selector);
      } else if (branch.confidence < config.minConfidenceToRemove) {
        keptSelectors.push(branch.selector);
      } else {
        removedSelectors.push(branch.selector);
      }
      continue;
    }

    keptSelectors.push(branch.selector);
  }

  let status: RuleAnalysis['status'];
  if (removedSelectors.length === 0) status = uncertainSelectors.length === branches.length ? 'uncertain' : 'unchanged';
  else if (keptSelectors.length === 0) status = 'removed';
  else status = 'partially-cleaned';

  const confidence = removedSelectors.length > 0
    ? Math.min(...branches.filter(b => removedSelectors.includes(b.selector)).map(b => b.confidence))
    : Math.max(...branches.map(b => b.confidence), 0);

  return {
    originalSelector,
    keptSelectors,
    removedSelectors,
    uncertainSelectors,
    status,
    confidence,
    reasons,
    branches
  };
}
