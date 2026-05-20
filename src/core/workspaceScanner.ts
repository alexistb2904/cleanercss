import * as vscode from 'vscode';
import type { CleanerCSSConfig } from '../types/config';
import { UsageIndex } from './usageIndex';
import { scanIntoIndex } from './usageScanner';

export class WorkspaceUsageScanner {
  private cached?: { key: string; index: UsageIndex; createdAt: number };

  invalidate(): void {
    this.cached = undefined;
  }

  async scan(config: CleanerCSSConfig, progress?: vscode.Progress<{ message?: string; increment?: number }>, token?: vscode.CancellationToken): Promise<UsageIndex> {
    const key = JSON.stringify({ include: config.includeGlobs, exclude: [...config.excludeGlobs, ...config.ignoreFiles], dynamic: config.scanDynamicStrings });
    if (this.cached?.key === key) return this.cached.index;

    const index = new UsageIndex();
    const exclude = `{${[...config.excludeGlobs, ...config.ignoreFiles].join(',')}}`;
    const includeGlobs = config.includeGlobs.length ? config.includeGlobs : ['**/*'];

    for (const include of includeGlobs) {
      if (token?.isCancellationRequested) break;
      const uris = await vscode.workspace.findFiles(include, exclude, 5000);
      for (const uri of uris) {
        if (token?.isCancellationRequested) break;
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (!shouldReadTextFile(uri.fsPath, stat.size)) {
            index.filesIgnored.add(uri.fsPath);
            continue;
          }
          const bytes = await vscode.workspace.fs.readFile(uri);
          const text = Buffer.from(bytes).toString('utf8');
          if (looksBinary(text)) {
            index.filesIgnored.add(uri.fsPath);
            continue;
          }
          index.filesScanned.add(uri.fsPath);
          scanIntoIndex(text, index, { file: uri.fsPath, config });
          progress?.report({ message: `Scanning ${vscode.workspace.asRelativePath(uri)}` });
        } catch (error) {
          index.filesIgnored.add(uri.fsPath);
          index.warnings.push(`Could not read ${uri.fsPath}: ${String(error)}`);
        }
      }
    }

    this.cached = { key, index, createdAt: Date.now() };
    return index;
  }
}

const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.gz', '.tar', '.rar', '.7z', '.pdf',
  '.mp3', '.mp4', '.mov', '.avi', '.webm', '.wav',
  '.exe', '.dll', '.so', '.dylib', '.wasm'
]);

function shouldReadTextFile(filePath: string, size: number): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (binaryExtensions.has(ext)) return false;
  return size <= 1_500_000;
}

function looksBinary(text: string): boolean {
  return text.includes('\0');
}
