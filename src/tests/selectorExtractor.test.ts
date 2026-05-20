import { describe, expect, it } from 'vitest';
import { extractSelectorBranches } from '../core/selectorExtractor';

describe('selectorExtractor', () => {
  it('extracts simple classes', () => {
    const [branch] = extractSelectorBranches('.used');
    expect(branch.tokens).toContainEqual(expect.objectContaining({ type: 'class', value: 'used' }));
  });

  it('extracts ids and attributes', () => {
    const [branch] = extractSelectorBranches('#main .card[data-state="open"]');
    expect(branch.tokens).toContainEqual(expect.objectContaining({ type: 'id', value: 'main' }));
    expect(branch.tokens).toContainEqual(expect.objectContaining({ type: 'attribute', value: 'data-state' }));
  });

  it('extracts selector list branches', () => {
    const branches = extractSelectorBranches('.selected, .flag');
    expect(branches.map(b => b.selector)).toEqual(['.selected', '.flag']);
  });

  it('keeps complex pseudo info', () => {
    const [branch] = extractSelectorBranches('.card:has(.icon)');
    expect(branch.hasComplexPseudo).toBe(true);
  });
});
