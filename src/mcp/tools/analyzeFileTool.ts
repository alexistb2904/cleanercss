import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cleanStylesheet } from '../../core/cleaner';
import {
  assertCssOrScssFile,
  getStorageRoot,
  getWorkspaceRoot,
  isIgnoredPath,
  jsonResponse,
  loadMcpConfig,
  safeResolvePath,
  scanWorkspaceUsage,
  summarizeReport,
  writeLastReport
} from '../mcpUtils';
import type { AnalyzeFileInput } from '../mcpTypes';

export const analyzeFileSchema = z.object({
  filePath: z.string().min(1),
  workspaceRoot: z.string().min(1).optional()
});

export async function handleAnalyzeFile(input: AnalyzeFileInput): Promise<unknown> {
  const warnings: string[] = [];
  try {
    const workspaceRoot = getWorkspaceRoot(input.workspaceRoot, input.filePath);
    const filePath = await safeResolvePath(input.filePath, workspaceRoot);
    assertCssOrScssFile(filePath);
    if (isIgnoredPath(filePath)) throw new Error('File is in an ignored directory.');

    const { cleaner, warnings: configWarnings } = await loadMcpConfig(workspaceRoot);
    warnings.push(...configWarnings);
    const text = await fs.readFile(filePath, 'utf8');
    const usageIndex = await scanWorkspaceUsage(workspaceRoot, cleaner);
    const result = cleanStylesheet({ text, filePath, isScss: path.extname(filePath).toLowerCase() === '.scss', usageIndex, config: cleaner });
    warnings.push(...result.report.warnings);
    await writeLastReport(getStorageRoot(workspaceRoot), result.report);

    return {
      filePath,
      status: warnings.some(warning => warning.startsWith('Parsing failed:')) ? 'error' : 'success',
      report: result.report,
      summary: summarizeReport(result.report),
      warnings,
      error: warnings.some(warning => warning.startsWith('Parsing failed:')) ? 'Parsing failed.' : undefined
    };
  } catch (error) {
    return { filePath: input.filePath, status: 'error', warnings, error: String(error) };
  }
}

export function registerAnalyzeFileTool(server: McpServer): void {
  server.registerTool(
    'cleanercss_analyze_file',
    {
      title: 'Analyze CSS/SCSS File',
      description: 'Analyze a CSS/SCSS file with CleanerCSS and return a structured report.',
      inputSchema: analyzeFileSchema
    },
    async (input) => jsonResponse(await handleAnalyzeFile(input))
  );
}
