import * as vscode from 'vscode';
import { reportToJson } from '../core/reportGenerator';
import type { CleanerCommandContext } from './commandContext';
import { pickHistory } from './openHistory';

export async function exportReport(ctx: CleanerCommandContext): Promise<void> {
  const latest = await ctx.getLastReport();
  const choice = await vscode.window.showQuickPick([
    { label: 'Latest analysis report', value: 'latest' as const, description: latest?.file },
    { label: 'Report from history...', value: 'history' as const }
  ], { title: 'CleanerCSS Export Report' });
  if (!choice) return;
  const report = choice.value === 'latest' ? latest : (await pickHistory(ctx))?.report;
  if (!report) {
    await vscode.window.showInformationMessage('No CleanerCSS report available yet.');
    return;
  }
  const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file('cleanercss-report.json'), filters: { JSON: ['json'] } });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, Buffer.from(reportToJson(report), 'utf8'));
  await vscode.window.showInformationMessage('CleanerCSS report exported.');
}
