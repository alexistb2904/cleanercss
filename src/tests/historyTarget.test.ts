import { describe, expect, it } from 'vitest';
import { resolveHistoryEntry } from '../commands/historyTarget';
import type { HistoryEntry } from '../types/history';

describe('resolveHistoryEntry', () => {
	it('accepts a raw history entry', () => {
		const entry = makeHistoryEntry('1');
		expect(resolveHistoryEntry(entry)).toBe(entry);
	});

	it('unwraps a tree item history node', () => {
		const entry = makeHistoryEntry('2');
		expect(resolveHistoryEntry({ entry })).toBe(entry);
	});

	it('returns undefined for empty input', () => {
		expect(resolveHistoryEntry(undefined)).toBeUndefined();
	});
});

function makeHistoryEntry(id: string): HistoryEntry {
	return {
		id,
		createdAt: new Date().toISOString(),
		fileName: 'a.css',
		filePath: '/a.css',
		relativePath: 'a.css',
		charsChanged: 1,
		rulesRemoved: 1,
		rulesKeptBecauseUncertain: 0,
		snapshotId: `snapshot-${id}`,
		report: { id: `report-${id}` } as HistoryEntry['report']
	};
}