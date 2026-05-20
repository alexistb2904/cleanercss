import { startCleanerCssMcpServer } from './mcp/server';

startCleanerCssMcpServer().catch(error => {
  process.stderr.write(`CleanerCSS MCP server failed: ${String(error)}\n`);
  process.exit(1);
});
