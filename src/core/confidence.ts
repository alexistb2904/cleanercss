import type { UsageMatch } from '../types/usage';

export const confidence = {
  explicitClass: 1.0,
  cssModule: 0.95,
  clsx: 0.9,
  stringLiteral: 0.8,
  domApi: 0.9,
  dynamicPattern: 0.6,
  possible: 0.4,
  none: 0
};

export function maxUsageConfidence(matches: UsageMatch[]): number {
  return matches.reduce((max, item) => Math.max(max, item.confidence), 0);
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
