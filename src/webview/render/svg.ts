import { borderPoint } from '../../core/geometry/route';
import { cssFill, darkerColor } from '../../core/model/colour';
import { store } from '../store/store';
import { byId, catOf, fontPt, layout, textMm } from '../store/model';
import { NS, show } from '../store/constants';
import type { Box, ViewNode } from '../store/types';

export function el(tag: string, attrs: Record<string, string | number>, parent?: Element) {
	const e = document.createElementNS(NS, tag);
	for (const k in attrs) {
		e.setAttribute(k, String(attrs[k]));
	}
	if (parent) {
		parent.appendChild(e);
	}
	return e;
}
// Point on the border of n in the direction of (tx, ty), as TikZ does for (a) -- (b).
export function border(n: ViewNode, tx: number, ty: number) {
	return borderPoint({ ...n, ...layout(n) }, [tx, ty]);
}
export function bbox(): Box {
	const ids = store.nodes.filter((n) => !n.hidden).map((n) => n.id);
	return ids.length ? selBox(ids) : { x0: 0, x1: 0, y0: 0, y1: 0 };
}
export function selBox(ids: string[]): Box {
	const b = ids
		.map((id) => byId(id))
		.filter((n): n is ViewNode => !!n)
		.map((n) => ({ n, ...layout(n) }));
	return {
		x0: Math.min(...b.map((o) => o.n.x - o.w / 2)),
		x1: Math.max(
			...b.map(
				(o) =>
					o.n.x +
					o.w / 2 +
					(o.n.kind === 'icon' && o.n.title ? 1 + textMm(show(o.n.title), fontPt(o.n), 'Sakuga Sans') : 0),
			),
		),
		y0: Math.min(...b.map((o) => o.n.y - o.h / 2)),
		y1: Math.max(...b.map((o) => o.n.y + o.h / 2)),
	};
}
export { darkerColor };
export const fillOf = (key: string) => cssFill(catOf(key)?.color);
export const styleColor = (key: string | undefined, fallback?: string) => {
	if (key === 'none') {
		return 'none';
	}
	if (/^#[0-9a-f]{6}$/i.test(key || '')) {
		return key;
	}
	if (key === 'black!25') {
		return '#bfbfbf';
	}
	const p = key ? store.palette[key] : undefined;
	if (!p) {
		return fallback;
	}
	return `rgb(${[0, 2, 4].map((i) => Math.round((parseInt(p.hex.slice(i, i + 2), 16) * p.mix) / 100 + 255 * (1 - p.mix / 100))).join(',')})`;
};
export function iconShape(parent: Element, name: string) {
	const data = store.icons.find((i) => i.name === name);
	if (!data) {
		return;
	}
	for (const d of data.paths || []) {
		el('path', { d }, parent);
	}
	for (const c of data.circles || []) {
		el('circle', { ...c }, parent);
	}
	for (const r of data.rects || []) {
		el('rect', { ...r }, parent);
	}
}
