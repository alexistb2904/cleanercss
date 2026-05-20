import type { CleanReport, RuleAnalysis } from '../types/analysis';
import type { SelectorBranchAnalysis, SelectorToken } from '../types/selector';
import type { SerializedRange } from '../review/reviewTypes';

export type AnalysisProblemSeverity = 'warning' | 'information';

export interface AnalysisProblem {
  code: 'cleanercss-unused-selector' | 'cleanercss-uncertain-selector' | 'cleanercss-warning';
  message: string;
  severity: AnalysisProblemSeverity;
  range: SerializedRange;
  selector?: string;
  reasons: string[];
  unnecessary: boolean;
}

export function buildAnalysisProblems(report: CleanReport, text: string): AnalysisProblem[] {
  const problems: AnalysisProblem[] = [];

  for (const warning of report.warnings) {
    problems.push({
      code: 'cleanercss-warning',
      message: warning,
      severity: 'warning',
      range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
      reasons: [warning],
      unnecessary: false
    });
  }

  for (const rule of report.rules) {
    for (const selector of rule.removedSelectors) {
      problems.push(...problemsForSelector(text, rule, selector, 'warning', 'cleanercss-unused-selector'));
    }
    for (const selector of rule.uncertainSelectors) {
      problems.push(...problemsForSelector(text, rule, selector, 'information', 'cleanercss-uncertain-selector'));
    }
  }

  return problems;
}

function problemsForSelector(
  text: string,
  rule: RuleAnalysis,
  selector: string,
  severity: AnalysisProblemSeverity,
  code: AnalysisProblem['code']
): AnalysisProblem[] {
  const branch = rule.branches.find(entry => entry.selector === selector);
  const selectorRange = findSelectorRange(text, rule, selector);
  const tokenRanges = selectorRange && branch ? findClassTokenRanges(text, selectorRange, branch) : [];
  const ranges = tokenRanges.length ? tokenRanges : selectorRange ? [selectorRange] : [fallbackRuleRange(text, rule)];
  const isUnused = code === 'cleanercss-unused-selector';
  const reasons = branch?.reasons.length ? branch.reasons : rule.reasons;

  return ranges.map(range => ({
    code,
    message: isUnused
      ? `CleanerCSS: unused selector branch ${selector}`
      : `CleanerCSS: uncertain selector branch preserved ${selector}`,
    severity,
    range,
    selector,
    reasons,
    unnecessary: isUnused
  }));
}

function findSelectorRange(text: string, rule: RuleAnalysis, selector: string): SerializedRange | undefined {
  const ruleRange = fallbackRuleRange(text, rule);
  const ruleStart = offsetAt(text, ruleRange.startLine, ruleRange.startCharacter);
  const ruleEnd = offsetAt(text, ruleRange.endLine, ruleRange.endCharacter);
  const block = text.slice(ruleStart, ruleEnd);
  let index = block.indexOf(selector);
  if (index !== -1) {
    return offsetRangeToSerializedRange(text, ruleStart + index, ruleStart + index + selector.length);
  }

  index = text.indexOf(selector);
  if (index !== -1) {
    return offsetRangeToSerializedRange(text, index, index + selector.length);
  }

  return undefined;
}

function findClassTokenRanges(text: string, selectorRange: SerializedRange, branch: SelectorBranchAnalysis): SerializedRange[] {
  const selectorStart = offsetAt(text, selectorRange.startLine, selectorRange.startCharacter);
  const selectorEnd = offsetAt(text, selectorRange.endLine, selectorRange.endCharacter);
  const selectorText = text.slice(selectorStart, selectorEnd);
  const classTokens = pickTokensToUnderline(branch);
  const ranges: SerializedRange[] = [];

  for (const token of classTokens) {
    const index = selectorText.indexOf(token.raw);
    if (index !== -1) {
      ranges.push(offsetRangeToSerializedRange(text, selectorStart + index, selectorStart + index + token.raw.length));
    }
  }

  return ranges;
}

function pickTokensToUnderline(branch: SelectorBranchAnalysis): SelectorToken[] {
  const missingClasses = branch.missingTokens.filter(token => token.type === 'class');
  if (missingClasses.length) return missingClasses;
  return branch.tokens.filter(token => token.type === 'class');
}

function fallbackRuleRange(text: string, rule: RuleAnalysis): SerializedRange {
  if (rule.startLine !== undefined && rule.endLine !== undefined) {
    const lines = text.split(/\r?\n/);
    const startLine = Math.max(0, rule.startLine - 1);
    const endLine = Math.min(lines.length - 1, Math.max(startLine, rule.endLine - 1));
    return {
      startLine,
      startCharacter: firstNonWhitespace(lines[startLine] ?? ''),
      endLine,
      endCharacter: lines[endLine]?.length ?? 0
    };
  }

  const index = text.indexOf(rule.originalSelector);
  if (index !== -1) {
    return offsetRangeToSerializedRange(text, index, index + rule.originalSelector.length);
  }

  return { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 };
}

function offsetAt(text: string, line: number, character: number): number {
  const lines = text.split(/\r?\n/);
  if (line < 0 || line >= lines.length) return 0;
  let offset = 0;
  for (let index = 0; index < line; index += 1) {
    offset += lines[index].length + newlineLengthAt(text, offset + lines[index].length);
  }
  return Math.min(offset + character, offset + lines[line].length);
}

function offsetRangeToSerializedRange(text: string, start: number, end: number): SerializedRange {
  const startPos = positionAt(text, start);
  const endPos = positionAt(text, end);
  return {
    startLine: startPos.line,
    startCharacter: startPos.character,
    endLine: endPos.line,
    endCharacter: endPos.character
  };
}

function positionAt(text: string, offset: number): { line: number; character: number } {
  const bounded = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, bounded);
  const lines = before.split(/\r?\n/);
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length
  };
}

function firstNonWhitespace(line: string): number {
  const match = /\S/.exec(line);
  return match?.index ?? 0;
}

function newlineLengthAt(text: string, index: number): number {
  return text[index] === '\r' && text[index + 1] === '\n' ? 2 : 1;
}
