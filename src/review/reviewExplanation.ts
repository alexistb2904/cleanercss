import type { ReviewChange } from './reviewTypes';

export function buildReviewExplanation(change: ReviewChange, filesExplored: number): string {
  return [
    change.title,
    '',
    change.explanation,
    `Confidence: ${change.confidence.toFixed(2)}`,
    `Files explored: ${filesExplored}`,
    change.removedBranches.length ? `Removed: ${change.removedBranches.join(', ')}` : undefined,
    change.keptBranches.length ? `Kept: ${change.keptBranches.join(', ')}` : undefined,
    ...change.reasons.map(reason => `- ${reason}`)
  ].filter(Boolean).join('\n');
}

export function splitReviewExplanation(change: ReviewChange, filesExplored: number): { title: string; detail: string } {
  const lines = buildReviewExplanation(change, filesExplored).split('\n');
  return {
    title: lines[0] ?? change.title,
    detail: lines.slice(2).join('\n')
  };
}

export function removedSummary(change: ReviewChange): string {
  if (change.removedBranches.length) return change.removedBranches.join(', ');
  const firstLine = change.originalText.split(/\r?\n/).find(line => line.trim());
  return firstLine?.trim().slice(0, 120) ?? change.selector ?? 'removed CSS';
}
