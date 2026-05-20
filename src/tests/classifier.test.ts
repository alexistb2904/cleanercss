import { describe, expect, it } from 'vitest';
import { classifyRule } from '../core/ruleClassifier';
import { testConfig } from './testConfig';

describe('ruleClassifier', () => {
  it('partially cleans only unused branches', () => {
    const result = classifyRule('.selected, .flag', [
      { selector: '.selected', tokens: [], status: 'used', confidence: 1, reasons: [], matchedUsages: [], missingTokens: [] },
      { selector: '.flag', tokens: [], status: 'unused', confidence: 0.95, reasons: [], matchedUsages: [], missingTokens: [] }
    ], testConfig);
    expect(result.status).toBe('partially-cleaned');
    expect(result.keptSelectors).toEqual(['.selected']);
    expect(result.removedSelectors).toEqual(['.flag']);
  });

  it('preserves uncertain branches by default', () => {
    const result = classifyRule('.safe, .maybe', [
      { selector: '.safe', tokens: [], status: 'used', confidence: 1, reasons: [], matchedUsages: [], missingTokens: [] },
      { selector: '.maybe', tokens: [], status: 'uncertain', confidence: 0.5, reasons: [], matchedUsages: [], missingTokens: [] }
    ], testConfig);
    expect(result.keptSelectors).toEqual(['.safe', '.maybe']);
    expect(result.uncertainSelectors).toEqual(['.maybe']);
  });
});
