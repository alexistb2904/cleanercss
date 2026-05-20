export type UsageKind =
  | 'html-class'
  | 'jsx-className'
  | 'vue-class'
  | 'angular-ngClass'
  | 'astro-class-list'
  | 'string-literal'
  | 'clsx'
  | 'css-module'
  | 'query-selector'
  | 'dom-api'
  | 'html-id'
  | 'attribute'
  | 'dynamic-pattern'
  | 'keyframes';

export interface UsageMatch {
  kind: UsageKind;
  value: string;
  file?: string;
  confidence: number;
  line?: number;
  excerpt?: string;
}

export interface UsageIndexSnapshot {
  classes: string[];
  ids: string[];
  tags: string[];
  attributes: string[];
  keyframes: string[];
  dynamicPrefixes: string[];
  dynamicContains: string[];
  filesScanned: string[];
  filesIgnored: string[];
  warnings: string[];
}
