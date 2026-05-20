import type { CleanerCSSConfig } from '../types/config';
import type { UsageMatch } from '../types/usage';
import { UsageIndex } from './usageIndex';

export interface ScanTextOptions {
  file?: string;
  config: CleanerCSSConfig;
}

const classCandidate = /^-?[_a-zA-Z]+[_a-zA-Z0-9-:/.[\]()%]*$/;
const htmlTagCandidate = /<\s*([a-zA-Z][a-zA-Z0-9-]*)\b/g;
const htmlOrJsxTag = /<\s*[a-zA-Z][a-zA-Z0-9.-]*(?:\s+[\s\S]*?)?>/g;
const markupAttribute = /\s([:@]?[a-zA-Z_][\w:.-]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[\s\S]*?\}|[^\s>]+))?/g;
const attributeCandidate = /\b(data-[a-zA-Z0-9_-]+|aria-[a-zA-Z0-9_-]+)\s*(?:=|\b)/g;
const classAttr = /\b(?:class|className|:class|v-bind:class|ngClass|class:list)\s*=\s*(?:(['"`])([\s\S]*?)\1|\{([\s\S]*?)\})/g;
const idAttr = /\bid\s*=\s*(?:(['"])([\s\S]*?)\1|\{([\s\S]*?)\})/g;
const cssModuleAccess = /\b([A-Za-z_$][\w$]*)\s*(?:\.([A-Za-z_$][\w$-]*)|\[\s*(['"])([^'"]+)\3\s*\])/g;
const selectorCall = /\b(querySelector(?:All)?|closest|matches)\s*\(\s*(['"`])([\s\S]*?)\2\s*\)/g;
const byClass = /\bgetElementsByClassName\s*\(\s*(['"`])([\s\S]*?)\1\s*\)/g;
const byId = /\bgetElementById\s*\(\s*(['"`])([\s\S]*?)\1\s*\)/g;
const stringLiteral = /(['"`])([^'"`]{1,300})\1/g;
const templateLiteral = /`([\s\S]{0,1200}?)`/g;
const jsxTemplateClassAttr = /\b(?:class|className)\s*=\s*\{\s*`([\s\S]*?)`\s*\}/g;
const clsxCall = /\b(clsx|classnames|cn|cva|twMerge)\s*\(([^;]{0,1200})\)/g;
const cssAnimationProp = /\banimation(?:-name)?\s*[:=]\s*(['"]?)([A-Za-z_][\w-]*)\1/g;
const templateDynamicPrefix = /([A-Za-z_][\w-]*-)\$\{[^}]+\}/g;

export function scanTextForUsage(text: string, options: ScanTextOptions): UsageIndex {
  const index = new UsageIndex();
  scanIntoIndex(text, index, options);
  return index;
}

export function scanIntoIndex(text: string, index: UsageIndex, options: ScanTextOptions): void {
  const file = options.file;
  scanTags(text, index, file);
  scanAttributes(text, index, file);
  scanMarkupAttributes(text, index, file);
  scanJsxTemplateClassAttributes(text, index, file);
  scanClassAttributes(text, index, file);
  scanIds(text, index, file);
  scanCssModules(text, index, file);
  scanDomSelectorCalls(text, index, file);
  scanDomApis(text, index, file);
  scanClsx(text, index, file);
  scanAnimations(text, index, file);
  if (options.config.scanDynamicStrings) {
    scanStrings(text, index, file);
    scanTemplateLiterals(text, index, file);
    scanTemplatePatterns(text, index, file);
  }
}

function match(kind: UsageMatch['kind'], value: string, file: string | undefined, confidence: number, excerpt?: string): UsageMatch {
  return { kind, value, file, confidence, excerpt };
}

function scanTags(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(htmlTagCandidate)) {
    index.addTag(m[1], match('string-literal', m[1], file, 0.6, m[0]));
  }
}

function scanAttributes(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(attributeCandidate)) {
    index.addAttribute(m[1], match('attribute', m[1], file, 0.75, m[0]));
  }
}

function scanMarkupAttributes(text: string, index: UsageIndex, file?: string): void {
  for (const tag of text.matchAll(htmlOrJsxTag)) {
    for (const attr of tag[0].matchAll(markupAttribute)) {
      const name = attr[1];
      if (isUsageAttribute(name)) {
        index.addAttribute(name, match('attribute', name, file, 0.85, tag[0].slice(0, 180)));
      }
    }
  }
}

function isUsageAttribute(name: string): boolean {
  const normalized = name.replace(/^[:@]/, '');
  if (!normalized || normalized === 'class' || normalized === 'className' || normalized === 'id' || normalized === 'style') {
    return false;
  }
  return !/^on[A-Z]/.test(normalized);
}

function scanClassAttributes(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(classAttr)) {
    const name = m[0].slice(0, 30);
    const literal = m[2];
    const expression = m[3];
    if (literal !== undefined) {
      if (literal.includes('${')) {
        scanTemplatePatterns(literal, index, file);
        addDynamicTemplateClassTokens(literal, index, file, name.includes('ngClass') ? 'angular-ngClass' : name.includes('class:list') ? 'astro-class-list' : name.includes(':class') ? 'vue-class' : 'jsx-className', 0.65);
      }
      addClassTokens(literal, index, file, name.includes('className') ? 'jsx-className' : name.includes('ngClass') ? 'angular-ngClass' : name.includes('class:list') ? 'astro-class-list' : name.includes(':class') ? 'vue-class' : 'html-class', 1);
    }
    if (expression !== undefined) {
      extractStringClasses(expression, index, file, name.includes('ngClass') ? 'angular-ngClass' : 'jsx-className', 0.9);
      if (expression.includes('${') || expression.includes('`')) {
        addDynamicTemplateClassTokens(expression, index, file, name.includes('ngClass') ? 'angular-ngClass' : name.includes('class:list') ? 'astro-class-list' : name.includes(':class') ? 'vue-class' : 'jsx-className', 0.65);
      }
      scanTemplatePatterns(expression, index, file);
    }
  }
}

function scanJsxTemplateClassAttributes(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(jsxTemplateClassAttr)) {
    addStaticTemplateClassTokens(m[1], index, file, 'jsx-className', 0.95);
    scanTemplatePatterns(m[1], index, file);
  }
}

function scanIds(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(idAttr)) {
    const id = (m[2] ?? m[3] ?? '').trim();
    if (id && !id.includes('${')) index.addId(id, match('html-id', id, file, 1, m[0]));
  }
}

function scanCssModules(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(cssModuleAccess)) {
    const value = m[2] ?? m[4];
    const objectName = m[1];
    if (!value) continue;
    if (/^(styles|classes|css|s)$/i.test(objectName)) {
      index.addClass(value, match('css-module', value, file, 0.95, m[0]));
    }
  }
}

function scanDomSelectorCalls(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(selectorCall)) {
    const selector = m[3];
    for (const cls of selector.matchAll(/\.([_a-zA-Z][\w-]*)/g)) index.addClass(cls[1], match('query-selector', cls[1], file, 0.9, m[0]));
    for (const id of selector.matchAll(/#([_a-zA-Z][\w-]*)/g)) index.addId(id[1], match('query-selector', id[1], file, 0.9, m[0]));
    for (const attr of selector.matchAll(/\[\s*([a-zA-Z_][\w:-]*)/g)) index.addAttribute(attr[1], match('query-selector', attr[1], file, 0.8, m[0]));
  }
}

function scanDomApis(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(byClass)) addClassTokens(m[2], index, file, 'dom-api', 0.9);
  for (const m of text.matchAll(byId)) index.addId(m[2], match('dom-api', m[2], file, 0.95, m[0]));
}

function scanClsx(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(clsxCall)) {
    extractStringClasses(m[2], index, file, m[1] === 'classnames' ? 'clsx' : 'clsx', 0.9);
    for (const obj of m[2].matchAll(/([_a-zA-Z][\w-]*)\s*:/g)) {
      index.addClass(obj[1], match('clsx', obj[1], file, 0.9, m[0]));
    }
  }
}

function scanAnimations(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(cssAnimationProp)) {
    index.addKeyframe(m[2], match('keyframes', m[2], file, 0.8, m[0]));
  }
}

function scanStrings(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(stringLiteral)) {
    const raw = m[2];
    if (raw.includes('${')) continue;
    if (raw.includes(' ') || raw.includes('-') || raw.includes('_')) {
      addClassTokens(raw, index, file, 'string-literal', 0.8);
    }
  }
}

function scanTemplateLiterals(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(templateLiteral)) {
    addStaticTemplateClassTokens(m[1], index, file, 'string-literal', 0.75);
  }
}

function scanTemplatePatterns(text: string, index: UsageIndex, file?: string): void {
  for (const m of text.matchAll(templateDynamicPrefix)) {
    index.addDynamicPrefix(m[1], match('dynamic-pattern', m[1], file, 0.6, m[0]));
  }
  for (const m of text.matchAll(/([A-Za-z_][\w-]*-)\$\{/g)) {
    index.addDynamicPrefix(m[1], match('dynamic-pattern', m[1], file, 0.6, m[0]));
  }
  for (const m of text.matchAll(/\$\{[^}]+\}\s*([A-Za-z_][\w-]+)/g)) {
    index.addDynamicContains(m[1], match('dynamic-pattern', m[1], file, 0.55, m[0]));
  }
}

function addStaticTemplateClassTokens(raw: string, index: UsageIndex, file: string | undefined, kind: UsageMatch['kind'], confidence: number): void {
  const staticText = raw.replace(/\$\{[\s\S]*?\}/g, ' ');
  addClassTokens(staticText, index, file, kind, confidence);
}

function addDynamicTemplateClassTokens(raw: string, index: UsageIndex, file: string | undefined, kind: UsageMatch['kind'], confidence: number): void {
  const templateText = raw.trim().replace(/^`|`$/g, '').replace(/^['"]|['"]$/g, '');
  const staticText = templateText.replace(/\$\{[\s\S]*?\}/g, ' ');
  for (const token of staticText.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)) {
    if (classCandidate.test(token) && !token.startsWith('http') && !token.includes('=')) {
      index.addDynamicContains(token, match(kind, token, file, confidence, raw.slice(0, 180)));
    }
  }
}

function extractStringClasses(source: string, index: UsageIndex, file: string | undefined, kind: UsageMatch['kind'], confidence: number): void {
  for (const m of source.matchAll(/(['"`])([^'"`{}]{1,250})\1/g)) {
    addClassTokens(m[2], index, file, kind, confidence);
  }
  for (const m of source.matchAll(/([_a-zA-Z][\w-]*)\s*:/g)) {
    index.addClass(m[1], match(kind, m[1], file, Math.min(confidence, 0.9), m[0]));
  }
}

function addClassTokens(raw: string, index: UsageIndex, file: string | undefined, kind: UsageMatch['kind'], confidence: number): void {
  for (const token of raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)) {
    if (classCandidate.test(token) && !token.startsWith('http') && !token.includes('=')) {
      index.addClass(token, match(kind, token, file, confidence, raw.slice(0, 180)));
    }
  }
}
