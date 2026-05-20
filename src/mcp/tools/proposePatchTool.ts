import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cleanStylesheet } from '../../core/cleaner';
import {
  assertCssOrScssFile,
  buildPatch,
  getStorageRoot,
  getWorkspaceRoot,
  isIgnoredPath,
  jsonResponse,
  loadMcpConfig,
  safeResolvePath,
  scanWorkspaceUsage,
  writeLastReport
} from '../mcpUtils';
import type { ProposePatchInput } from '../mcpTypes';

export const proposePatchSchema = z.object({
  filePath: z.string().min(1),
  workspaceRoot: z.string().min(1).optional()
});

export async function handleProposePatch(input: ProposePatchInput): Promise<unknown> {
  const warnings: string[] = [];
  try {
    const workspaceRoot = getWorkspaceRoot(input.workspaceRoot, input.filePath);
    const filePath = await safeResolvePath(input.filePath, workspaceRoot);
    assertCssOrScssFile(filePath);
    if (isIgnoredPath(filePath)) throw new Error('File is in an ignored directory.');

    const { cleaner, warnings: configWarnings } = await loadMcpConfig(workspaceRoot);
    warnings.push(...configWarnings);
    const originalText = await fs.readFile(filePath, 'utf8');
    const usageIndex = await scanWorkspaceUsage(workspaceRoot, cleaner);
    const result = cleanStylesheet({ text: originalText, filePath, isScss: path.extname(filePath).toLowerCase() === '.scss', usageIndex, config: cleaner });
    warnings.push(...result.report.warnings);
    await writeLastReport(getStorageRoot(workspaceRoot), result.report);

    if (warnings.some(warning => warning.startsWith('Parsing failed:'))) {
      return {
        filePath,
        status: 'error',
        warnings,
        safety: { applied: false, requiresUserValidation: true, message: 'Parsing failed; no patch was produced.' },
        error: 'Parsing failed.'
      };
    }

    return {
      filePath,
      status: 'success',
      originalLength: result.originalText.length,
      cleanedLength: result.cleanedText.length,
      removableCharacters: result.report.removableCharacters,
      patch: result.hasChanges ? buildPatch(filePath, result.originalText, result.cleanedText) : '',
      cleanedContent: result.cleanedText,
      warnings,
      safety: {
        applied: false,
        requiresUserValidation: result.hasChanges,
        message: result.hasChanges ? 'Patch generated without modifying the file.' : 'No safe cleanup was proposed.'
      }
    };
  } catch (error) {
    return {
      filePath: input.filePath,
      status: 'error',
      warnings,
      safety: { applied: false, requiresUserValidation: true, message: 'CleanerCSS could not produce a patch.' },
      error: String(error)
    };
  }
}

export function registerProposePatchTool(server: McpServer): void {
  server.registerTool(
    'cleanercss_propose_patch',
    {
      title: 'Propose CleanerCSS Patch',
      description: 'Generate a conservative CleanerCSS patch for a CSS/SCSS file without applying it.',
      inputSchema: proposePatchSchema
    },
    async (input) => jsonResponse(await handleProposePatch(input))
  );
}
