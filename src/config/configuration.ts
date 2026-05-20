import * as vscode from 'vscode';
import { defaultCleanerCSSConfig, type CleanerCSSConfig } from '../types/config';

export function getCleanerCSSConfig(): CleanerCSSConfig {
  const cfg = vscode.workspace.getConfiguration('cleanerCSS');
  return {
    includeGlobs: cfg.get('includeGlobs', defaultCleanerCSSConfig.includeGlobs),
    excludeGlobs: cfg.get('excludeGlobs', defaultCleanerCSSConfig.excludeGlobs),
    safelist: cfg.get('safelist', defaultCleanerCSSConfig.safelist),
    safelistPatterns: cfg.get('safelistPatterns', defaultCleanerCSSConfig.safelistPatterns),
    scanDynamicStrings: cfg.get('scanDynamicStrings', defaultCleanerCSSConfig.scanDynamicStrings),
    enableScssSupport: cfg.get('enableScssSupport', defaultCleanerCSSConfig.enableScssSupport),
    minConfidenceToRemove: cfg.get('minConfidenceToRemove', defaultCleanerCSSConfig.minConfidenceToRemove),
    preserveComments: cfg.get('preserveComments', defaultCleanerCSSConfig.preserveComments),
    historyLimit: cfg.get('historyLimit', defaultCleanerCSSConfig.historyLimit),
    historyRetentionDays: cfg.get('historyRetentionDays', defaultCleanerCSSConfig.historyRetentionDays),
    ignoreSelectors: cfg.get('ignoreSelectors', defaultCleanerCSSConfig.ignoreSelectors),
    ignoreFiles: cfg.get('ignoreFiles', defaultCleanerCSSConfig.ignoreFiles),
    frameworkHints: cfg.get('frameworkHints', defaultCleanerCSSConfig.frameworkHints),
    cleanUncertainSelectors: cfg.get('cleanUncertainSelectors', defaultCleanerCSSConfig.cleanUncertainSelectors),
    maxDeletionRatioBeforeStrongConfirmation: cfg.get('maxDeletionRatioBeforeStrongConfirmation', defaultCleanerCSSConfig.maxDeletionRatioBeforeStrongConfirmation),
    analysisOutput: cfg.get('analysisOutput', defaultCleanerCSSConfig.analysisOutput),
    reviewMode: cfg.get('reviewMode', defaultCleanerCSSConfig.reviewMode),
    mcpDefaultReviewMode: cfg.get('mcp.defaultReviewMode', defaultCleanerCSSConfig.mcpDefaultReviewMode)
  };
}
