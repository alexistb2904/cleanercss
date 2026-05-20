import * as vscode from 'vscode';

export function withCleanerProgress<T>(title: string, task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Thenable<T> | Promise<T>): Thenable<T> {
  return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: true }, task);
}
