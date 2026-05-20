import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HistoryStore } from '../../storage/historyStore';
import { getStorageRoot, getWorkspaceRoot, jsonResponse } from '../mcpUtils';

export const getHistorySchema = z.object({
  limit: z.number().int().min(1).max(500).optional()
});

export async function handleGetHistory(input: { limit?: number }): Promise<unknown> {
  try {
    const workspaceRoot = getWorkspaceRoot(undefined);
    const entries = await new HistoryStore(getStorageRoot(workspaceRoot), input.limit ?? 25).list();
    return {
      status: 'success',
      entries: entries.slice(0, input.limit ?? entries.length).map(entry => ({
        id: entry.id,
        date: entry.createdAt,
        filePath: entry.filePath,
        removedRules: entry.rulesRemoved,
        changedCharacters: entry.charsChanged,
        uncertainRules: entry.rulesKeptBecauseUncertain,
        appliedBy: entry.appliedBy
      }))
    };
  } catch (error) {
    return { status: 'error', entries: [], error: String(error) };
  }
}

export function registerGetHistoryTool(server: McpServer): void {
  server.registerTool(
    'cleanercss_get_history',
    {
      title: 'Get CleanerCSS History',
      description: 'Return CleanerCSS history entries.',
      inputSchema: getHistorySchema
    },
    async (input) => jsonResponse(await handleGetHistory(input))
  );
}
