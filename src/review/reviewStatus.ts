import type { ReviewChangeStatus, ReviewFileEntry, ReviewSession, ReviewSessionStatus } from './reviewTypes';

export function statusForChanges(statuses: ReviewChangeStatus[]): ReviewSessionStatus {
  if (statuses.length === 0) return 'kept';
  if (statuses.some(status => status === 'failed')) return 'failed';
  if (statuses.every(status => status === 'kept')) return 'kept';
  if (statuses.every(status => status === 'undone')) return 'undone';
  if (statuses.every(status => status === 'pending')) return 'pending';
  return 'partially-reviewed';
}

export function refreshFileStatus(file: ReviewFileEntry): ReviewFileEntry {
  return {
    ...file,
    status: statusForChanges(file.changes.map(change => change.status))
  };
}

export function refreshSessionStatus(session: ReviewSession): ReviewSession {
  const files = session.files.map(refreshFileStatus);
  return {
    ...session,
    files,
    status: statusForChanges(files.flatMap(file => file.changes.map(change => change.status)))
  };
}
