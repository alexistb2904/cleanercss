import postcss, { type Root } from 'postcss';

export function parseCss(text: string, from?: string): Root {
  return postcss.parse(text, { from });
}
