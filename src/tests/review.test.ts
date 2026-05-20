import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanStylesheet } from '../core/cleaner';
import { scanTextForUsage } from '../core/usageScanner';
import { buildReviewChanges } from '../review/diffHunkBuilder';
import { mapChangeRange } from '../review/changeRangeMapper';
import { ReviewSessionStore } from '../review/reviewSessionStore';
import type { ReviewSession } from '../review/reviewTypes';
import { buildAnalysisProblems } from '../core/analysisProblems';
import { testConfig } from './testConfig';

describe('CleanerCSS review sessions', () => {
  it('persists a ReviewSession', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanercss-review-'));
    const store = new ReviewSessionStore(root);
    const session = sampleSession();

    await store.save(session);

    expect(await store.getById(session.id)).toMatchObject({ id: session.id, status: 'pending' });
    expect(await store.getAll()).toHaveLength(1);
  });

  it('builds a ReviewChange for a removed rule', () => {
    const result = clean('.unused { color: red; }', '<div class="used"></div>');
    const changes = buildReviewChanges({
      filePath: 'style.css',
      originalContent: result.originalText,
      cleanedContent: result.cleanedText,
      report: result.report
    });

    expect(changes).toHaveLength(1);
    expect(changes[0].replacementText).toBe('');
    expect(changes[0].removedBranches).toEqual(['.unused']);
  });

  it('builds a ReviewChange for a partially cleaned selector list', () => {
    const result = clean('.used, .unused { color: red; }', '<div class="used"></div>');
    const changes = buildReviewChanges({
      filePath: 'style.css',
      originalContent: result.originalText,
      cleanedContent: result.cleanedText,
      report: result.report
    });

    expect(changes).toHaveLength(1);
    expect(changes[0].replacementText).toContain('.used');
    expect(changes[0].replacementText).not.toContain('.unused');
    expect(changes[0].keptBranches).toEqual(['.used']);
  });

  it('blocks ambiguous partial undo mapping', () => {
    const result = clean('.used, .unused { color: red; }', '<div class="used"></div>');
    const [change] = buildReviewChanges({
      filePath: 'style.css',
      originalContent: result.originalText,
      cleanedContent: result.cleanedText,
      report: result.report
    });

    const mapped = mapChangeRange(`${change.replacementText}\n${change.replacementText}`, { ...change, currentRange: undefined });
    expect(mapped.range).toBeUndefined();
    expect(mapped.reason).toMatch(/multiple/i);
  });

  it('builds Problems diagnostics on unused class tokens', () => {
    const result = clean('.used, .unused { color: red; }', '<div class="used"></div>');
    const problems = buildAnalysisProblems(result.report, result.originalText);
    const unused = problems.find(problem => problem.code === 'cleanercss-unused-selector');

    expect(unused?.selector).toBe('.unused');
    expect(unused?.range.startCharacter).toBe(result.originalText.indexOf('.unused'));
    expect(unused?.unnecessary).toBe(true);
  });
});

function clean(css: string, usageText: string) {
  const usageIndex = scanTextForUsage(usageText, { config: testConfig });
  return cleanStylesheet({ text: css, filePath: 'style.css', isScss: false, usageIndex, config: testConfig });
}

function sampleSession(): ReviewSession {
  const report = clean('.unused { color: red; }', '<div></div>').report;
  return {
    id: 'review-test',
    source: 'command',
    createdAt: new Date().toISOString(),
    report,
    files: [
      {
        filePath: 'style.css',
        originalContent: '.unused { color: red; }',
        cleanedContent: '',
        snapshotId: 'snapshot-test',
        status: 'pending',
        changes: []
      }
    ],
    status: 'pending'
  };
}
