// Text widths and the wrapped title lines of a box, in mm (TeX points converted).
import type { NodeLike } from '../model/node';
import { ADV, type Family } from './advances';

export const PT = 25.4 / 72.27;
export const sizes: Record<string, number> = {
	tiny: 6,
	scriptsize: 8,
	footnotesize: 9,
	small: 10,
	normalsize: 10.95,
	large: 12,
};
export const smaller = (s: string): string =>
	(
		({
			tiny: 'tiny',
			scriptsize: 'tiny',
			footnotesize: 'scriptsize',
			small: 'footnotesize',
			normalsize: 'small',
			large: 'normalsize',
		}) as Record<string, string>
	)[s] || 'footnotesize';
export const show = (s: string): string =>
	(s || '')
		.replace(/\\\\\[[^\]]*\]/g, '\\\\')
		.replace(/\\([_&%#$])/g, '$1')
		.replace(/\\[a-zA-Z]+\*?/g, '')
		.replace(/[{}$^]/g, '')
		.replace(/ +/g, ' ');
export function mm(s: string, pt: number, family: Family = 'sans'): number {
	const f = ADV[family];
	let w = 0;
	for (const c of s) w += f.w[c] ?? f.upem * 0.55;
	return (w / f.upem) * pt * PT;
}
export const codeSize = (n: NodeLike, font = 'small'): string => n.codeFont || smaller(n.style?.font || font);
/** True when an icon sits left or right of the text and takes 4 mm of the line. */
const insetIcon = (n: NodeLike): boolean =>
	!!n.icon && n.icon !== 'none' && ['left', 'right'].includes(n.iconPosition || 'left');
export function need(n: NodeLike, font = 'small'): { width: number; content: string } {
	const pt = sizes[n.style?.font || font] || 10,
		inset = insetIcon(n) ? 4 : 0;
	let value = n.code ? mm(show(n.code), sizes[codeSize(n, font)], 'mono') + inset : 0,
		content = show(n.code);
	for (const word of n.title
		.replace(/\\\\\[[^\]]*\]/g, '\\\\')
		.split('\\\\')
		.flatMap((part: string) => show(part).split(/\s+/))) {
		const w = mm(word, pt) + (insetIcon(n) ? 4 : 0);
		if (w > value) {
			value = w;
			content = word;
		}
	}
	return { width: value, content };
}
export function actual(n: NodeLike, font = 'small'): number {
	if (n.kind) return n.width;
	return Math.max(n.wantWidth ?? n.width ?? 26, Math.ceil(need(n, font).width * 100) / 100);
}
export function normalize(n: NodeLike, font = 'small'): void {
	if (n.kind) return;
	if (n.codeFont && !sizes[n.codeFont]) delete n.codeFont;
	if (n.wantWidth !== undefined && !(Number.isFinite(n.wantWidth) && n.wantWidth > 0)) delete n.wantWidth;
	const wanted = n.wantWidth ?? n.width ?? 26;
	n.width = actual(n, font);
	if (Math.abs(n.width - wanted) > 0.00001) n.wantWidth = wanted;
	else delete n.wantWidth;
	if (n.codeFont === smaller(n.style?.font || font)) delete n.codeFont;
}
export function lines(n: NodeLike, font = 'small'): string[] {
	const out: string[] = [],
		pt = sizes[n.style?.font || font] || 10;
	for (const part of n.title.replace(/\\\\\[[^\]]*\]/g, '\\\\').split('\\\\')) {
		let line = '';
		for (const word of show(part).trim().split(/\s+/)) {
			const next = line ? line + ' ' + word : word;
			if (line && mm(next, pt) + (insetIcon(n) ? 4 : 0) > n.width * 0.97) {
				out.push(line);
				line = word;
			} else line = next;
		}
		out.push(line);
	}
	return out;
}
