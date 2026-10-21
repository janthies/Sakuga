// Where an arrow's label and a frame's title sit, in millimetres. Pure functions on a path and a few sizes.
import type { FigEdge, Group, LabelStyle } from '../model/figure';
import type { Obj, Point } from '../model/node';
import { PT, mm, show, sizes } from '../text';

export const CODE_PT = 8;

// The point on a path where an attached label hangs: a Bezier parameter on a curve, otherwise a position on one segment.
export function labelPoint(G: any, st: { pos?: number; segment?: number } = {}): Point | null {
	if (!G) return null;
	const t = st.pos ?? 0.5;
	if (G.curve)
		return [0, 1].map(
			(k) =>
				(1 - t) ** 3 * G.curve[0][k] +
				3 * (1 - t) ** 2 * t * G.curve[1][k] +
				3 * (1 - t) * t * t * G.curve[2][k] +
				t ** 3 * G.curve[3][k],
		);
	const lengths = G.pts.slice(1).map((p: Point, i: number) => Math.hypot(p[0] - G.pts[i][0], p[1] - G.pts[i][1]));
	let distance = Math.max(0, Math.min(1, t)) * lengths.reduce((a: number, b: number) => a + b, 0);
	for (let j = 0; j < lengths.length; j++) {
		if (distance <= lengths[j] || j === lengths.length - 1) {
			const u = lengths[j] ? distance / lengths[j] : 0;
			return G.pts[j].map((v: number, k: number) => v + (G.pts[j + 1][k] - v) * u);
		}
		distance -= lengths[j];
	}
	return [...G.pts[0]];
}

// The label anchor of an arrow that carries a position or side in its style but no label of its own placement.
export function pathLabel(e: FigEdge, G: any): Point {
	const label: Point = [...G.label];
	const t = e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : 0.5;
	if (e.label && e.style?.position) {
		if (G.curve) {
			return [0, 1].map(
				(k) =>
					(1 - t) ** 3 * G.curve[0][k] +
					3 * (1 - t) ** 2 * t * G.curve[1][k] +
					3 * (1 - t) * t * t * G.curve[2][k] +
					t ** 3 * G.curve[3][k],
			);
		}
		const bent = G.pts.length > 2,
			i = bent ? (e.style.position === 'start' ? 0 : G.special ? G.pts.length - 2 : 1) : 0,
			a = G.pts[i],
			b = G.pts[i + 1],
			u = G.special ? t : bent ? 0.5 : t;
		label[0] = a[0] + (b[0] - a[0]) * u;
		label[1] = a[1] + (b[1] - a[1]) * u;
	}
	return label;
}

// The offset of a one-line-per-row label that sits to one side of its arrow (the arrow's own side property).
export function sideOffset(e: FigEdge, label: Point): Point {
	const side = e.style?.side;
	if (!(e.label && side)) return label;
	const lines = e.label.split('\\\\'),
		h = lines.length * CODE_PT * PT * 1.25,
		w = Math.max(...lines.map((l) => mm(show(l), CODE_PT))) + (e.style?.step ? 4 : 0);
	const out: Point = [...label];
	if (side === 'left' || side === 'right') out[0] += (side === 'right' ? 1 : -1) * (w / 2 + 1);
	else out[1] += (side === 'above' ? 1 : -1) * (h / 2 + 1);
	return out;
}

export interface LabelGeom {
	p: Point;
	anchor: Point;
	w: number;
	h: number;
	pt: number;
}

// Box and position of one attached label of an arrow: its anchor on the path, its size from the advance tables, its offsets.
export function attachedLabel(
	e: FigEdge,
	G: any,
	font: string,
	st: LabelStyle = e.labelStyle || {},
	content: string = e.label,
	step: number | undefined = e.style?.step,
	gap = 1,
): LabelGeom | null {
	if (!G) return null;
	const anchor = labelPoint(G, {
		segment:
			st.segment ?? (e.style?.position === 'start' ? 0 : e.style?.position === 'end' ? G.pts.length - 2 : undefined),
		pos: st.pos ?? (e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : undefined),
	})!;
	const pt = sizes[st.font || font] || 10,
		lines = content.split('\\\\'),
		h = Math.max(lines.length * pt * PT * 1.25, step ? 3.6 : 0),
		w = Math.max(...lines.map((l) => mm(show(l), pt))) + 2 * PT + (step ? 4.4 : 0),
		side =
			st.side ||
			e.style?.side ||
			(G.loop ? { north: 'above', south: 'below', east: 'right', west: 'left' }[G.side as string] : undefined);
	const p: Point = [...anchor];
	if (side === 'left' || side === 'right') p[0] += (side === 'right' ? 1 : -1) * (w / 2 + gap);
	else if (side) p[1] += (side === 'above' ? 1 : -1) * (h / 2 + gap);
	return { p, anchor, w, h, pt };
}

// The title of a frame: anchor on the frame rectangle b, text position, size and alignment.
export function frameTitle(g: Group, b: Obj | null) {
	if (!b) return null;
	const st = g.labelStyle || {},
		pos = g.titlePosition || 'legacy',
		pt = sizes[st.font || g.titleFont || 'scriptsize'],
		inside = pos.startsWith('inside') || pos === 'legacy',
		right = pos === 'inside-top-right',
		center = pos === 'above-center',
		below = pos === 'below-left';
	const anchor: Point = [center ? b.x : right ? b.x + b.w / 2 : b.x - b.w / 2, below ? b.y - b.h / 2 : b.y + b.h / 2];
	return {
		p: [
			anchor[0] + (center ? 0 : right ? -1.5 * PT : 1.5 * PT) + (st.dx || 0),
			anchor[1] + (below ? -1 : inside ? -1 : 1) * (1.5 * PT + (pt * PT) / 2) + (st.dy || 0),
		] as Point,
		anchor,
		pt,
		align: center ? 'middle' : right ? 'end' : 'start',
	};
}
