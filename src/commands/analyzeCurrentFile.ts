import * as vscode from 'vscode';
import { getCleanerCSSConfig } from '../config/configuration';
import { cleanStylesheet } from '../core/cleaner';
import { reportToMarkdown } from '../core/reportGenerator';
import { activeCssEditor, type CleanerCommandContext } from './commandContext';
import { withCleanerProgress } from '../vscode/progress';

export async function analyzeCurrentFile(ctx: CleanerCommandContext): Promise<void> {
  const editor = activeCssEditor();
  if (!editor) {
    await vscode.window.showWarningMessage('CleanerCSS can analyze only an active .css or .scss file.');
    return;
  }

  const config = getCleanerCSSConfig();
  const filePath = editor.document.uri.fsPath;
  const originalText = editor.document.getText();
  const result = await withCleanerProgress('CleanerCSS: analyzing current file', async (progress, token) => {
    const usageIndex = await ctx.scanner.scan(config, progress, token);
    return cleanStylesheet({ text: originalText, filePath, isScss: filePath.endsWith('.scss'), usageIndex, config });
  });

  await ctx.setLastReport(result.report);
  const output = await resolveAnalysisOutput(config.analysisOutput);
  if (!output) return;

  if (output === 'problems') {
    const count = ctx.analysisDiagnostics.publish(editor.document.uri, originalText, result.report);
    await vscode.commands.executeCommand('workbench.actions.view.problems');
    await vscode.window.showInformationMessage(`CleanerCSS analysis published ${count} problem(s) for ${editor.document.fileName}.`);
    return;
  }

  const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: reportToMarkdown(result.report) });
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function resolveAnalysisOutput(configured: 'problems' | 'markdownReport' | 'ask'): Promise<'problems' | 'markdownReport' | undefined> {
  if (configured !== 'ask') return configured;
  const choice = await vscode.window.showQuickPick(
    [
      { label: '$(warning) Problems', value: 'problems' as const, description: 'Show diagnostics in the Problems tab and underline selectors' },
      { label: '$(markdown) Markdown Report', value: 'markdownReport' as const, description: 'Open the previous generated report tab' },
      { label: '$(close) Cancel', value: undefined, description: 'Do not show analysis output' }
    ],
    { title: 'CleanerCSS Analysis Output', placeHolder: 'Where should CleanerCSS show the analysis results?' }
  );
  return choice?.value;
}
