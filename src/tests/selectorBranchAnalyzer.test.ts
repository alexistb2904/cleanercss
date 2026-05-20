import { describe, expect, it } from 'vitest';
import { extractSelectorBranches } from '../core/selectorExtractor';
import { analyzeSelectorBranch } from '../core/selectorBranchAnalyzer';
import { scanTextForUsage } from '../core/usageScanner';
import { testConfig } from './testConfig';

describe('selectorBranchAnalyzer', () => {
  it('marks simple used branch', () => {
    const index = scanTextForUsage('<div class="used"></div>', { config: testConfig });
    const branch = extractSelectorBranches('.used')[0];
    expect(analyzeSelectorBranch(branch, index, testConfig).status).toBe('used');
  });

  it('marks simple unused branch', () => {
    const index = scanTextForUsage('<div class="other"></div>', { config: testConfig });
    const branch = extractSelectorBranches('.unused')[0];
    expect(analyzeSelectorBranch(branch, index, testConfig).status).toBe('unused');
  });

  it('requires every mandatory class in a compound selector', () => {
    const index = scanTextForUsage('<div class="main-main-container container-logo"></div>', { config: testConfig });
    const branch = extractSelectorBranches('.main-main-container .header-container .container-logo')[0];
    const analysis = analyzeSelectorBranch(branch, index, testConfig);
    expect(analysis.status).toBe('unused');
    expect(analysis.missingTokens.map(t => t.value)).toContain('header-container');
  });

  it('keeps a selector when a JSX class and input type attribute both exist', () => {
    const index = scanTextForUsage(`
      <div className="form-group form-group--inline" style={{ marginTop: '10px' }}>
        <label>
          <input type="checkbox" checked={form.embed_timestamp} onChange={(e) => setField('embed_timestamp', e.target.checked)} />
          {t('admin.embed_timestamp')}
        </label>
      </div>
    `, { config: testConfig });
    const branch = extractSelectorBranches('.form-group--inline input[type="checkbox"]')[0];
    const analysis = analyzeSelectorBranch(branch, index, testConfig);
    expect(analysis.status).toBe('used');
    expect(analysis.missingTokens).toHaveLength(0);
  });

  it('keeps dynamic classes uncertain', () => {
    const index = scanTextForUsage('<div className={`btn-${variant}`}></div>', { config: testConfig });
    const branch = extractSelectorBranches('.btn-primary')[0];
    expect(analyzeSelectorBranch(branch, index, testConfig).status).toBe('uncertain');
  });

  it('keeps state classes when a compound selector has a dynamic JSX class', () => {
    const index = scanTextForUsage('<a className={`footer-status-badge ${statusTone}`}></a>', { config: testConfig });
    const branch = extractSelectorBranches('.footer-status-badge.state-ok')[0];
    const analysis = analyzeSelectorBranch(branch, index, testConfig);
    expect(analysis.status).toBe('uncertain');
    expect(analysis.missingTokens).toHaveLength(0);
  });

  it('treats :has as uncertain', () => {
    const index = scanTextForUsage('<div class="card icon"></div>', { config: testConfig });
    const branch = extractSelectorBranches('.card:has(.icon)')[0];
    expect(analyzeSelectorBranch(branch, index, testConfig).status).toBe('uncertain');
  });
});
