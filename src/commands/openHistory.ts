import * as vscode from "vscode";
import type { HistoryEntry } from "../types/history";
import type { CleanerCommandContext } from "./commandContext";
import { resolveHistoryEntry, type HistoryTarget } from "./historyTarget";

export async function openHistory(ctx: CleanerCommandContext, entry?: HistoryTarget): Promise<void> {
	const chosen = resolveHistoryEntry(entry) ?? (await pickHistory(ctx));
	if (!chosen) return;
	const snapshot = await ctx.snapshotStore.read(chosen.snapshotId);
	if (!snapshot) {
		await vscode.window.showErrorMessage("CleanerCSS snapshot not found. It may have been removed manually.");
		return;
	}
	const uri = vscode.Uri.file(chosen.filePath);
	let document: vscode.TextDocument;

	try {
		document = await vscode.workspace.openTextDocument(uri);
	} catch {
		await vscode.window.showErrorMessage(`CleanerCSS could not open ${chosen.relativePath}.`);
		return;
	}

	const preview = await ctx.diffProvider.openAppliedSnapshotDiff(uri, snapshot.originalText, undefined, `CleanerCSS Review: ${chosen.relativePath}`);
	const action = await ctx.diffPreviewControls.waitForChoice();

	if (action === "accept") {
		if (document.isDirty) {
			await document.save();
		}
		await ctx.diffProvider.closePreview(preview);
		await vscode.window.showInformationMessage("CleanerCSS review validated. The current file was kept.");
		return;
	}

	if (action === "reject") {
		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
		edit.replace(uri, fullRange, snapshot.originalText);
		const applied = await vscode.workspace.applyEdit(edit);
		if (applied) {
			await document.save();
			await vscode.window.showInformationMessage("CleanerCSS review cancelled. The file was reverted to the snapshot state.");
		} else {
			await vscode.window.showErrorMessage("CleanerCSS could not revert the file.");
		}
		await ctx.diffProvider.closePreview(preview);
		return;
	}

	await ctx.diffProvider.closePreview(preview);
}

export async function pickHistory(ctx: CleanerCommandContext): Promise<HistoryEntry | undefined> {
	const entries = await ctx.historyStore.list();
	if (entries.length === 0) {
		await vscode.window.showInformationMessage("CleanerCSS history is empty.");
		return undefined;
	}
	const picked = await vscode.window.showQuickPick(
		entries.map((entry) => ({
			label: entry.fileName,
			description: `${entry.relativePath} · ${new Date(entry.createdAt).toLocaleString()}`,
			detail: `${entry.rulesRemoved} removed · ${entry.rulesKeptBecauseUncertain} uncertain · ${entry.charsChanged} chars`,
			entry,
		})),
		{ title: "CleanerCSS History" }
	);
	return picked?.entry;
}
