import * as vscode from "vscode";
import * as path from "path";
import type { HistoryEntry } from "../types/history";
import { HistoryStore } from "../storage/historyStore";

export class HistoryTreeProvider implements vscode.TreeDataProvider<TreeNode> {
	private readonly emitter = new vscode.EventEmitter<TreeNode | undefined | void>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(private readonly historyStore: HistoryStore) {}

	refresh(): void {
		this.emitter.fire();
	}

	getTreeItem(element: TreeNode): vscode.TreeItem {
		if (element.kind === "action") {
			const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
			item.iconPath = new vscode.ThemeIcon(element.icon);
			item.command = { command: element.command, title: element.label };
			return item;
		}

		const item = new vscode.TreeItem(`${element.entry.fileName} · ${new Date(element.entry.createdAt).toLocaleString()}`, vscode.TreeItemCollapsibleState.None);
		item.contextValue = "cleanercssHistoryEntry";
		item.description = `${element.entry.rulesRemoved} removed · ${element.entry.rulesKeptBecauseUncertain} uncertain`;
		item.tooltip = `${element.entry.relativePath}\n${element.entry.charsChanged} characters changed`;
		item.iconPath = new vscode.ThemeIcon("history");
		item.command = { command: "cleanerCSS.openHistory", title: "Open History Entry", arguments: [element.entry] };
		return item;
	}

	async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (element) return [];
		const actions: TreeNode[] = [
			{ kind: "action", label: "Clean Current File", command: "cleanerCSS.cleanCurrentFile", icon: "sparkle" },
			{ kind: "action", label: "Analyze Current File", command: "cleanerCSS.analyzeCurrentFile", icon: "search" },
			{ kind: "action", label: "Clean Workspace", command: "cleanerCSS.cleanWorkspace", icon: "workspace-trusted" },
			{ kind: "action", label: "Clean All Without Review", command: "cleanerCSS.cleanWorkspaceWithoutReview", icon: "run-all" },
			{ kind: "action", label: "Settings", command: "cleanerCSS.openSettings", icon: "settings-gear" },
		];
		const entries = await this.historyStore.list();
		return [...actions, ...entries.map((entry) => ({ kind: "history" as const, entry }))];
	}
}

type TreeNode = { kind: "action"; label: string; command: string; icon: string } | { kind: "history"; entry: HistoryEntry };

export function relativePathFor(filePath: string): string {
	const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
	return folder ? path.relative(folder.uri.fsPath, filePath) : filePath;
}
