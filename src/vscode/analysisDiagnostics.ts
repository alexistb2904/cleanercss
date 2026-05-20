import * as vscode from 'vscode';
import type { CleanReport } from '../types/analysis';
import { buildAnalysisProblems } from '../core/analysisProblems';

export class AnalysisDiagnostics implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('CleanerCSS');

  publish(uri: vscode.Uri, text: string, report: CleanReport): number {
    const diagnostics = buildAnalysisProblems(report, text).map(problem => {
      const diagnostic = new vscode.Diagnostic(
        toRange(problem.range),
        `${problem.message}${problem.reasons.length ? `\n${problem.reasons.slice(0, 3).join('\n')}` : ''}`,
        problem.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information
      );
      diagnostic.source = 'CleanerCSS';
      diagnostic.code = problem.code;
      if (problem.unnecessary) diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
      return diagnostic;
    });
    this.collection.set(uri, diagnostics);
    return diagnostics.length;
  }

  clear(uri?: vscode.Uri): void {
    if (uri) {
      this.collection.delete(uri);
      return;
    }
    this.collection.clear();
  }

  dispose(): void {
    this.collection.dispose();
  }
}

function toRange(range: import('../review/reviewTypes').SerializedRange): vscode.Range {
  return new vscode.Range(range.startLine, range.startCharacter, range.endLine, range.endCharacter);
}
