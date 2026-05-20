import selectorParser, { type Node as SelectorNode, type Selector, type Pseudo } from 'postcss-selector-parser';
import type { SelectorBranch, SelectorToken } from '../types/selector';

const complexPseudo = new Set([':has', ':global', ':local']);
const nestedPseudo = new Set([':not', ':is', ':where']);

export function extractSelectorBranches(selector: string): SelectorBranch[] {
  const branches: SelectorBranch[] = [];
  const warnings: string[] = [];
  let root: selectorParser.Root | undefined;

  try {
    root = selectorParser().astSync(selector);
  } catch (error) {
    return [{ selector, tokens: [{ type: 'unknown', value: selector, raw: selector }], hasComplexPseudo: true, hasDynamicSyntax: true, hasScssNesting: selector.includes('&'), warnings: [`Selector parse failed: ${String(error)}`] }];
  }

  root.each((node) => {
    const sel = node as Selector;
    const branchText = sel.toString().trim();
    const branch: SelectorBranch = {
      selector: branchText,
      tokens: [],
      hasComplexPseudo: false,
      hasDynamicSyntax: /#\{|\$\{|%[A-Za-z_-]/.test(branchText),
      hasScssNesting: /(^|[\s>+~,(])&/.test(branchText),
      warnings: [...warnings]
    };

    walkSelector(sel, branch);
    branches.push(branch);
  });

  return branches;
}

function walkSelector(node: SelectorNode, branch: SelectorBranch): void {
  if (!('each' in node) || typeof node.each !== 'function') {
    return;
  }

  node.each((child: SelectorNode) => {
    switch (child.type) {
      case 'class':
        branch.tokens.push({ type: 'class', value: (child as any).value, raw: `.${(child as any).value}`, source: 'selector' });
        break;
      case 'id':
        branch.tokens.push({ type: 'id', value: (child as any).value, raw: `#${(child as any).value}`, source: 'selector' });
        break;
      case 'tag': {
        const value = (child as any).value;
        if (value && value !== '&') branch.tokens.push({ type: 'tag', value, raw: value, source: 'selector' });
        break;
      }
      case 'attribute': {
        const attr = child as any;
        const value = attr.attribute ?? attr.value ?? child.toString();
        branch.tokens.push({ type: 'attribute', value, raw: child.toString(), source: 'selector' });
        break;
      }
      case 'pseudo':
        handlePseudo(child as Pseudo, branch);
        break;
      default:
        walkSelector(child, branch);
    }
  });
}

function handlePseudo(pseudo: Pseudo, branch: SelectorBranch): void {
  const name = pseudo.value;
  branch.tokens.push({ type: 'pseudo', value: name, raw: pseudo.toString(), optional: true, source: 'selector' });

  if (complexPseudo.has(name)) {
    branch.hasComplexPseudo = true;
    branch.warnings.push(`${name} is treated as uncertain`);
    return;
  }

  if (nestedPseudo.has(name)) {
    try {
      pseudo.each?.((nested) => walkSelector(nested, branch));
    } catch {
      branch.hasComplexPseudo = true;
      branch.warnings.push(`${name} could not be analyzed safely`);
    }
    return;
  }

  if (pseudo.nodes && pseudo.nodes.length > 0) {
    branch.hasComplexPseudo = true;
    branch.warnings.push(`${name} contains nested selector syntax and is kept conservatively`);
  }
}

export function significantTokens(branch: SelectorBranch): SelectorToken[] {
  return branch.tokens.filter(token => token.type === 'class' || token.type === 'id' || token.type === 'attribute');
}
