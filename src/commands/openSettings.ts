import * as vscode from 'vscode';

export async function openSettings(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:alexistb2904.cleanercss cleanerCSS');
}
