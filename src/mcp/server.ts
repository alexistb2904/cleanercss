import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAnalyzeFileTool } from './tools/analyzeFileTool';
import { registerAnalyzeWorkspaceTool } from './tools/analyzeWorkspaceTool';
import { registerProposePatchTool } from './tools/proposePatchTool';
import { registerApplyCleaningTool } from './tools/applyCleaningTool';
import { registerExplainSelectorTool } from './tools/explainSelectorTool';
import { registerGetLastReportTool } from './tools/getLastReportTool';
import { registerGetHistoryTool } from './tools/getHistoryTool';
import { registerRevertSnapshotTool } from './tools/revertSnapshotTool';

export function createCleanerCssMcpServer(): McpServer {
  const server = new McpServer({
    name: 'CleanerCSS',
    version: '1.0.0'
  });

  registerAnalyzeFileTool(server);
  registerAnalyzeWorkspaceTool(server);
  registerProposePatchTool(server);
  registerApplyCleaningTool(server);
  registerExplainSelectorTool(server);
  registerGetLastReportTool(server);
  registerGetHistoryTool(server);
  registerRevertSnapshotTool(server);

  return server;
}

export async function startCleanerCssMcpServer(): Promise<void> {
  const server = createCleanerCssMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  startCleanerCssMcpServer().catch(error => {
    process.stderr.write(`CleanerCSS MCP server failed: ${String(error)}\n`);
    process.exit(1);
  });
}
