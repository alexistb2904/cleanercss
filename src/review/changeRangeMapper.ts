import type { ReviewChange, SerializedRange } from './reviewTypes';

export interface MappedChangeRange {
  range?: SerializedRange;
  reason?: string;
}

export function mapChangeRange(documentText: string, change: ReviewChange): MappedChangeRange {
  if (change.replacementText.length === 0) {
    return { reason: 'This change removed text, so an individual undo cannot be verified without ambiguity.' };
  }

  if (change.currentRange) {
    const currentText = readRange(documentText, change.currentRange);
    if (currentText === change.replacementText) {
      return { range: change.currentRange };
    }
  }

  const matches = findOccurrences(documentText, change.replacementText);
  if (matches.length === 1) {
    return { range: offsetRangeToSerializedRange(documentText, matches[0], matches[0] + change.replacementText.length) };
  }

  if (matches.length > 1) {
    return { reason: 'The replacement text exists multiple times in the current document.' };
  }

  return { reason: 'The replacement text could not be found in the current document.' };
}

export function readRange(text: string, range: SerializedRange): string {
  const start = offsetAt(text, range.startLine, range.startCharacter);
  const end = offsetAt(text, range.endLine, range.endCharacter);
  if (start < 0 || end < start) return '';
  return text.slice(start, end);
}

export function offsetRangeToSerializedRange(text: string, start: number, end: number): SerializedRange {
  const startPos = positionAt(text, start);
  const endPos = positionAt(text, end);
  return {
    startLine: startPos.line,
    startCharacter: startPos.character,
    endLine: endPos.line,
    endCharacter: endPos.character
  };
}

function findOccurrences(text: string, needle: string): number[] {
  const results: number[] = [];
  let start = 0;
  while (start <= text.length) {
    const index = text.indexOf(needle, start);
    if (index === -1) break;
    results.push(index);
    start = index + Math.max(needle.length, 1);
  }
  return results;
}

function offsetAt(text: string, line: number, character: number): number {
  const lines = text.split(/\r?\n/);
  if (line < 0 || line >= lines.length) return -1;
  let offset = 0;
  for (let index = 0; index < line; index += 1) {
    offset += lines[index].length + newlineLengthAt(text, offset + lines[index].length);
  }
  return Math.min(offset + character, offset + lines[line].length);
}

function positionAt(text: string, offset: number): { line: number; character: number } {
  const bounded = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, bounded);
  const lines = before.split(/\r?\n/);
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length
  };
}

function newlineLengthAt(text: string, index: number): number {
  return text[index] === '\r' && text[index + 1] === '\n' ? 2 : 1;
}
