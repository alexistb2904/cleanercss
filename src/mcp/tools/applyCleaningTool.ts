import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cleanStylesheet } from '../../core/cleaner';
import { HistoryStore } from '../../storage/historyStore';
import { SnapshotStore } from '../../storage/snapshotStore';
import type { CleanReport } from '../../types/analysis';
import type { CleanerCSSMcpReviewMode } from '../../review/reviewTypes';
import {
  assertCssOrScssFile,
  getStorageRoot,
  getWorkspaceRoot,
  isIgnoredPath,
  jsonResponse,
  loadMcpConfig,
  safeResolvePath,
  scanWorkspaceUsage,
  buildPatch,
  writeLastReport
} from '../mcpUtils';
import type { ApplyCleaningInput, ApplyCleaningResult } from '../mcpTypes';

export const applyCleaningSchema = z.object({
  filePath: z.string().min(1),
  workspaceRoot: z.string().min(1).optional(),
  mode: z.enum(['safe', 'aggressive']).optional(),
  reviewMode: z.enum(['autoApply', 'proposeOnly']).optional(),
  requireSnapshot: z.boolean().optional(),
  maxDeletionRatio: z.number().min(0).max(1).optional(),
  minConfidenceToRemove: z.number().min(0).max(1).optional(),
  includeUncertain: z.boolean().optional(),
  reason: z.string().max(1000).optional()
});

export async function handleApplyCleaning(input: ApplyCleaningInput): Promise<ApplyCleaningResult> {
  const warnings: string[] = [];
  const blockedReasons: string[] = [];
  let mode: 'safe' | 'aggressive' = input.mode ?? 'safe';
  let reviewMode: CleanerCSSMcpReviewMode = input.reviewMode ?? 'proposeOnly';
  let resolvedFilePath = input.filePath;
  let report: CleanReport | undefined;

  const blocked = (): ApplyCleaningResult => ({
    status: 'blocked',
    filePath: resolvedFilePath,
    reviewMode,
    originalLength: undefined,
    cleanedLength: undefined,
    report,
    warnings,
    blockedReasons,
    safety: safety(false, false, false, mode)
  });

  try {
    const workspaceRoot = getWorkspaceRoot(input.workspaceRoot, input.filePath);
    const { cleaner, mcp, warnings: configWarnings } = await loadMcpConfig(workspaceRoot);
    warnings.push(...configWarnings);
    mode = input.mode ?? mcp.defaultApplyMode;
    reviewMode = input.reviewMode ?? mcp.defaultReviewMode;

    if (!mcp.enableApplyTool) blockedReasons.push('cleanerCSS.mcp.enableApplyTool is false.');
    if (reviewMode !== 'proposeOnly' && input.requireSnapshot === false && mcp.requireSnapshotBeforeApply) blockedReasons.push('Snapshots are required before MCP apply operations.');
    if (input.includeUncertain && !mcp.allowCleaningUncertain) blockedReasons.push('Uncertain selector cleaning is disabled by cleanerCSS.mcp.allowCleaningUncertain.');
    if (mode === 'safe' && input.includeUncertain) blockedReasons.push('Safe mode cannot remove uncertain selector branches.');
    if (process.env.CLEANERCSS_WORKSPACE_TRUSTED === 'false') blockedReasons.push('Workspace is not trusted.');
    if (blockedReasons.length) return blocked();

    const filePath = await safeResolvePath(input.filePath, workspaceRoot);
    resolvedFilePath = filePath;
    assertCssOrScssFile(filePath);
    if (isIgnoredPath(filePath)) blockedReasons.push('File is in an ignored directory.');

    let originalText = '';
    try {
      originalText = await fs.readFile(filePath, 'utf8');
    } catch {
      blockedReasons.push('File does not exist or cannot be read.');
    }
    if (blockedReasons.length) return blocked();

    const usageIndex = await scanWorkspaceUsage(workspaceRoot, cleaner);
    warnings.push(...usageIndex.warnings);
    if (usageIndex.filesScanned.size === 0) blockedReasons.push('Workspace usage scan found no readable source files.');
    if (usageIndex.warnings.length > 0 || usageIndex.filesIgnored.size > 0) blockedReasons.push('Workspace scan is incomplete or unreliable.');

    const effectiveConfig = {
      ...cleaner,
      minConfidenceToRemove: input.minConfidenceToRemove ?? mcp.minConfidenceToRemove,
      cleanUncertainSelectors: Boolean(input.includeUncertain && mcp.allowCleaningUncertain && mode === 'aggressive')
    };
    const result = cleanStylesheet({ text: originalText, filePath, isScss: path.extname(filePath).toLowerCase() === '.scss', usageIndex, config: effectiveConfig });
    report = annotateMcpReport(result.report, mode, warnings);
    warnings.push(...report.warnings.filter(warning => !warnings.includes(warning)));
    await writeLastReport(getStorageRoot(workspaceRoot), report);

    const maxDeletionRatio = input.maxDeletionRatio ?? mcp.maxDeletionRatio;
    const changedCharacters = Math.abs(result.originalText.length - result.cleanedText.length);
    const patch = buildPatch(filePath, result.originalText, result.cleanedText);

    if (warnings.some(warning => warning.startsWith('Parsing failed:'))) blockedReasons.push('Parsing failed.');
    if (result.deletionRatio > maxDeletionRatio) blockedReasons.push(`Deletion ratio ${(result.deletionRatio * 100).toFixed(1)}% exceeds limit ${(maxDeletionRatio * 100).toFixed(1)}%.`);
    if (!result.hasChanges || changedCharacters === 0) blockedReasons.push('No useful safe cleanup was proposed.');
    if (result.cleanedText.trim().length === 0 && originalText.trim().length > 0) blockedReasons.push('Cleaned content is unexpectedly empty.');
    if (!input.includeUncertain && report.rules.some(rule => rule.removedSelectors.some(selector => rule.uncertainSelectors.includes(selector)))) {
      blockedReasons.push('CleanerCSS proposed removing uncertain selectors without explicit permission.');
    }
    if (reviewMode !== 'proposeOnly' && (input.requireSnapshot === false || !mcp.requireSnapshotBeforeApply)) blockedReasons.push('MCP apply requires snapshot protection.');
    if (blockedReasons.length) {
      return {
        ...blocked(),
        originalLength: result.originalText.length,
        cleanedLength: result.cleanedText.length,
        changedCharacters,
        removedRules: report.proposedRemovals,
        removedBranches: removedBranchCount(report),
        keptUncertainBranches: report.uncertainBranches,
        deletionRatio: result.deletionRatio,
        patch
      };
    }

    if (reviewMode === 'proposeOnly') {
      return {
        status: 'proposed',
        filePath,
        reviewMode,
        originalLength: result.originalText.length,
        cleanedLength: result.cleanedText.length,
        changedCharacters,
        removedRules: report.proposedRemovals,
        removedBranches: removedBranchCount(report),
        keptUncertainBranches: report.uncertainBranches,
        deletionRatio: result.deletionRatio,
        patch,
        report,
        warnings,
        safety: safety(false, false, false, mode)
      };
    }

    const storageRoot = getStorageRoot(workspaceRoot);
    const snapshotStore = new SnapshotStore(storageRoot);
    const historyStore = new HistoryStore(storageRoot, cleaner.historyLimit);
    const snapshot = await snapshotStore.create(filePath, originalText, result.cleanedText);
    if (!snapshot.id) {
      blockedReasons.push('Snapshot could not be created.');
      return blocked();
    }

    const historyEntryId = report.id;
    await historyStore.add({
      id: historyEntryId,
      createdAt: new Date().toISOString(),
      fileName: path.basename(filePath),
      filePath,
      relativePath: path.relative(workspaceRoot, filePath) || path.basename(filePath),
      charsChanged: changedCharacters,
      rulesRemoved: report.proposedRemovals,
      rulesKeptBecauseUncertain: report.uncertainBranches,
      snapshotId: snapshot.id,
      report,
      appliedBy: 'mcp',
      reason: input.reason
    });

    await fs.writeFile(filePath, result.cleanedText, 'utf8');

    return {
      status: 'applied',
      filePath,
      reviewMode,
      snapshotId: snapshot.id,
      historyEntryId,
      originalLength: result.originalText.length,
      cleanedLength: result.cleanedText.length,
      changedCharacters,
      removedRules: report.proposedRemovals,
      removedBranches: removedBranchCount(report),
      keptUncertainBranches: report.uncertainBranches,
      deletionRatio: result.deletionRatio,
      patch,
      report,
      warnings,
      safety: safety(true, Boolean(process.env.CLEANERCSS_GLOBAL_STORAGE_URI), true, mode)
    };
  } catch (error) {
    return {
      status: 'error',
      filePath: resolvedFilePath,
      reviewMode,
      report,
      warnings,
      error: String(error),
      safety: safety(false, false, false, mode)
    };
  }
}

export function registerApplyCleaningTool(server: McpServer): void {
  server.registerTool(
    'cleanercss_apply_cleaning',
    {
      title: 'Apply Safe CleanerCSS Cleanup',
      description: 'Analyze, snapshot, historize, and apply only safe CleanerCSS changes to a CSS/SCSS file.',
      inputSchema: applyCleaningSchema
    },
    async (input) => jsonResponse(await handleApplyCleaning(input))
  );
}

function removedBranchCount(report: CleanReport): number {
  return report.rules.reduce((total, rule) => total + rule.removedSelectors.length, 0);
}

function annotateMcpReport(report: CleanReport, mode: 'safe' | 'aggressive', warnings: string[]): CleanReport {
  return {
    ...report,
    warnings: [
      ...report.warnings,
      ...warnings,
      `Triggered by MCP in ${mode} mode. Changes are snapshot-backed and reversible from CleanerCSS history when shared storage is available.`
    ]
  };
}

function safety(snapshotCreated: boolean, reversibleFromActivityBar: boolean, appliedByMcp: boolean, mode: 'safe' | 'aggressive'): ApplyCleaningResult['safety'] {
  return {
    snapshotCreated,
    reversibleFromActivityBar,
    appliedByMcp,
    canUndoFromActivityBar: reversibleFromActivityBar,
    mode
  };
}
