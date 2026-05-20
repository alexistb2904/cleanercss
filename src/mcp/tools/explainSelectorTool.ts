import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeSelectorBranch } from '../../core/selectorBranchAnalyzer';
import { extractSelectorBranches } from '../../core/selectorExtractor';
import {
  getWorkspaceRoot,
  jsonResponse,
  loadMcpConfig,
  scanWorkspaceUsage
} from '../mcpUtils';
import type { ExplainSelectorInput, ExplainSelectorResult } from '../mcpTypes';

export const explainSelectorSchema = z.object({
  selector: z.string().min(1),
  filePath: z.string().min(1).optional(),
  workspaceRoot: z.string().min(1).optional()
});

export async function handleExplainSelector(input: ExplainSelectorInput): Promise<ExplainSelectorResult> {
  const workspaceRoot = getWorkspaceRoot(input.workspaceRoot, input.filePath);
  const { cleaner } = await loadMcpConfig(workspaceRoot);
  const usageIndex = await scanWorkspaceUsage(workspaceRoot, cleaner);
  const analyses = extractSelectorBranches(input.selector).map(branch => analyzeSelectorBranch(branch, usageIndex, cleaner));
  const status = analyses.every(analysis => analysis.status === 'unused')
    ? 'unused'
    : analyses.some(analysis => analysis.status === 'used')
      ? 'used'
      : 'uncertain';
  const confidence = analyses.length ? Math.min(...analyses.map(analysis => analysis.confidence)) : 0;
  const reasons = analyses.flatMap(analysis => analysis.reasons);
  const missingTokens = analyses.flatMap(analysis => analysis.missingTokens);
  const matchedUsages = analyses.flatMap(analysis => analysis.matchedUsages);

  return {
    selector: input.selector,
    status,
    confidence,
    filesExplored: usageIndex.filesScanned.size,
    reasons,
    missingTokens,
    matchedUsages,
    recommendation: recommendationFor(status)
  };
}

export function registerExplainSelectorTool(server: McpServer): void {
  server.registerTool(
    'cleanercss_explain_selector',
    {
      title: 'Explain CleanerCSS Selector Decision',
      description: 'Explain why CleanerCSS considers a selector used, unused, or uncertain.',
      inputSchema: explainSelectorSchema
    },
    async (input) => jsonResponse(await handleExplainSelector(input))
  );
}

function recommendationFor(status: 'used' | 'unused' | 'uncertain'): string {
  if (status === 'unused') return 'This selector can be removed only through the snapshot-backed apply tool.';
  if (status === 'used') return 'Keep this selector because CleanerCSS found usage evidence.';
  return 'Keep this selector unless you explicitly safelist or verify the dynamic usage manually.';
}
