import type { HistoryEntry } from '../types/history';

export type HistoryTarget = HistoryEntry | { entry: HistoryEntry } | undefined;

export function resolveHistoryEntry(target: HistoryTarget): HistoryEntry | undefined {
	if (!target) return undefined;
	return 'entry' in target ? target.entry : target;
}