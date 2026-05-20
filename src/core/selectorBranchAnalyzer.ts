import type { CleanerCSSConfig } from '../types/config';
import type { SelectorBranch, SelectorBranchAnalysis, SelectorToken } from '../types/selector';
import type { UsageMatch } from '../types/usage';
import { UsageIndex } from './usageIndex';
import { maxUsageConfidence } from './confidence';
import { significantTokens } from './selectorExtractor';

const stateClasses = new Set(['active', 'selected', 'disabled', 'open', 'show', 'hidden', 'visible', 'current', 'focus', 'loading', 'checked', 'expanded', 'collapsed']);
const globalSelectors = new Set([':root', 'html', 'body', '*']);

export function analyzeSelectorBranch(branch: SelectorBranch, usage: UsageIndex, config: CleanerCSSConfig): SelectorBranchAnalysis {
  const reasons: string[] = [...branch.warnings];
  const matchedUsages: UsageMatch[] = [];
  const missingTokens: SelectorToken[] = [];
  const selector = branch.selector.trim();

  if (config.ignoreSelectors.includes(selector) || globalSelectors.has(selector)) {
    return uncertain(branch, ['Global or ignored selector is protected'], 0.6, matchedUsages, missingTokens);
  }

  if (branch.hasDynamicSyntax || branch.hasScssNesting || branch.hasComplexPseudo) {
    return uncertain(branch, ['Dynamic, nested, or complex selector syntax is preserved'], 0.55, matchedUsages, missingTokens);
  }

  if (isSafelisted(selector, config)) {
    return uncertain(branch, ['Selector matches safelist'], 0.75, matchedUsages, missingTokens);
  }

  const required = significantTokens(branch).filter(token => token.value && !isSafelisted(token.value, config));
  if (required.length === 0) {
    return uncertain(branch, ['No reliable class, id, or attribute token to prove safe removal'], 0.5, matchedUsages, missingTokens);
  }

  let hasDynamicPatternSignal = false;
  let hasStateLikeSignal = false;
  const tokenConfidences: number[] = [];

  for (const token of required) {
    const matches = matchesForToken(token, usage);
    const dynamicMatches = token.type === 'class' ? usage.matchesDynamic(token.value) : [];

    if (dynamicMatches.length > 0) {
      hasDynamicPatternSignal = true;
      matchedUsages.push(...dynamicMatches);
      reasons.push(`${token.raw} matches a dynamic usage pattern${describeMatches(dynamicMatches)}`);
      tokenConfidences.push(0.6);
      continue;
    }

    if (matches.length > 0) {
      matchedUsages.push(...matches);
      tokenConfidences.push(maxUsageConfidence(matches));
      continue;
    }

    if (isStateLike(token.value) || isSafelisted(token.value, config)) {
      hasStateLikeSignal = true;
      reasons.push(`${token.raw} may be dynamic or state-driven`);
      tokenConfidences.push(0.6);
      continue;
    }

    missingTokens.push(token);
    tokenConfidences.push(0);
  }

  if (missingTokens.length > 0) {
    if (hasDynamicPatternSignal) {
      return uncertain(branch, [`Missing ${missingTokens.map(t => t.raw).join(', ')} but dynamic usage patterns were detected`], 0.55, matchedUsages, missingTokens);
    }
    const removalConfidence = Math.max(config.minConfidenceToRemove, 0.9);
    return {
      selector,
      tokens: branch.tokens,
      status: 'unused',
      confidence: removalConfidence,
      reasons: [`Required token(s) not found: ${missingTokens.map(t => t.raw).join(', ')}`, ...reasons],
      matchedUsages,
      missingTokens
    };
  }

  if (hasDynamicPatternSignal || hasStateLikeSignal) {
    return uncertain(branch, ['Selector is only supported by dynamic usage signals'], 0.6, matchedUsages, missingTokens);
  }

  const confidence = Math.min(1, Math.max(...tokenConfidences, 0.8));
  return {
    selector,
    tokens: branch.tokens,
    status: 'used',
    confidence,
    reasons: ['All required selector tokens were found with explicit or safe usage signals', ...reasons],
    matchedUsages,
    missingTokens
  };
}

function matchesForToken(token: SelectorToken, usage: UsageIndex): UsageMatch[] {
  switch (token.type) {
    case 'class': return usage.classMatches(token.value);
    case 'id': return usage.idMatches(token.value);
    case 'attribute': return usage.attributeMatches(token.value);
    case 'tag': return usage.tagMatches(token.value);
    default: return [];
  }
}

function uncertain(branch: SelectorBranch, why: string[], confidence: number, matchedUsages: UsageMatch[], missingTokens: SelectorToken[]): SelectorBranchAnalysis {
  return { selector: branch.selector, tokens: branch.tokens, status: 'uncertain', confidence, reasons: why, matchedUsages, missingTokens };
}

function isSafelisted(value: string, config: CleanerCSSConfig): boolean {
  const clean = value.replace(/^[.#]/, '');
  if (config.safelist.includes(value) || config.safelist.includes(clean)) return true;
  return config.safelistPatterns.some(pattern => {
    try { return new RegExp(pattern).test(clean) || new RegExp(pattern).test(value); }
    catch { return false; }
  });
}

function isStateLike(value: string): boolean {
  return stateClasses.has(value) || value.startsWith('is-') || value.startsWith('has-') || value.startsWith('js-') || value.startsWith('state-');
}

function describeMatches(matches: UsageMatch[]): string {
  const first = matches[0];
  if (!first) return '';
  const where = first.file ? ` in ${first.file}` : '';
  const excerpt = first.excerpt ? ` (${first.excerpt.slice(0, 120)})` : '';
  return `${where}${excerpt}`;
}
