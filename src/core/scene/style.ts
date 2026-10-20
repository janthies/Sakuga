// Colours, dashes and line weights as the canvas shows them, in mm. The look of Fig. 5.2 (fig_components.tex).
import { PALETTE } from '../model/colour';
import { PT } from '../text';
import type { Attrs, Prim, PrimKind } from './types';

export const LINE = 0.45 * PT;
export const STROKE = '#9e9e9e',
	ARROW = '#808080',
	ARROW_DASHED = '#a6a6a6',
	CODE = '#858585';

// TeX to display text: \cmd{x} shows x, \_ is an underscore. (Not core/text's show, which prepares text for measuring.)
export const display = (t: string): string =>
	t
		.replace(/(?<!\\)\$/g, '')
		.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
		.replace(/\\([_&%#$])/g, '$1');

export const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
export const n4 = (v: number) => String(r4(v));

// A primitive; numbers are rounded to 0.0001 mm and undefined attributes dropped.
export function prim(kind: PrimKind, key: string, attrs: Attrs, rest: Partial<Prim> = {}): Prim {
	const a: Attrs = {};
	for (const k in attrs) {
		const v = attrs[k];
		if (v !== undefined && v !== null) a[k] = typeof v === 'number' ? r4(v) : v;
	}
	return { key, kind, ...rest, attrs: a };
}

export function styleColor(key: string | undefined, fallback: string): string {
	if (key === 'none') return 'none';
	if (/^#[0-9a-f]{6}$/i.test(key || '')) return key!;
	if (key === 'black!25') return '#bfbfbf';
	const p = key ? PALETTE[key] : undefined;
	if (!p) return fallback;
	return `rgb(${[0, 2, 4].map((i) => Math.round((parseInt(p.hex.slice(i, i + 2), 16) * p.mix) / 100 + 255 * (1 - p.mix / 100))).join(',')})`;
}
export const weight = (st: any): number =>
	(st?.lineWidth ?? (({ medium: 0.8, thick: 1.2 } as Record<string, number>)[st?.weight] || 0.45)) * PT;
export const dash = (st: any): string =>
	st?.dashOn !== undefined
		? `${n4(st.dashOn * PT)} ${n4((st.dashOff ?? 3) * PT)}`
		: st?.border === 'dashed'
			? `${n4(3 * PT)} ${n4(3 * PT)}`
			: st?.border === 'dotted'
				? `${n4(weight(st))} ${n4(2 * PT)}`
				: 'none';
export const opacityOf = (layers: { id: string; opacity?: number }[], id: string | undefined) =>
	layers.find((l) => l.id === id)?.opacity ?? 1;
