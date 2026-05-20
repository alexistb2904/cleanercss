import * as vscode from "vscode";
import type { HistoryEntry } from "../types/history";
import type { CleanerCommandContext } from "./commandContext";
import { pickHistory } from "./openHistory";
import { resolveHistoryEntry, type HistoryTarget } from "./historyTarget";

export async function exportPatch(ctx: CleanerCommandContext, entry?: HistoryTarget): Promise<void> {
	const chosen = resolveHistoryEntry(entry) ?? (await pickHistory(ctx));
	if (!chosen) return;
	const snapshot = await ctx.snapshotStore.read(chosen.snapshotId);
	if (!snapshot?.cleanedText) {
		await vscode.window.showErrorMessage("CleanerCSS cannot export a patch because the cleaned snapshot is missing.");
		return;
	}
	const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${chosen.fileName}.cleanercss.patch`), filters: { Patch: ["patch", "diff"] } });
	if (!target) return;
	const patch = ctx.diffProvider.createPatch(chosen.filePath, snapshot.originalText, snapshot.cleanedText);
	await vscode.workspace.fs.writeFile(target, Buffer.from(patch, "utf8"));
	await vscode.window.showInformationMessage("CleanerCSS patch exported.");
}
