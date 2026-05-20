import type { Rule } from 'postcss';
import { parseCss } from './cssParser';
import { parseScss } from './scssParser';
import { extractSelectorBranches } from './selectorExtractor';
import { analyzeSelectorBranch } from './selectorBranchAnalyzer';
import { classifyRule } from './ruleClassifier';
import type { CleanerCSSConfig } from '../types/config';
import type { CleanReport, CleanResult, RuleAnalysis } from '../types/analysis';
import { UsageIndex } from './usageIndex';

export interface CleanStylesheetOptions {
  text: string;
  filePath: string;
  isScss: boolean;
  usageIndex: UsageIndex;
  config: CleanerCSSConfig;
  startedAt?: number;
}

export function cleanStylesheet(options: CleanStylesheetOptions): CleanResult {
  const startedAt = options.startedAt ?? Date.now();
  const warnings: string[] = [...options.usageIndex.warnings];
  let root;
  try {
    root = options.isScss && options.config.enableScssSupport ? parseScss(options.text, options.filePath) : parseCss(options.text, options.filePath);
  } catch (error) {
    const report = emptyReport(options, startedAt, [`Parsing failed: ${String(error)}`]);
    return { originalText: options.text, cleanedText: options.text, report, hasChanges: false, deletionRatio: 0 };
  }

  const rules: RuleAnalysis[] = [];

  root.walkRules((rule: Rule) => {
    if (!rule.selector || shouldProtectRule(rule)) {
      return;
    }

    if (options.isScss && isComplexScssRule(rule.selector)) {
      const branches = extractSelectorBranches(rule.selector).map(branch => ({
        selector: branch.selector,
        tokens: branch.tokens,
        status: 'uncertain' as const,
        confidence: 0.5,
        reasons: ['SCSS interpolation, placeholder, or complex nesting is preserved'],
        matchedUsages: [],
        missingTokens: []
      }));
      rules.push(classifyRule(rule.selector, branches, options.config));
      return;
    }

    const branches = extractSelectorBranches(rule.selector).map(branch => analyzeSelectorBranch(branch, options.usageIndex, options.config));
    const analysis = classifyRule(rule.selector, branches, options.config);
    analysis.startLine = rule.source?.start?.line;
    analysis.endLine = rule.source?.end?.line;
    rules.push(analysis);

    if (analysis.status === 'removed') {
      rule.remove();
      return;
    }

    if (analysis.status === 'partially-cleaned') {
      rule.selector = formatSelectorList(analysis.keptSelectors, rule.selector);
    }
  });

  const cleanedText = root.toString();
  const removableCharacters = Math.max(0, options.text.length - cleanedText.length);
  const report = buildReport(options, startedAt, rules, warnings, removableCharacters);
  return {
    originalText: options.text,
    cleanedText,
    report,
    hasChanges: cleanedText !== options.text,
    deletionRatio: options.text.length === 0 ? 0 : removableCharacters / options.text.length
  };
}

function shouldProtectRule(rule: Rule): boolean {
  const selector = rule.selector.trim();
  if (selector === ':root' || selector === 'html' || selector === 'body' || selector === '*') return true;
  let parent: any = rule.parent;
  while (parent) {
    if (parent.type === 'atrule') {
      const at = (parent as any).name?.toLowerCase?.();
      if (at === 'keyframes' || at === 'font-face') return true;
    }
    parent = parent.parent;
  }
  return false;
}

function isComplexScssRule(selector: string): boolean {
  return /#\{|%[A-Za-z_-]|@mixin|@include/.test(selector);
}

function formatSelectorList(selectors: string[], original: string): string {
  if (selectors.length <= 1) return selectors[0] ?? original;
  const hadMultiline = original.includes('\n');
  return hadMultiline ? selectors.join(',\n') : selectors.join(', ');
}

function buildReport(options: CleanStylesheetOptions, startedAt: number, rules: RuleAnalysis[], warnings: string[], removableCharacters: number): CleanReport {
  const branches = rules.flatMap(rule => rule.branches);
  return {
    id: createId(),
    file: options.filePath,
    date: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    filesScanned: [...options.usageIndex.filesScanned].sort(),
    filesIgnored: [...options.usageIndex.filesIgnored].sort(),
    totalRules: rules.length,
    totalBranches: branches.length,
    usedBranches: branches.filter(branch => branch.status === 'used').length,
    unusedBranches: branches.filter(branch => branch.status === 'unused').length,
    uncertainBranches: branches.filter(branch => branch.status === 'uncertain').length,
    proposedRemovals: rules.filter(rule => rule.status === 'removed').length,
    proposedPartialRemovals: rules.filter(rule => rule.status === 'partially-cleaned').length,
    removableCharacters,
    rules,
    warnings,
    suggestions: buildSafelistSuggestions(rules),
    usageIndex: options.usageIndex.snapshot()
  };
}

function emptyReport(options: CleanStylesheetOptions, startedAt: number, warnings: string[]): CleanReport {
  return buildReport(options, startedAt, [], warnings, 0);
}

function buildSafelistSuggestions(rules: RuleAnalysis[]): string[] {
  const suggestions = new Set<string>();
  for (const rule of rules) {
    for (const branch of rule.branches) {
      if (branch.status === 'uncertain') {
        for (const token of branch.tokens.filter(token => token.type === 'class')) suggestions.add(token.value);
      }
    }
  }
  return [...suggestions].slice(0, 25);
}

function createId(): string {
  return `cleanercss-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
