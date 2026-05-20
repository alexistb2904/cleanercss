import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { createCleanerCssMcpServer } from '../mcp/server';
import { safeResolvePath } from '../mcp/mcpUtils';
import { analyzeFileSchema } from '../mcp/tools/analyzeFileTool';
import { handleAnalyzeFile } from '../mcp/tools/analyzeFileTool';
import { handleProposePatch } from '../mcp/tools/proposePatchTool';
import { handleApplyCleaning } from '../mcp/tools/applyCleaningTool';
import { handleGetHistory } from '../mcp/tools/getHistoryTool';
import { handleRevertSnapshot } from '../mcp/tools/revertSnapshotTool';

let previousStorage: string | undefined;

afterEach(() => {
  if (previousStorage === undefined) {
    delete process.env.CLEANERCSS_GLOBAL_STORAGE_URI;
  } else {
    process.env.CLEANERCSS_GLOBAL_STORAGE_URI = previousStorage;
  }
});

describe('CleanerCSS MCP tools', () => {
  it('creates the MCP server without starting stdio', () => {
    const server = createCleanerCssMcpServer();
    expect(server.isConnected()).toBe(false);
  });

  it('validates Zod input', () => {
    expect(analyzeFileSchema.safeParse({ filePath: 'styles.css' }).success).toBe(true);
    expect(analyzeFileSchema.safeParse({ filePath: '' }).success).toBe(false);
  });

  it('refuses path traversal outside the workspace', async () => {
    const workspace = await tempWorkspace();
    await expect(safeResolvePath('../outside.css', workspace.root)).rejects.toThrow(/traversal/i);
  });

  it('refuses files in node_modules', async () => {
    const workspace = await tempWorkspace();
    const cssPath = path.join(workspace.root, 'node_modules', 'x.css');
    await fs.mkdir(path.dirname(cssPath), { recursive: true });
    await fs.writeFile(cssPath, '.unused { color: red; }', 'utf8');
    const result = await handleApplyCleaning({ filePath: cssPath, workspaceRoot: workspace.root });
    expect(result.status).toBe('blocked');
    expect(result.blockedReasons?.join(' ')).toMatch(/ignored directory/i);
  });

  it('analyzes a simple CSS file', async () => {
    const workspace = await tempWorkspace();
    const result = await handleAnalyzeFile({ filePath: workspace.cssPath, workspaceRoot: workspace.root }) as any;
    expect(result.status).toBe('success');
    expect(result.summary.rulesAnalyzed).toBe(1);
  });

  it('scans non-code workspace files for usage evidence', async () => {
    const workspace = await tempWorkspace('.from-readme { color: red; }');
    await fs.writeFile(path.join(workspace.root, 'notes.txt'), '<div class="from-readme"></div>', 'utf8');
    const result = await handleAnalyzeFile({ filePath: workspace.cssPath, workspaceRoot: workspace.root }) as any;
    expect(result.summary.scannedFiles).toBeGreaterThan(1);
    expect(result.report.rules[0].status).toBe('unchanged');
  });

  it('proposes a patch without applying it', async () => {
    const workspace = await tempWorkspace('.used, .unused { color: red; }');
    const before = await fs.readFile(workspace.cssPath, 'utf8');
    const result = await handleProposePatch({ filePath: workspace.cssPath, workspaceRoot: workspace.root }) as any;
    const after = await fs.readFile(workspace.cssPath, 'utf8');
    expect(result.status).toBe('success');
    expect(result.patch).toContain('-.used, .unused');
    expect(after).toBe(before);
  });

  it('proposes by default without modifying the file', async () => {
    const workspace = await tempWorkspace('.used, .unused { color: red; }');
    const before = await fs.readFile(workspace.cssPath, 'utf8');
    const result = await handleApplyCleaning({ filePath: workspace.cssPath, workspaceRoot: workspace.root, maxDeletionRatio: 0.9 });
    const after = await fs.readFile(workspace.cssPath, 'utf8');
    expect(result.status).toBe('proposed');
    expect(result.patch).toContain('-.used, .unused');
    expect(after).toBe(before);
  });

  it('autoApply creates a snapshot and MCP history', async () => {
    const workspace = await tempWorkspace('.used, .unused { color: red; }');
    const result = await handleApplyCleaning({ filePath: workspace.cssPath, workspaceRoot: workspace.root, maxDeletionRatio: 0.9, reviewMode: 'autoApply' });
    const after = await fs.readFile(workspace.cssPath, 'utf8');
    expect(result.status).toBe('applied');
    expect(result.reviewSessionId).toBeUndefined();
    expect(result.snapshotId).toBeTruthy();
    expect(after).toContain('.used');
    expect(after).not.toContain('.unused');

    const history = await handleGetHistory({ limit: 10 }) as any;
    expect(history.entries[0].appliedBy).toBe('mcp');
  });

  it('proposeOnly returns a patch without modifying the file', async () => {
    const workspace = await tempWorkspace('.used, .unused { color: red; }');
    const before = await fs.readFile(workspace.cssPath, 'utf8');
    const result = await handleApplyCleaning({ filePath: workspace.cssPath, workspaceRoot: workspace.root, maxDeletionRatio: 0.9, reviewMode: 'proposeOnly' });
    const after = await fs.readFile(workspace.cssPath, 'utf8');
    expect(result.status).toBe('proposed');
    expect(result.patch).toContain('-.used, .unused');
    expect(after).toBe(before);
  });

  it('blocks apply when deletion ratio is too high', async () => {
    const workspace = await tempWorkspace('.unused { color: red; padding: 10px; margin: 10px; }');
    const result = await handleApplyCleaning({ filePath: workspace.cssPath, workspaceRoot: workspace.root, maxDeletionRatio: 0.01 });
    expect(result.status).toBe('blocked');
    expect(result.blockedReasons?.join(' ')).toMatch(/Deletion ratio/i);
  });

  it('blocks apply on parsing errors', async () => {
    const workspace = await tempWorkspace('.unused { color: red;');
    const result = await handleApplyCleaning({ filePath: workspace.cssPath, workspaceRoot: workspace.root, maxDeletionRatio: 0.9 });
    expect(result.status).toBe('blocked');
    expect(result.blockedReasons?.join(' ')).toMatch(/Parsing failed/i);
  });

  it('keeps uncertain branches by default', async () => {
    const workspace = await tempWorkspace('.unused, .is-open { color: red; }');
    const result = await handleApplyCleaning({ filePath: workspace.cssPath, workspaceRoot: workspace.root, maxDeletionRatio: 0.9, reviewMode: 'autoApply' });
    const after = await fs.readFile(workspace.cssPath, 'utf8');
    expect(result.status).toBe('applied');
    expect(after).toContain('.is-open');
    expect(after).not.toContain('.unused');
  });

  it('restores from a snapshot and refuses unknown snapshots', async () => {
    const workspace = await tempWorkspace('.used, .unused { color: red; }');
    const applied = await handleApplyCleaning({ filePath: workspace.cssPath, workspaceRoot: workspace.root, maxDeletionRatio: 0.9, reviewMode: 'autoApply' });
    expect(applied.status).toBe('applied');

    const restored = await handleRevertSnapshot({ snapshotId: applied.snapshotId!, workspaceRoot: workspace.root }) as any;
    const afterRestore = await fs.readFile(workspace.cssPath, 'utf8');
    expect(restored.status).toBe('restored');
    expect(afterRestore).toContain('.unused');

    const missing = await handleRevertSnapshot({ snapshotId: 'snapshot-missing', workspaceRoot: workspace.root }) as any;
    expect(missing.status).toBe('error');
  });
});

async function tempWorkspace(css = '.used { color: red; }'): Promise<{ root: string; cssPath: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanercss-mcp-'));
  previousStorage = process.env.CLEANERCSS_GLOBAL_STORAGE_URI;
  process.env.CLEANERCSS_GLOBAL_STORAGE_URI = path.join(root, '.storage');
  await fs.writeFile(path.join(root, 'index.html'), '<div class="used"></div>', 'utf8');
  const cssPath = path.join(root, 'styles.css');
  await fs.writeFile(cssPath, css, 'utf8');
  return { root, cssPath };
}
