# CleanerCSS - Safe, conservative unused CSS remover

CleanerCSS helps you safely detect and remove unused selectors from CSS and SCSS files without breaking your app. It uses workspace-wide usage scanning, conservative heuristics for frameworks and dynamic classes, and always shows a native VS Code diff preview before writing changes.

Key points:

- Conservative by design: uncertain or dynamic selectors are preserved by default.
- Native VS Code diff preview and WorkspaceEdit application - you always review before changes.
- Local snapshots and history for safe rollback.
- Configurable safelists, framework hints and scanning options.

## Visual Editor & Revert your changes 
<img width="800" height="450" alt="2026-05-2021-48-35-ezgif com-video-to-gif-converter (1)" src="https://github.com/user-attachments/assets/c1141b55-d836-461d-9c65-737c296158c5" />

<img width="600" height="337" alt="2026-05-2021-49-38-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/5847f2d0-dcf3-46a4-a2a7-ddf4707be1b4" />

## Quick start

1. Open any `.css` or `.scss` file in your workspace.
2. Run the command `CleanerCSS: Clean Current File` from the Command Palette.
3. Review the native VS Code diff. Apply to write changes (a snapshot is taken automatically) or export a patch.

## Features

- Workspace scanning for selector usage (includes JS/TS/HTML and simple template strings).
- Conservative SCSS support via `postcss-scss` with safeguards for complex constructs.
- Branch-level selector analysis (handles comma-separated lists safely).
- Safelists and regex patterns to protect dynamic classes (e.g. `^js-`, `^is-`, `^has-`).
- Activity Bar view: CleanerCSS History with snapshots and restore.
- MCP (Model Context Protocol) server tools for automated analysis in CI or agent workflows.

## Commands

- `cleanerCSS.cleanCurrentFile` - Clean the active CSS/SCSS file (opens diff preview).
- `cleanerCSS.analyzeCurrentFile` - Run analysis and show results (Problems, report, or ask).
- `cleanerCSS.cleanWorkspace` - Run cleanup across the workspace (reviewable patches).
- `cleanerCSS.openHistory` - Open local history of CleanerCSS snapshots.
- `cleanerCSS.restoreFromHistory` - Restore a saved snapshot.
- `cleanerCSS.openSettings` - Open CleanerCSS settings.

## Configuration highlights

Configure behaviour under the `cleanerCSS.*` settings. Important ones:

- `cleanerCSS.safelist` / `cleanerCSS.safelistPatterns` - never-remove selectors.
- `cleanerCSS.enableScssSupport` - enable conservative SCSS parsing.
- `cleanerCSS.minConfidenceToRemove` - confidence threshold before proposing removals.
- `cleanerCSS.analysisOutput` - where analysis results appear (`problems`, `markdownReport`, `ask`).

See `package.json` for the full configuration schema.

## Privacy and safety

CleanerCSS runs locally. It does not send your code to external servers, does not collect telemetry, and always creates local snapshots before applying any change.

## Development

Install, compile and run tests:

```bash
npm install
npm run compile
npm test
```

Package the extension:

```bash
npm run package
```

## License

MIT - see the `LICENSE` file.
