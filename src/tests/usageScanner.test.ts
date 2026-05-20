import { describe, expect, it } from 'vitest';
import { scanTextForUsage } from '../core/usageScanner';
import { testConfig } from './testConfig';

describe('usageScanner', () => {
  it('detects className', () => {
    const index = scanTextForUsage('<div className="used card"></div>', { config: testConfig });
    expect(index.classMatches('used').length).toBeGreaterThan(0);
  });

  it('detects clsx and classnames', () => {
    const index = scanTextForUsage('clsx("btn", { active: ok }); classnames("flag")', { config: testConfig });
    expect(index.classMatches('btn').length).toBeGreaterThan(0);
    expect(index.classMatches('active').length).toBeGreaterThan(0);
    expect(index.classMatches('flag').length).toBeGreaterThan(0);
  });

  it('detects CSS Modules', () => {
    const index = scanTextForUsage('styles.button; styles["title"]', { config: testConfig });
    expect(index.classMatches('button').length).toBeGreaterThan(0);
    expect(index.classMatches('title').length).toBeGreaterThan(0);
  });

  it('detects querySelector', () => {
    const index = scanTextForUsage('document.querySelector("#app .modal[data-state=open]")', { config: testConfig });
    expect(index.idMatches('app').length).toBeGreaterThan(0);
    expect(index.classMatches('modal').length).toBeGreaterThan(0);
    expect(index.attributeMatches('data-state').length).toBeGreaterThan(0);
  });

  it('detects static JSX attributes used by attribute selectors', () => {
    const index = scanTextForUsage('<input type="checkbox" checked={enabled} onChange={toggle} />', { config: testConfig });
    expect(index.attributeMatches('type').length).toBeGreaterThan(0);
    expect(index.attributeMatches('onChange')).toHaveLength(0);
  });

  it('detects dynamic template prefixes', () => {
    const index = scanTextForUsage('<div className={`btn-${variant}`}></div>', { config: testConfig });
    expect(index.matchesDynamic('btn-primary').length).toBeGreaterThan(0);
  });

  it('detects static JSX template class chunks around interpolations', () => {
    const index = scanTextForUsage('<div className={`footer-status-badge ${status ? "state-ok" : "state-warn"}`}></div>', { config: testConfig });
    expect(index.classMatches('footer-status-badge').length).toBeGreaterThan(0);
    expect(index.classMatches('state-ok').length).toBeGreaterThan(0);
  });

  it('detects static JSX template classes next to a variable interpolation', () => {
    const index = scanTextForUsage('<a className={`footer-status-badge ${statusTone}`}></a>', { config: testConfig });
    expect(index.classMatches('footer-status-badge').length).toBeGreaterThan(0);
  });

  it('does not treat a class suffix as an exact class usage', () => {
    const index = scanTextForUsage('<span className="footer-status-dot"></span>', { config: testConfig });
    expect(index.classMatches('footer-status-dot').length).toBeGreaterThan(0);
    expect(index.classMatches('status-dot')).toHaveLength(0);
  });

  it('marks static template classes as dynamic when interpolations are present', () => {
    const index = scanTextForUsage('<span className={`type-badge ${k.key_type}`}></span>', { config: testConfig });
    expect(index.classMatches('type-badge').length).toBeGreaterThan(0);
    expect(index.matchesDynamic('type-badge').length).toBeGreaterThan(0);
  });
});
