import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createPatch } from 'diff';
import { defaultCleanerCSSConfig, type CleanerCSSConfig } from '../types/config';
import { UsageIndex } from '../core/usageIndex';
import { scanIntoIndex } from '../core/usageScanner';
import type { CleanReport } from '../types/analysis';
import type { CleanerMcpConfig, McpToolResult } from './mcpTypes';

const styleExtensions = new Set(['.css', '.scss']);
const ignoredSegments = new Set(['node_modules', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage', '.git', '.turbo', '.vercel', '.cache', 'env', 'venv', '.venv', '__pycache__', '.pytest_cache', '.mypy_cache']);
const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.gz', '.tar', '.rar', '.7z', '.pdf',
  '.mp3', '.mp4', '.mov', '.avi', '.webm', '.wav',
  '.exe', '.dll', '.so', '.dylib', '.wasm'
]);

export function jsonResponse(result: unknown): McpToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

export function jsonError(message: string, extra: Record<string, unknown> = {}): McpToolResult {
  return jsonResponse({ status: 'error', error: message, ...extra });
}

export async function safeResolvePath(filePath: string, workspaceRoot?: string): Promise<string> {
  if (!filePath || filePath.includes('\0')) {
    throw new Error('Invalid file path.');
  }
  if (hasTraversal(filePath)) {
    throw new Error('Path traversal is not allowed.');
  }

  const root = workspaceRoot ? path.resolve(workspaceRoot) : undefined;
  const resolved = path.resolve(root ?? process.cwd(), filePath);
  const real = await realpathIfExists(resolved);

  if (root && !isPathInsideWorkspace(real, root)) {
    throw new Error('File is outside workspaceRoot.');
  }

  return real;
}

export function isPathInsideWorkspace(filePath: string, workspaceRoot: string): boolean {
  const relative = path.relative(path.resolve(workspaceRoot), path.resolve(filePath));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

export function isIgnoredPath(filePath: string): boolean {
  return path.normalize(filePath).split(path.sep).some(segment => ignoredSegments.has(segment.toLowerCase()));
}

export function assertCssOrScssFile(filePath: string): void {
  if (!styleExtensions.has(path.extname(filePath).toLowerCase())) {
    throw new Error('Only .css and .scss files are supported.');
  }
}

export async function loadMcpConfig(workspaceRoot?: string): Promise<{ cleaner: CleanerCSSConfig; mcp: CleanerMcpConfig; warnings: string[] }> {
  const warnings: string[] = [];
  const settings = workspaceRoot ? await readWorkspaceSettings(workspaceRoot, warnings) : {};
  const cleaner: CleanerCSSConfig = {
    ...defaultCleanerCSSConfig,
    includeGlobs: readSetting(settings, 'cleanerCSS.includeGlobs', defaultCleanerCSSConfig.includeGlobs),
    excludeGlobs: readSetting(settings, 'cleanerCSS.excludeGlobs', defaultCleanerCSSConfig.excludeGlobs),
    safelist: readSetting(settings, 'cleanerCSS.safelist', defaultCleanerCSSConfig.safelist),
    safelistPatterns: readSetting(settings, 'cleanerCSS.safelistPatterns', defaultCleanerCSSConfig.safelistPatterns),
    scanDynamicStrings: readSetting(settings, 'cleanerCSS.scanDynamicStrings', defaultCleanerCSSConfig.scanDynamicStrings),
    enableScssSupport: readSetting(settings, 'cleanerCSS.enableScssSupport', defaultCleanerCSSConfig.enableScssSupport),
    minConfidenceToRemove: readSetting(settings, 'cleanerCSS.minConfidenceToRemove', defaultCleanerCSSConfig.minConfidenceToRemove),
    preserveComments: readSetting(settings, 'cleanerCSS.preserveComments', defaultCleanerCSSConfig.preserveComments),
    historyLimit: readSetting(settings, 'cleanerCSS.historyLimit', defaultCleanerCSSConfig.historyLimit),
    ignoreSelectors: readSetting(settings, 'cleanerCSS.ignoreSelectors', defaultCleanerCSSConfig.ignoreSelectors),
    ignoreFiles: readSetting(settings, 'cleanerCSS.ignoreFiles', defaultCleanerCSSConfig.ignoreFiles),
    frameworkHints: readSetting(settings, 'cleanerCSS.frameworkHints', defaultCleanerCSSConfig.frameworkHints),
    cleanUncertainSelectors: readSetting(settings, 'cleanerCSS.cleanUncertainSelectors', defaultCleanerCSSConfig.cleanUncertainSelectors),
    maxDeletionRatioBeforeStrongConfirmation: readSetting(settings, 'cleanerCSS.maxDeletionRatioBeforeStrongConfirmation', defaultCleanerCSSConfig.maxDeletionRatioBeforeStrongConfirmation),
    analysisOutput: readSetting(settings, 'cleanerCSS.analysisOutput', defaultCleanerCSSConfig.analysisOutput),
    reviewMode: readSetting(settings, 'cleanerCSS.reviewMode', defaultCleanerCSSConfig.reviewMode),
    mcpDefaultReviewMode: readSetting(settings, 'cleanerCSS.mcp.defaultReviewMode', defaultCleanerCSSConfig.mcpDefaultReviewMode)
  };

  const mcp: CleanerMcpConfig = {
    enableApplyTool: readSetting(settings, 'cleanerCSS.mcp.enableApplyTool', readBoolEnv('CLEANERCSS_MCP_ENABLE_APPLY_TOOL', true)),
    enableRevertTool: readSetting(settings, 'cleanerCSS.mcp.enableRevertTool', readBoolEnv('CLEANERCSS_MCP_ENABLE_REVERT_TOOL', true)),
    defaultApplyMode: readSetting(settings, 'cleanerCSS.mcp.defaultApplyMode', 'safe'),
    maxDeletionRatio: readSetting(settings, 'cleanerCSS.mcp.maxDeletionRatio', readNumberEnv('CLEANERCSS_MCP_MAX_DELETION_RATIO', 0.3)),
    minConfidenceToRemove: readSetting(settings, 'cleanerCSS.mcp.minConfidenceToRemove', readNumberEnv('CLEANERCSS_MCP_MIN_CONFIDENCE_TO_REMOVE', 0.85)),
    allowCleaningUncertain: readSetting(settings, 'cleanerCSS.mcp.allowCleaningUncertain', readBoolEnv('CLEANERCSS_MCP_ALLOW_CLEANING_UNCERTAIN', false)),
    requireSnapshotBeforeApply: readSetting(settings, 'cleanerCSS.mcp.requireSnapshotBeforeApply', readBoolEnv('CLEANERCSS_MCP_REQUIRE_SNAPSHOT_BEFORE_APPLY', true)),
    defaultReviewMode: readSetting(settings, 'cleanerCSS.mcp.defaultReviewMode', 'proposeOnly')
  };

  return { cleaner, mcp, warnings };
}

export function getWorkspaceRoot(inputRoot: string | undefined, filePath?: string): string {
  if (inputRoot) return path.resolve(inputRoot);
  if (process.env.CLEANERCSS_WORKSPACE_ROOT) return path.resolve(process.env.CLEANERCSS_WORKSPACE_ROOT);
  if (filePath) return path.dirname(path.resolve(filePath));
  return process.cwd();
}

export function getStorageRoot(workspaceRoot?: string): string {
  if (process.env.CLEANERCSS_GLOBAL_STORAGE_URI) {
    return process.env.CLEANERCSS_GLOBAL_STORAGE_URI;
  }
  return path.join(workspaceRoot ?? process.cwd(), '.cleanercss');
}

export async function scanWorkspaceUsage(workspaceRoot: string, config: CleanerCSSConfig): Promise<UsageIndex> {
  const index = new UsageIndex();
  const files = await listFiles(workspaceRoot, shouldReadTextPath);
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      if (stat.size > 1_500_000) {
        index.filesIgnored.add(file);
        continue;
      }
      const text = await fs.readFile(file, 'utf8');
      if (looksBinary(text)) {
        index.filesIgnored.add(file);
        continue;
      }
      index.filesScanned.add(file);
      scanIntoIndex(text, index, { file, config });
    } catch (error) {
      index.filesIgnored.add(file);
      index.warnings.push(`Could not read ${file}: ${String(error)}`);
    }
  }
  return index;
}

export async function listStyleFiles(workspaceRoot: string): Promise<string[]> {
  return listFiles(workspaceRoot, filePath => styleExtensions.has(path.extname(filePath).toLowerCase()));
}

export function buildPatch(filePath: string, originalText: string, cleanedText: string): string {
  return createPatch(filePath, originalText, cleanedText, 'original', 'cleaned');
}

export function summarizeReport(report: CleanReport): {
  rulesAnalyzed: number;
  branchesAnalyzed: number;
  usedBranches: number;
  unusedBranches: number;
  uncertainBranches: number;
  removableCharacters: number;
  scannedFiles: number;
  ignoredFiles: number;
} {
  return {
    rulesAnalyzed: report.totalRules,
    branchesAnalyzed: report.totalBranches,
    usedBranches: report.usedBranches,
    unusedBranches: report.unusedBranches,
    uncertainBranches: report.uncertainBranches,
    removableCharacters: report.removableCharacters,
    scannedFiles: report.filesScanned.length,
    ignoredFiles: report.filesIgnored.length
  };
}

export async function writeLastReport(storageRoot: string, report: CleanReport): Promise<void> {
  await fs.mkdir(storageRoot, { recursive: true });
  await fs.writeFile(path.join(storageRoot, 'lastReport.json'), JSON.stringify(report, null, 2), 'utf8');
}

export async function readLastReport(storageRoot: string): Promise<CleanReport | undefined> {
  try {
    return JSON.parse(await fs.readFile(path.join(storageRoot, 'lastReport.json'), 'utf8')) as CleanReport;
  } catch {
    return undefined;
  }
}

async function listFiles(root: string, accept: (filePath: string) => boolean): Promise<string[]> {
  const results: string[] = [];
  const resolvedRoot = path.resolve(root);

  async function visit(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (isIgnoredPath(fullPath)) continue;
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && accept(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  await visit(resolvedRoot);
  return results.sort();
}

async function realpathIfExists(filePath: string): Promise<string> {
  try {
    return await fs.realpath(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

function hasTraversal(filePath: string): boolean {
  return filePath.split(/[\\/]+/).some(segment => segment === '..');
}

async function readWorkspaceSettings(workspaceRoot: string, warnings: string[]): Promise<Record<string, unknown>> {
  const settingsPath = path.join(workspaceRoot, '.vscode', 'settings.json');
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(stripJsonComments(raw)) as Record<string, unknown>;
  } catch (error: any) {
    if (error?.code !== 'ENOENT') warnings.push(`Could not read ${settingsPath}: ${String(error)}`);
    return {};
  }
}

function readSetting<T>(settings: Record<string, unknown>, key: string, fallback: T): T {
  const value = settings[key];
  return value === undefined ? fallback : value as T;
}

function readBoolEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function readNumberEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stripJsonComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

function shouldReadTextPath(filePath: string): boolean {
  return !binaryExtensions.has(path.extname(filePath).toLowerCase());
}

function looksBinary(text: string): boolean {
  return text.includes('\0');
}
