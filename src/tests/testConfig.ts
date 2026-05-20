import { defaultCleanerCSSConfig } from '../types/config';

export const testConfig = {
  ...defaultCleanerCSSConfig,
  safelistPatterns: ['^is-', '^has-', '^js-'],
  minConfidenceToRemove: 0.85,
  cleanUncertainSelectors: false
};
