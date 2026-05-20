export interface CleanerCSSConfig {
  includeGlobs: string[];
  excludeGlobs: string[];
  safelist: string[];
  safelistPatterns: string[];
  scanDynamicStrings: boolean;
  enableScssSupport: boolean;
  minConfidenceToRemove: number;
  preserveComments: boolean;
  historyLimit: number;
  historyRetentionDays: number;
  ignoreSelectors: string[];
  ignoreFiles: string[];
  frameworkHints: string[];
  cleanUncertainSelectors: boolean;
  maxDeletionRatioBeforeStrongConfirmation: number;
  analysisOutput: 'problems' | 'markdownReport' | 'ask';
  reviewMode: 'nativeDiff' | 'ask';
  mcpDefaultReviewMode: 'autoApply' | 'proposeOnly';
}

export const defaultCleanerCSSConfig: CleanerCSSConfig = {
  includeGlobs: ['**/*'],
  excludeGlobs: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/.nuxt/**', '**/.svelte-kit/**', '**/coverage/**', '**/.git/**', '**/.turbo/**', '**/.vercel/**', '**/.cache/**', '**/env/**', '**/venv/**', '**/.venv/**', '**/__pycache__/**', '**/.pytest_cache/**', '**/.mypy_cache/**'],
  safelist: [],
  safelistPatterns: ['^is-', '^has-', '^js-', '^swiper-', '^splide', '^tippy', '^modal-', '^toast-'],
  scanDynamicStrings: true,
  enableScssSupport: true,
  minConfidenceToRemove: 0.85,
  preserveComments: true,
  historyLimit: 25,
  historyRetentionDays: 2,
  ignoreSelectors: [':root', 'html', 'body', '*'],
  ignoreFiles: [],
  frameworkHints: ['react', 'next', 'vue', 'nuxt', 'svelte', 'astro', 'angular', 'vite'],
  cleanUncertainSelectors: false,
  maxDeletionRatioBeforeStrongConfirmation: 0.3,
  analysisOutput: 'problems',
  reviewMode: 'ask',
  mcpDefaultReviewMode: 'proposeOnly'
};
