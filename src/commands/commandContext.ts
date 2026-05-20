import * as vscode from 'vscode';
import { WorkspaceUsageScanner } from '../core/workspaceScanner';
import { HistoryStore } from '../storage/historyStore';
import { SnapshotStore } from '../storage/snapshotStore';
import { DiffProvider } from '../vscode/diffProvider';
import { DiffPreviewControls } from '../vscode/diffPreviewControls';
import { HistoryTreeProvider } from '../vscode/historyTreeProvider';
import type { CleanReport } from '../types/analysis';
import type { AnalysisDiagnostics } from '../vscode/analysisDiagnostics';

export interface CleanerCommandContext {
  extensionContext: vscode.ExtensionContext;
  scanner: WorkspaceUsageScanner;
  historyStore: HistoryStore;
  snapshotStore: SnapshotStore;
  diffProvider: DiffProvider;
  diffPreviewControls: DiffPreviewControls;
  historyTreeProvider: HistoryTreeProvider;
  analysisDiagnostics: AnalysisDiagnostics;
  setLastReport(report: CleanReport): Promise<void>;
  getLastReport(): Promise<CleanReport | undefined>;
}

export function activeCssEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const file = editor.document.uri.fsPath.toLowerCase();
  if (!file.endsWith('.css') && !file.endsWith('.scss')) return undefined;
  return editor;
}
