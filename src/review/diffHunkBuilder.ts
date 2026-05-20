import type { CleanReport, RuleAnalysis } from '../types/analysis';
import type { ReviewChange, SerializedRange } from './reviewTypes';
import { offsetRangeToSerializedRange } from './changeRangeMapper';

export function buildReviewChanges(input: {
  filePath: string;
  originalContent: string;
  cleanedContent: string;
  report: CleanReport;
}): ReviewChange[] {
  return input.report.rules
    .filter(rule => rule.status === 'removed' || rule.status === 'partially-cleaned')
    .map((rule, index) => buildReviewChange(input.filePath, input.originalContent, input.cleanedContent, rule, index))
    .filter((change): change is ReviewChange => Boolean(change));
}

function buildReviewChange(filePath: string, originalContent: string, cleanedContent: string, rule: RuleAnalysis, index: number): ReviewChange | undefined {
  const originalRange = rangeForRule(originalContent, rule);
  const originalText = textForRange(originalContent, originalRange);
  if (!originalText) return undefined;

  const replacementText = rule.status === 'removed'
    ? ''
    : buildPartialReplacement(originalText, rule, cleanedContent);

  return {
    id: `change-${index + 1}-${hash(`${rule.originalSelector}:${originalRange.startLine}:${originalRange.endLine}`)}`,
    filePath,
    selector: rule.originalSelector,
    title: rule.status === 'removed'
      ? `Remove unused rule ${rule.originalSelector}`
      : `Remove unused selector branch from ${rule.originalSelector}`,
    explanation: rule.status === 'removed'
      ? 'CleanerCSS did not find safe usage for this rule.'
      : 'CleanerCSS kept the used selector branches and removed only unused branches.',
    originalText,
    replacementText,
    originalRange,
    currentRange: findCurrentRange(cleanedContent, replacementText, originalRange),
    status: 'pending',
    removedBranches: [...rule.removedSelectors],
    keptBranches: [...rule.keptSelectors],
    confidence: rule.confidence,
    reasons: [...rule.reasons]
  };
}

function rangeForRule(text: string, rule: RuleAnalysis): SerializedRange {
  if (rule.startLine !== undefined && rule.endLine !== undefined) {
    const lines = text.split(/\r?\n/);
    const startLine = Math.max(0, rule.startLine - 1);
    const endLine = Math.min(lines.length - 1, rule.endLine - 1);
    return {
      startLine,
      startCharacter: firstNonWhitespace(lines[startLine] ?? ''),
      endLine,
      endCharacter: lines[endLine]?.length ?? 0
    };
  }

  const index = text.indexOf(rule.originalSelector);
  if (index === -1) {
    return { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 0 };
  }
  const end = findRuleEnd(text, index);
  return offsetRangeToSerializedRange(text, index, end);
}

function buildPartialReplacement(originalText: string, rule: RuleAnalysis, cleanedContent: string): string {
  const originalSelectorIndex = originalText.indexOf(rule.originalSelector);
  if (originalSelectorIndex === -1) return '';
  const selectorEnd = originalSelectorIndex + rule.originalSelector.length;
  const suffix = originalText.slice(selectorEnd);
  const sameRule = `${formatSelectorList(rule.keptSelectors, rule.originalSelector)}${suffix}`;
  if (cleanedContent.includes(sameRule)) return sameRule;
  const bySuffix = findUniqueBySuffix(cleanedContent, suffix, rule.keptSelectors);
  return bySuffix ?? sameRule;
}

function findCurrentRange(cleanedContent: string, replacementText: string, originalRange: SerializedRange): SerializedRange | undefined {
  if (!replacementText) {
    return {
      startLine: originalRange.startLine,
      startCharacter: originalRange.startCharacter,
      endLine: originalRange.startLine,
      endCharacter: originalRange.startCharacter
    };
  }
  const index = cleanedContent.indexOf(replacementText);
  if (index === -1) return undefined;
  return offsetRangeToSerializedRange(cleanedContent, index, index + replacementText.length);
}

function textForRange(text: string, range: SerializedRange): string {
  const lines = text.split(/\r?\n/);
  if (range.startLine < 0 || range.endLine >= lines.length || range.endLine < range.startLine) return '';
  if (range.startLine === range.endLine) {
    return (lines[range.startLine] ?? '').slice(range.startCharacter, range.endCharacter);
  }

  const selected = lines.slice(range.startLine, range.endLine + 1);
  selected[0] = selected[0].slice(range.startCharacter);
  selected[selected.length - 1] = selected[selected.length - 1].slice(0, range.endCharacter);
  return selected.join('\n');
}

function findUniqueBySuffix(cleanedContent: string, suffix: string, keptSelectors: string[]): string | undefined {
  const candidates = keptSelectors.map(selector => `${selector}${suffix}`);
  const matches = candidates.filter(candidate => cleanedContent.includes(candidate));
  return matches.length === 1 ? matches[0] : undefined;
}

function formatSelectorList(selectors: string[], originalSelector: string): string {
  if (selectors.length <= 1) return selectors[0] ?? originalSelector;
  return originalSelector.includes('\n') ? selectors.join(',\n') : selectors.join(', ');
}

function firstNonWhitespace(line: string): number {
  const match = /\S/.exec(line);
  return match?.index ?? 0;
}

function findRuleEnd(text: string, start: number): number {
  const close = text.indexOf('}', start);
  return close === -1 ? text.length : close + 1;
}

function hash(value: string): string {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = ((result << 5) - result + value.charCodeAt(index)) | 0;
  }
  return Math.abs(result).toString(36);
}
