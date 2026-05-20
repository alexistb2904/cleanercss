import type { UsageIndexSnapshot, UsageMatch } from '../types/usage';

export class UsageIndex {
  readonly classes = new Map<string, UsageMatch[]>();
  readonly ids = new Map<string, UsageMatch[]>();
  readonly tags = new Map<string, UsageMatch[]>();
  readonly attributes = new Map<string, UsageMatch[]>();
  readonly keyframes = new Map<string, UsageMatch[]>();
  readonly dynamicPrefixes = new Map<string, UsageMatch[]>();
  readonly dynamicContains = new Map<string, UsageMatch[]>();
  readonly filesScanned = new Set<string>();
  readonly filesIgnored = new Set<string>();
  readonly warnings: string[] = [];

  addClass(value: string, match: UsageMatch): void { this.add(this.classes, normalize(value), match); }
  addId(value: string, match: UsageMatch): void { this.add(this.ids, normalize(value), match); }
  addTag(value: string, match: UsageMatch): void { this.add(this.tags, value.toLowerCase(), match); }
  addAttribute(value: string, match: UsageMatch): void { this.add(this.attributes, normalizeAttribute(value), match); }
  addKeyframe(value: string, match: UsageMatch): void { this.add(this.keyframes, normalize(value), match); }
  addDynamicPrefix(value: string, match: UsageMatch): void { this.add(this.dynamicPrefixes, normalize(value), match); }
  addDynamicContains(value: string, match: UsageMatch): void { this.add(this.dynamicContains, normalize(value), match); }

  classMatches(value: string): UsageMatch[] { return this.classes.get(normalize(value)) ?? []; }
  idMatches(value: string): UsageMatch[] { return this.ids.get(normalize(value)) ?? []; }
  tagMatches(value: string): UsageMatch[] { return this.tags.get(value.toLowerCase()) ?? []; }
  attributeMatches(value: string): UsageMatch[] { return this.attributes.get(normalizeAttribute(value)) ?? []; }
  keyframeMatches(value: string): UsageMatch[] { return this.keyframes.get(normalize(value)) ?? []; }

  matchesDynamic(value: string): UsageMatch[] {
    const clean = normalize(value);
    const matches: UsageMatch[] = [];
    for (const [prefix, usages] of this.dynamicPrefixes.entries()) {
      if (prefix && clean.startsWith(prefix)) matches.push(...usages);
    }
    for (const [needle, usages] of this.dynamicContains.entries()) {
      if (needle && clean.includes(needle)) matches.push(...usages);
    }
    return matches;
  }

  snapshot(): UsageIndexSnapshot {
    return {
      classes: [...this.classes.keys()].sort(),
      ids: [...this.ids.keys()].sort(),
      tags: [...this.tags.keys()].sort(),
      attributes: [...this.attributes.keys()].sort(),
      keyframes: [...this.keyframes.keys()].sort(),
      dynamicPrefixes: [...this.dynamicPrefixes.keys()].sort(),
      dynamicContains: [...this.dynamicContains.keys()].sort(),
      filesScanned: [...this.filesScanned].sort(),
      filesIgnored: [...this.filesIgnored].sort(),
      warnings: [...this.warnings]
    };
  }

  private add(map: Map<string, UsageMatch[]>, value: string, match: UsageMatch): void {
    if (!value) return;
    const arr = map.get(value) ?? [];
    arr.push(match);
    map.set(value, arr);
  }
}

export function normalize(value: string): string {
  return value.trim().replace(/^\./, '').replace(/^#/, '');
}

export function normalizeAttribute(value: string): string {
  return value.trim().replace(/^\[/, '').replace(/\]$/, '').split('=')[0].trim();
}
