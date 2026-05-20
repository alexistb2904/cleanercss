import * as vscode from 'vscode';

export type DiffPreviewChoice = 'accept' | 'reject' | 'patch' | 'report';

export class DiffPreviewControls implements vscode.Disposable {
  private pendingResolve?: (choice: DiffPreviewChoice | undefined) => void;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.commands.registerCommand('cleanerCSS.preview.accept', () => this.resolve('accept')),
      vscode.commands.registerCommand('cleanerCSS.preview.reject', () => this.resolve('reject')),
      vscode.commands.registerCommand('cleanerCSS.preview.savePatch', () => this.resolve('patch')),
      vscode.commands.registerCommand('cleanerCSS.preview.openReport', () => this.resolve('report'))
    );
  }

  waitForChoice(): Promise<DiffPreviewChoice | undefined> {
    this.pendingResolve?.(undefined);
    this.show();
    return new Promise(resolve => {
      this.pendingResolve = resolve;
    });
  }

  dispose(): void {
    this.resolve(undefined);
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private show(): void {
    void vscode.commands.executeCommand('setContext', 'cleanerCSS.previewActive', true);
  }

  private hide(): void {
    void vscode.commands.executeCommand('setContext', 'cleanerCSS.previewActive', false);
  }

  private resolve(choice: DiffPreviewChoice | undefined): void {
    const resolve = this.pendingResolve;
    this.pendingResolve = undefined;
    this.hide();
    resolve?.(choice);
  }
}
