import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { WorkspaceUsageScanner } from "./core/workspaceScanner";
import { HistoryStore } from "./storage/historyStore";
import { SnapshotStore } from "./storage/snapshotStore";
import { startHistoryCleanup } from "./storage/historyCleanup";
import { DiffProvider } from "./vscode/diffProvider";
import { DiffPreviewControls } from "./vscode/diffPreviewControls";
import { HistoryTreeProvider } from "./vscode/historyTreeProvider";
import { AnalysisDiagnostics } from "./vscode/analysisDiagnostics";
import type { CleanerCommandContext } from "./commands/commandContext";
import type { CleanReport } from "./types/analysis";
import { getCleanerCSSConfig } from "./config/configuration";
import { cleanCurrentFile } from "./commands/cleanCurrentFile";
import { analyzeCurrentFile } from "./commands/analyzeCurrentFile";
import { cleanWorkspace } from "./commands/cleanWorkspace";
import { openHistory } from "./commands/openHistory";
import { restoreFromHistory } from "./commands/restoreFromHistory";
import { clearHistory } from "./commands/clearHistory";
import { exportReport } from "./commands/exportReport";
import { exportPatch } from "./commands/exportPatch";
import { openSettings } from "./commands/openSettings";
import { deleteHistoryEntry } from "./commands/deleteHistoryEntry";

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
	const config = getCleanerCSSConfig();
	const scanner = new WorkspaceUsageScanner();
	const storageRoot = extensionContext.globalStorageUri.fsPath;
	const historyStore = new HistoryStore(storageRoot, config.historyLimit);
	const snapshotStore = new SnapshotStore(storageRoot);
	const diffProvider = new DiffProvider(extensionContext.globalStorageUri);
	const diffPreviewControls = new DiffPreviewControls();
	const historyTreeProvider = new HistoryTreeProvider(historyStore);
	const analysisDiagnostics = new AnalysisDiagnostics();

	await vscode.workspace.fs.createDirectory(extensionContext.globalStorageUri);
	startHistoryCleanup(extensionContext.subscriptions, historyStore, snapshotStore, config.historyRetentionDays);

	const commandContext: CleanerCommandContext = {
		extensionContext,
		scanner,
		historyStore,
		snapshotStore,
		diffProvider,
		diffPreviewControls,
		historyTreeProvider,
		analysisDiagnostics,
		setLastReport: async (report: CleanReport) => {
			await extensionContext.workspaceState.update("cleanerCSS.lastReport", report);
			await fs.writeFile(path.join(storageRoot, "lastReport.json"), JSON.stringify(report, null, 2), "utf8");
		},
		getLastReport: async () => extensionContext.workspaceState.get<CleanReport>("cleanerCSS.lastReport"),
	};

	const mcpProvider = vscode.lm.registerMcpServerDefinitionProvider("cleanerCSS.mcpProvider", {
		provideMcpServerDefinitions: async () => {
			const serverPath = path.join(extensionContext.extensionPath, "dist", "mcp-server.js");
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

			const definition = new vscode.McpStdioServerDefinition(
				"CleanerCSS",
				process.execPath,
				[serverPath],
				{
					CLEANERCSS_EXTENSION_PATH: extensionContext.extensionPath,
					CLEANERCSS_GLOBAL_STORAGE_URI: extensionContext.globalStorageUri.fsPath,
					CLEANERCSS_WORKSPACE_TRUSTED: String(vscode.workspace.isTrusted),
					...(workspaceRoot ? { CLEANERCSS_WORKSPACE_ROOT: workspaceRoot } : {}),
				},
				extensionContext.extension.packageJSON.version ?? "1.0.0"
			);
			definition.cwd = vscode.Uri.file(extensionContext.extensionPath);

			return [definition];
		},
		resolveMcpServerDefinition: async (server) => server,
	});

	extensionContext.subscriptions.push(
		mcpProvider,
		vscode.window.registerTreeDataProvider("cleanerCSS.history", historyTreeProvider),
		diffPreviewControls,
		analysisDiagnostics,
		vscode.workspace.onDidChangeTextDocument((event) => analysisDiagnostics.clear(event.document.uri)),
		vscode.commands.registerCommand("cleanerCSS.cleanCurrentFile", () => cleanCurrentFile(commandContext)),
		vscode.commands.registerCommand("cleanerCSS.analyzeCurrentFile", () => analyzeCurrentFile(commandContext)),
		vscode.commands.registerCommand("cleanerCSS.cleanWorkspace", () => cleanWorkspace(commandContext)),
		vscode.commands.registerCommand("cleanerCSS.cleanWorkspaceWithoutReview", () => cleanWorkspace(commandContext, "applyAll")),
		vscode.commands.registerCommand("cleanerCSS.openHistory", (entry) => openHistory(commandContext, entry)),
		vscode.commands.registerCommand("cleanerCSS.restoreFromHistory", (entry) => restoreFromHistory(commandContext, entry)),
		vscode.commands.registerCommand("cleanerCSS.openSettings", () => openSettings()),
		vscode.commands.registerCommand("cleanerCSS.clearHistory", () => clearHistory(commandContext)),
		vscode.commands.registerCommand("cleanerCSS.deleteHistoryEntry", (entry) => deleteHistoryEntry(commandContext, entry)),
		vscode.commands.registerCommand("cleanerCSS.exportReport", () => exportReport(commandContext)),
		vscode.commands.registerCommand("cleanerCSS.exportPatch", (entry) => exportPatch(commandContext, entry))
	);

	const watcher = vscode.workspace.createFileSystemWatcher("**/*.{html,htm,js,jsx,ts,tsx,vue,svelte,astro,php,twig,ejs,mdx,json,css,scss}");
	watcher.onDidChange(() => scanner.invalidate());
	watcher.onDidCreate(() => scanner.invalidate());
	watcher.onDidDelete(() => scanner.invalidate());
	extensionContext.subscriptions.push(watcher);
}

export function deactivate(): void {}
