import * as vscode from "vscode";
import * as path from "path";
import { createTwoFilesPatch } from "diff";

export interface DiffPreviewHandle {
	previewUris: vscode.Uri[];
}

export class DiffProvider {
	constructor(private readonly storageUri: vscode.Uri) {}

	get storageRootUri(): vscode.Uri {
		return this.storageUri;
	}

	async openDiff(originalUri: vscode.Uri, proposedText: string, title = "CleanerCSS Preview"): Promise<DiffPreviewHandle> {
		const dir = vscode.Uri.joinPath(this.storageUri, "previews");
		await vscode.workspace.fs.createDirectory(dir);
		const target = vscode.Uri.joinPath(dir, `${Date.now()}-${path.basename(originalUri.fsPath)}.cleanercss-preview`);
		await vscode.workspace.fs.writeFile(target, Buffer.from(proposedText, "utf8"));
		await vscode.commands.executeCommand("vscode.diff", originalUri, target, title);
		const handle = { previewUris: [target] } as DiffPreviewHandle;
		this.attachPreviewCloseWatcher(handle);
		return handle;
	}

	async closePreview(preview: DiffPreviewHandle | vscode.Uri | undefined): Promise<void> {
		const previewUris = this.normalizePreviewUris(preview);
		if (previewUris.length === 0) return;

		try {
			await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
		} catch (e) {
			// ignore errors when closing preview
		}

		await this.deletePreviewFiles(previewUris);
	}

	async openSnapshotDiff(currentUri: vscode.Uri, snapshotText: string, title = "CleanerCSS Snapshot Diff"): Promise<DiffPreviewHandle> {
		const dir = vscode.Uri.joinPath(this.storageUri, "snapshots-preview");
		await vscode.workspace.fs.createDirectory(dir);
		const target = vscode.Uri.joinPath(dir, `${Date.now()}-${path.basename(currentUri.fsPath)}.snapshot`);
		await vscode.workspace.fs.writeFile(target, Buffer.from(snapshotText, "utf8"));
		await vscode.commands.executeCommand("vscode.diff", currentUri, target, title);
		const handle = { previewUris: [target] } as DiffPreviewHandle;
		this.attachPreviewCloseWatcher(handle);
		return handle;
	}

	async openAppliedSnapshotDiff(currentUri: vscode.Uri, originalText: string, cleanedText: string | undefined, title = "CleanerCSS Applied Diff"): Promise<DiffPreviewHandle> {
		const dir = vscode.Uri.joinPath(this.storageUri, "snapshots-preview");
		await vscode.workspace.fs.createDirectory(dir);
		const stamp = Date.now();
		const original = vscode.Uri.joinPath(dir, `${stamp}-${path.basename(currentUri.fsPath)}.before`);
		await vscode.workspace.fs.writeFile(original, Buffer.from(originalText, "utf8"));

		const cleaned = cleanedText !== undefined ? vscode.Uri.joinPath(dir, `${stamp}-${path.basename(currentUri.fsPath)}.after`) : currentUri;
		if (cleanedText !== undefined) {
			await vscode.workspace.fs.writeFile(cleaned, Buffer.from(cleanedText, "utf8"));
		}

		await vscode.commands.executeCommand("vscode.diff", original, cleaned, title);
		const handle = { previewUris: cleanedText !== undefined ? [original, cleaned] : [original] } as DiffPreviewHandle;
		this.attachPreviewCloseWatcher(handle);
		return handle;
	}

	private attachPreviewCloseWatcher(preview: DiffPreviewHandle): void {
		const previewUris = this.normalizePreviewUris(preview);
		if (previewUris.length === 0) return;

		const disposable = vscode.workspace.onDidCloseTextDocument(async (doc) => {
			try {
				if (previewUris.some((u) => u.toString() === doc.uri.toString())) {
					void vscode.commands.executeCommand("cleanerCSS.preview.cancel");
					await this.deletePreviewFiles(previewUris);
					disposable.dispose();
				}
			} catch {
				// ignore
			}
		});
	}

	createPatch(filePath: string, before: string, after: string): string {
		return createTwoFilesPatch(filePath, filePath, before, after, "before", "after");
	}

	private normalizePreviewUris(preview: DiffPreviewHandle | vscode.Uri | undefined): vscode.Uri[] {
		if (!preview) return [];
		if (preview instanceof vscode.Uri) return [preview];
		return preview.previewUris;
	}

	private async deletePreviewFiles(previewUris: vscode.Uri[]): Promise<void> {
		for (const previewUri of previewUris) {
			try {
				await vscode.workspace.fs.delete(previewUri, { recursive: false, useTrash: false });
			} catch {
				// ignore cleanup races and missing files
			}
		}
	}
}
