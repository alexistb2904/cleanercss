import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getStorageRoot, getWorkspaceRoot, jsonResponse, readLastReport } from '../mcpUtils';

export const getLastReportSchema = z.object({});

export async function handleGetLastReport(): Promise<unknown> {
  try {
    const workspaceRoot = getWorkspaceRoot(undefined);
    const report = await readLastReport(getStorageRoot(workspaceRoot));
    if (!report) return { status: 'not_found' };
    return { status: 'success', report };
  } catch (error) {
    return { status: 'error', error: String(error) };
  }
}

export function registerGetLastReportTool(server: McpServer): void {
  server.registerTool(
    'cleanercss_get_last_report',
    {
      title: 'Get Last CleanerCSS Report',
      description: 'Return the last CleanerCSS report stored by the extension or MCP server.',
      inputSchema: getLastReportSchema
    },
    async () => jsonResponse(await handleGetLastReport())
  );
}
