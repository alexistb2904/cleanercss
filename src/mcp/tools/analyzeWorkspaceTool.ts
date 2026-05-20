import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cleanStylesheet } from '../../core/cleaner';
import {
  getWorkspaceRoot,
  jsonResponse,
  listStyleFiles,
  loadMcpConfig,
  scanWorkspaceUsage
} from '../mcpUtils';
import type { AnalyzeWorkspaceInput } from '../mcpTypes';

export const analyzeWorkspaceSchema = z.object({
  workspaceRoot: z.string().min(1)
});

export async function handleAnalyzeWorkspace(input: AnalyzeWorkspaceInput): Promise<unknown> {
  const warnings: string[] = [];
  try {
    const workspaceRoot = getWorkspaceRoot(input.workspaceRoot);
    const { cleaner, warnings: configWarnings } = await loadMcpConfig(workspaceRoot);
    warnings.push(...configWarnings);
    const usageIndex = await scanWorkspaceUsage(workspaceRoot, cleaner);
    const styleFiles = await listStyleFiles(workspaceRoot);
    const files = [];
    let totalRulesAnalyzed = 0;
    let totalUnusedBranches = 0;
    let totalUncertainBranches = 0;
    let totalRemovableCharacters = 0;

    for (const filePath of styleFiles) {
      try {
        const text = await fs.readFile(filePath, 'utf8');
        const result = cleanStylesheet({ text, filePath, isScss: path.extname(filePath).toLowerCase() === '.scss', usageIndex, config: cleaner });
        warnings.push(...result.report.warnings);
        totalRulesAnalyzed += result.report.totalRules;
        totalUnusedBranches += result.report.unusedBranches;
        totalUncertainBranches += result.report.uncertainBranches;
        totalRemovableCharacters += result.report.removableCharacters;
        if (result.hasChanges) {
          files.push({
            filePath,
            unusedBranches: result.report.unusedBranches,
            uncertainBranches: result.report.uncertainBranches,
            removableCharacters: result.report.removableCharacters
          });
        }
      } catch (error) {
        warnings.push(`Could not analyze ${filePath}: ${String(error)}`);
      }
    }

    return {
      status: 'success',
      summary: {
        cssFilesAnalyzed: styleFiles.length,
        filesWithProposedChanges: files.length,
        totalRulesAnalyzed,
        totalUnusedBranches,
        totalUncertainBranches,
        totalRemovableCharacters
      },
      files,
      warnings
    };
  } catch (error) {
    return { status: 'error', warnings, error: String(error) };
  }
}

export function registerAnalyzeWorkspaceTool(server: McpServer): void {
  server.registerTool(
    'cleanercss_analyze_workspace',
    {
      title: 'Analyze CSS/SCSS Workspace',
      description: 'Analyze all CSS/SCSS files in a workspace with CleanerCSS.',
      inputSchema: analyzeWorkspaceSchema
    },
    async (input) => jsonResponse(await handleAnalyzeWorkspace(input))
  );
}
