import type { CleanReport } from '../types/analysis';

export function reportToMarkdown(report: CleanReport): string {
  const lines: string[] = [];
  lines.push(`# CleanerCSS Report`);
  lines.push('');
  lines.push(`- File: \`${report.file}\``);
  lines.push(`- Date: ${report.date}`);
  lines.push(`- Duration: ${report.durationMs}ms`);
  lines.push(`- Files scanned: ${report.filesScanned.length}`);
  lines.push(`- Files ignored: ${report.filesIgnored.length}`);
  lines.push(`- Rules analyzed: ${report.totalRules}`);
  lines.push(`- Branches analyzed: ${report.totalBranches}`);
  lines.push(`- Used branches: ${report.usedBranches}`);
  lines.push(`- Unused branches: ${report.unusedBranches}`);
  lines.push(`- Uncertain branches: ${report.uncertainBranches}`);
  lines.push(`- Proposed full removals: ${report.proposedRemovals}`);
  lines.push(`- Proposed partial removals: ${report.proposedPartialRemovals}`);
  lines.push(`- Removable characters: ${report.removableCharacters}`);
  lines.push('');

  if (report.warnings.length) {
    lines.push('## Warnings');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  lines.push('## Selector decisions');
  for (const rule of report.rules) {
    if (rule.status === 'unchanged') continue;
    lines.push(`### ${rule.status}: \`${rule.originalSelector}\``);
    if (rule.keptSelectors.length) lines.push(`- Kept: ${rule.keptSelectors.map(s => `\`${s}\``).join(', ')}`);
    if (rule.removedSelectors.length) lines.push(`- Removed: ${rule.removedSelectors.map(s => `\`${s}\``).join(', ')}`);
    if (rule.uncertainSelectors.length) lines.push(`- Uncertain: ${rule.uncertainSelectors.map(s => `\`${s}\``).join(', ')}`);
    for (const reason of rule.reasons.slice(0, 8)) lines.push(`- Reason: ${reason}`);
    lines.push('');
  }

  if (report.suggestions.length) {
    lines.push('## Safelist suggestions');
    for (const suggestion of report.suggestions) lines.push(`- ${suggestion}`);
  }

  return lines.join('\n');
}

export function reportToJson(report: CleanReport): string {
  return JSON.stringify(report, null, 2);
}
