import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HistoryStore } from '../../storage/historyStore';
import { SnapshotStore } from '../../storage/snapshotStore';
import {
  getStorageRoot,
  getWorkspaceRoot,
  isIgnoredPath,
  isPathInsideWorkspace,
  jsonResponse,
  loadMcpConfig
} from '../mcpUtils';
import type { RevertSnapshotInput } from '../mcpTypes';

export const revertSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  workspaceRoot: z.string().min(1).optional(),
  reason: z.string().max(1000).optional()
});

export async function handleRevertSnapshot(input: RevertSnapshotInput): Promise<unknown> {
  try {
    const workspaceRoot = getWorkspaceRoot(input.workspaceRoot);
    const { cleaner, mcp } = await loadMcpConfig(workspaceRoot);
    if (!mcp.enableRevertTool) {
      return errorResult(input.snapshotId, 'cleanerCSS.mcp.enableRevertTool is false.');
    }

    const storageRoot = getStorageRoot(workspaceRoot);
    const snapshotStore = new SnapshotStore(storageRoot);
    const snapshot = await snapshotStore.read(input.snapshotId);
    if (!snapshot) return errorResult(input.snapshotId, 'Snapshot not found.');
    if (!isPathInsideWorkspace(snapshot.filePath, workspaceRoot)) return errorResult(input.snapshotId, 'Snapshot target is outside workspaceRoot.');
    if (isIgnoredPath(snapshot.filePath)) return errorResult(input.snapshotId, 'Snapshot target is in an ignored directory.');

    await fs.writeFile(snapshot.filePath, snapshot.originalText, 'utf8');
    const restoredAt = new Date().toISOString();
    await new HistoryStore(storageRoot, cleaner.historyLimit).add({
      id: `restore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: restoredAt,
      fileName: path.basename(snapshot.filePath),
      filePath: snapshot.filePath,
      relativePath: path.relative(workspaceRoot, snapshot.filePath) || path.basename(snapshot.filePath),
      charsChanged: snapshot.cleanedText ? Math.abs(snapshot.cleanedText.length - snapshot.originalText.length) : 0,
      rulesRemoved: 0,
      rulesKeptBecauseUncertain: 0,
      snapshotId: snapshot.id,
      report: {
        id: `restore-report-${Date.now()}`,
        file: snapshot.filePath,
        date: restoredAt,
        durationMs: 0,
        filesScanned: [],
        filesIgnored: [],
        totalRules: 0,
        totalBranches: 0,
        usedBranches: 0,
        unusedBranches: 0,
        uncertainBranches: 0,
        proposedRemovals: 0,
        proposedPartialRemovals: 0,
        removableCharacters: 0,
        rules: [],
        warnings: [`Snapshot restored by MCP. Reason: ${input.reason ?? 'not provided'}`],
        suggestions: [],
        usageIndex: { classes: [], ids: [], tags: [], attributes: [], keyframes: [], dynamicPrefixes: [], dynamicContains: [], filesScanned: [], filesIgnored: [], warnings: [] }
      },
      appliedBy: 'mcp',
      reason: input.reason
    });

    return {
      status: 'restored',
      snapshotId: input.snapshotId,
      filePath: snapshot.filePath,
      restoredAt,
      safety: { restoredFromSnapshot: true, snapshotPreserved: true }
    };
  } catch (error) {
    return errorResult(input.snapshotId, String(error));
  }
}

export function registerRevertSnapshotTool(server: McpServer): void {
  server.registerTool(
    'cleanercss_revert_snapshot',
    {
      title: 'Revert CleanerCSS Snapshot',
      description: 'Restore a file from an existing CleanerCSS snapshot without deleting the snapshot.',
      inputSchema: revertSnapshotSchema
    },
    async (input) => jsonResponse(await handleRevertSnapshot(input))
  );
}

function errorResult(snapshotId: string, error: string): unknown {
  return {
    status: 'error',
    snapshotId,
    error,
    safety: { restoredFromSnapshot: false, snapshotPreserved: true }
  };
}
