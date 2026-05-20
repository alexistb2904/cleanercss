import postcss, { type Root } from 'postcss';
import scss from 'postcss-scss';

export function parseScss(text: string, from?: string): Root {
  return scss.parse(text, { from }) as Root;
}
