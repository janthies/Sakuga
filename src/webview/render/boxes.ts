import { store } from '../store/store';
import { byId, fontPt, layout, textMm } from '../store/model';
import { bbox } from './svg';
import { frameRect } from './anchors';
import { PT, show } from '../store/constants';
import { arrowLabelGeom, frameTitleGeom } from './labelgeom';
import { edgeGeom } from './edges';
import type { LabelStyle } from '../../core/model/figure';

function contentObjects() {
	const boxes = store.nodes
		.filter((n) => !n.hidden)
		.map((n) => {
			const { w, h } = layout(n),
				labelWidth = n.kind === 'icon' && n.title ? 1 + textMm(show(n.title), fontPt(n), 'Sakuga Sans') : 0;
			return { x0: n.x - w / 2, x1: n.x + w / 2 + labelWidth, y0: n.y - h / 2, y1: n.y + h / 2 };
		});
	for (const g of store.groups) {
		const b = g.frame !== 'none' && frameRect(g.id);
		if (!b) continue;
		boxes.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h / 2, y1: b.y + b.h / 2 });
		if (g.name) {
			const G = frameTitleGeom(g)!,
				w = textMm(show(g.name), G.pt, 'Sakuga Sans') + 3 * PT,
				h = G.pt * PT + 3 * PT;
			const x = G.p[0] - (G.align === 'middle' ? w / 2 : G.align === 'end' ? w : 0);
			boxes.push({ x0: x, x1: x + w, y0: G.p[1] - h / 2, y1: G.p[1] + h / 2 });
		}
	}
	for (const e of store.edges) {
		if (byId(e.from)?.hidden || byId(e.to)?.hidden) continue;
		const G = edgeGeom(e);
		if (!G?.pts?.length) continue;
		boxes.push({
			x0: Math.min(...G.pts.map((p: number[]) => p[0])),
			x1: Math.max(...G.pts.map((p: number[]) => p[0])),
			y0: Math.min(...G.pts.map((p: number[]) => p[1])),
			y1: Math.max(...G.pts.map((p: number[]) => p[1])),
		});
		const labels: { text: string; style?: LabelStyle; step?: number }[] = [
			...(e.label || e.style?.step ? [{ text: e.label || '', style: e.labelStyle, step: e.style?.step }] : []),
			...(e.labels || []),
		];
		for (const l of labels) {
			const L = arrowLabelGeom(e, l.style || {}, l.text, l.step);
			if (L) boxes.push({ x0: L.p[0] - L.w / 2, x1: L.p[0] + L.w / 2, y0: L.p[1] - L.h / 2, y1: L.p[1] + L.h / 2 });
		}
	}
	return boxes;
}
// The extent of everything drawn, with the legend rows; Fit and the size read-out use it.
export function contentBox() {
	if (!store.nodes.length) {
		return { x0: -40, x1: 40, y1: 40, y0: -40 };
	}
	const b = bbox(),
		used = new Set(store.nodes.map((n) => n.cat));
	const rows = Math.min(3, store.cats.filter((c) => used.has(c.key) && c.legend !== false).length);
	const objects = contentObjects();
	return {
		x0: Math.min(b.x0, ...objects.map((o) => o.x0)),
		x1: Math.max(b.x1, ...objects.map((o) => o.x1)),
		y0: Math.min(store.legend && rows ? b.y0 - 7 - rows * 6 : b.y0, ...objects.map((o) => o.y0)),
		y1: Math.max(b.y1, ...objects.map((o) => o.y1)),
	};
}
