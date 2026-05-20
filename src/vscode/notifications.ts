import * as vscode from 'vscode';

export async function showStrongConfirmation(message: string): Promise<boolean> {
  const answer = await vscode.window.showWarningMessage(message, { modal: true }, 'Accept Changes', 'Cancel');
  return answer === 'Accept Changes';
}

export async function showInfo(message: string): Promise<void> {
  await vscode.window.showInformationMessage(message);
}
