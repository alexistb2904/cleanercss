import { describe, expect, it } from 'vitest';
import { cleanStylesheet } from '../core/cleaner';
import { scanTextForUsage } from '../core/usageScanner';
import { testConfig } from './testConfig';

function clean(css: string, usageText: string, isScss = false) {
  const usageIndex = scanTextForUsage(usageText, { config: testConfig });
  return cleanStylesheet({ text: css, filePath: isScss ? 'style.scss' : 'style.css', isScss, usageIndex, config: testConfig });
}

describe('cleaner', () => {
  it('removes simple unused rule', () => {
    const result = clean('.unused { color: red; }', '<div class="other"></div>');
    expect(result.cleanedText.trim()).toBe('');
    expect(result.report.proposedRemovals).toBe(1);
  });

  it('removes simple section row selectors with no exact or dynamic usage', () => {
    const result = clean('.section-row-one, .section-row-three { color: red; }', '<main></main>');
    expect(result.cleanedText.trim()).toBe('');
    expect(result.report.uncertainBranches).toBe(0);
    expect(result.report.proposedRemovals).toBe(1);
  });

  it('keeps simple used rule', () => {
    const result = clean('.used { color: red; }', '<div class="used"></div>');
    expect(result.cleanedText).toContain('.used');
    expect(result.hasChanges).toBe(false);
  });

  it('partially removes comma selector list', () => {
    const result = clean('.selected,\n.flag {\n  color: red;\n}', '<div class="selected"></div>');
    expect(result.cleanedText).toContain('.selected');
    expect(result.cleanedText).not.toContain('.flag');
  });

  it('does not rewrite middle tokens in composed selectors', () => {
    const css = '.main-main-container .header-container .container-logo { width: 18.3333vh; }';
    const result = clean(css, '<div class="main-main-container container-logo"></div>');
    expect(result.cleanedText.trim()).toBe('');
    expect(result.cleanedText).not.toContain('.main-main-container .container-logo');
  });

  it('handles mixed selector list', () => {
    const css = '.main-main-container .header-container .container-logo,\n.selected,\n.flag {\n color: red;\n}';
    const result = clean(css, '<div class="main-main-container container-logo selected"></div>');
    expect(result.cleanedText).toContain('.selected');
    expect(result.cleanedText).not.toContain('.flag');
    expect(result.cleanedText).not.toContain('.header-container');
  });

  it('keeps pseudo-class class when class is used', () => {
    const result = clean('.card:hover { color: red; }', '<div class="card"></div>');
    expect(result.cleanedText).toContain('.card:hover');
  });

  it('supports :not/:is/:where conservatively', () => {
    const result = clean('.card:not(.disabled), .button:is(.primary) { color: red; }', '<div class="card button primary"></div>');
    expect(result.report.uncertainBranches).toBeGreaterThanOrEqual(0);
    expect(result.cleanedText).toContain('.card:not(.disabled)');
  });

  it('keeps SCSS interpolation uncertain', () => {
    const result = clean('.#{$prefix}-button { color: red; }', '', true);
    expect(result.cleanedText).toContain('#{$prefix}');
    expect(result.report.uncertainBranches).toBeGreaterThan(0);
  });

  it('keeps simple SCSS nesting uncertain rather than breaking it', () => {
    const result = clean('.card { &__title { color: red; } &:hover { opacity: .8; } }', '<div class="card"></div>', true);
    expect(result.cleanedText).toContain('&__title');
  });

  it('keeps selectors that rely on interpolated class names conservative', () => {
    const css = '.type-badge.lifetime { color: red; }\n.expand-chevron { transition: transform .2s; }';
    const usage = '<span className={`type-badge ${k.key_type}`}></span>\n<span className={`expand-chevron ${open ? "is-open" : ""}`}></span>';
    const result = clean(css, usage);
    expect(result.cleanedText).toContain('.type-badge.lifetime');
    expect(result.cleanedText).toContain('.expand-chevron');
    expect(result.report.uncertainBranches).toBeGreaterThan(0);
  });

  it('does not let state classes preserve missing structural classes in compound selectors', () => {
    const css = `
.expand-chevron { transform: rotate(0deg); }
.expand-toggle.open .expand-chevron { transform: rotate(180deg); }
.tab-count { color: gray; }
.tab.active .tab-count { color: white; }
`;
    const usage = '<button class="expand-toggle open"></button><div class="tab active"></div>';
    const result = clean(css, usage);
    expect(result.cleanedText).not.toContain('expand-chevron');
    expect(result.cleanedText).not.toContain('tab-count');
    expect(result.report.proposedRemovals).toBe(4);
  });

  it('cleans a realistic mixed stylesheet without dropping dynamic or attribute-backed selectors', () => {
    const css = `
.dashboard-shell,
.dashboard-shell.theme-dark {
  min-height: 100vh;
}

.dashboard-shell .sidebar .nav-item.is-active {
  color: white;
}

.dashboard-shell .sidebar .nav-item .nav-badge {
  opacity: 1;
}

.dashboard-shell .missing-widget .widget-title {
  color: red;
}

[data-route="admin"] .admin-panel .panel-title {
  font-weight: 700;
}

.modal[aria-hidden="false"] .modal__panel {
  transform: translateY(0);
}

.modal[aria-hidden="false"] .modal__ghost {
  opacity: 0;
}

.toast.toast-success,
.toast.toast-error {
  border-width: 1px;
}
`;
    const usage = `
      <main class="dashboard-shell sidebar nav-item nav-badge admin-panel panel-title modal modal__panel toast" data-route="admin" aria-hidden="false"></main>
      <div className={\`toast toast-\${tone}\`}></div>
    `;
    const result = clean(css, usage);

    expect(result.cleanedText).toContain('.dashboard-shell');
    expect(result.cleanedText).not.toContain('.dashboard-shell.theme-dark');
    expect(result.cleanedText).toContain('.dashboard-shell .sidebar .nav-item.is-active');
    expect(result.cleanedText).toContain('.dashboard-shell .sidebar .nav-item .nav-badge');
    expect(result.cleanedText).not.toContain('missing-widget');
    expect(result.cleanedText).not.toContain('widget-title');
    expect(result.cleanedText).toContain('[data-route="admin"] .admin-panel .panel-title');
    expect(result.cleanedText).toContain('.modal[aria-hidden="false"] .modal__panel');
    expect(result.cleanedText).not.toContain('modal__ghost');
    expect(result.cleanedText).toContain('.toast.toast-success');
    expect(result.cleanedText).toContain('.toast.toast-error');
  });

  it('partially cleans multiline selector lists inside media queries', () => {
    const css = `
@media (min-width: 720px) {
  .toolbar .button,
  .toolbar .button--danger,
  .toolbar .button--ghost {
    display: inline-flex;
  }
}
`;
    const usage = '<div class="toolbar button button--danger"></div>';
    const result = clean(css, usage);

    expect(result.cleanedText).toContain('@media (min-width: 720px)');
    expect(result.cleanedText).toContain('.toolbar .button');
    expect(result.cleanedText).toContain('.toolbar .button--danger');
    expect(result.cleanedText).not.toContain('button--ghost');
    expect(result.report.proposedPartialRemovals).toBe(1);
  });

  it('keeps DOM API and querySelector backed selectors while removing adjacent dead rules', () => {
    const css = `
#app .dialog[data-state="open"] > .dialog__title {
  margin: 0;
}

#app .dialog[data-state="open"] > .dialog__missing {
  margin: 0;
}

.selected-row + .row-actions {
  opacity: 1;
}
`;
    const usage = `
      document.querySelector('#app .dialog[data-state="open"] .dialog__title');
      document.getElementsByClassName('selected-row row-actions');
    `;
    const result = clean(css, usage);

    expect(result.cleanedText).toContain('#app .dialog[data-state="open"] > .dialog__title');
    expect(result.cleanedText).not.toContain('dialog__missing');
    expect(result.cleanedText).toContain('.selected-row + .row-actions');
  });

  it('preserves selectors with complex pseudos but still removes ordinary unused selectors nearby', () => {
    const css = `
.card:has(.icon) {
  padding: 12px;
}

:global(.third-party-widget) .slot {
  display: block;
}

.plain-dead-selector {
  display: none;
}
`;
    const result = clean(css, '<main></main>');

    expect(result.cleanedText).toContain('.card:has(.icon)');
    expect(result.cleanedText).toContain(':global(.third-party-widget) .slot');
    expect(result.cleanedText).not.toContain('plain-dead-selector');
    expect(result.report.uncertainBranches).toBe(2);
  });

  it('never cleans rules inside keyframes or font-face blocks', () => {
    const css = `
@keyframes pulse-cleanercss-test {
  from { opacity: 0; }
  to { opacity: 1; }
}

@font-face {
  font-family: "CleanerCSSFixture";
  src: url("./fixture.woff2") format("woff2");
}

.unused-after-assets {
  color: red;
}
`;
    const result = clean(css, '<main></main>');

    expect(result.cleanedText).toContain('@keyframes pulse-cleanercss-test');
    expect(result.cleanedText).toContain('from { opacity: 0; }');
    expect(result.cleanedText).toContain('@font-face');
    expect(result.cleanedText).toContain('CleanerCSSFixture');
    expect(result.cleanedText).not.toContain('unused-after-assets');
  });
});
