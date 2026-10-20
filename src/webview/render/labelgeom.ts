import { store } from '../store/store';
import { labelPoint } from '../../core/geometry/label-geometry';
import { baseEdgeGeom } from './geometry';
import { geo } from '../store/geometry';
import { fine } from '../store/model';
import type { ViewEdge, Pt } from '../store/types';
import type { Group, LabelStyle } from '../../core/model/figure';

export function labelTarget(ref = store.selN.label) {
	if (!ref) return null;
	const g = ref.group && store.groups.find((g) => g.id === ref.group),
		e = ref.index === undefined ? null : store.edges[ref.index],
		l = ref.slot === undefined ? null : e?.labels?.[ref.slot];
	if (ref.slot !== undefined && !l) return null;
	return g
		? { text: g.name, style: g.labelStyle || {}, g }
		: e
			? { text: l ? l.text : e.label, style: (l ? l.style : e.labelStyle) || {}, e, step: l ? 0 : e.style?.step }
			: null;
}
export { labelPoint };
// Box and position of an attached label; null when the arrow is not drawn.
export function arrowLabelGeom(
	e: ViewEdge,
	st: LabelStyle = e.labelStyle || {},
	content: string = e.label,
	step: number | undefined = e.style?.step,
) {
	return baseEdgeGeom(e) ? geo().label(e, st, content, step) : null;
}
export function frameTitleGeom(g: Group) {
	return geo().frameTitle(g);
}
export function projectLabel(e: ViewEdge, p: Pt, content: string = e.label, step: number | undefined = e.style?.step) {
	const G = baseEdgeGeom({ ...e, labelStyle: e.labelStyle || {} });
	let best: { d: number; pos: number; segment: number } = { d: Infinity, pos: 0.5, segment: 0 };
	for (let segment = 0; segment < (G.curve ? 1 : G.pts.length - 1); segment++)
		for (let i = 0; i <= 100; i++) {
			const pos = i / 100,
				q = labelPoint(G, { pos, segment })!,
				d = Math.hypot(p.x - q[0], p.y - q[1]);
			if (d < best.d) best = { d, pos, segment };
		}
	let pos = best.pos;
	for (const v of [0.25, 0.5, 0.75]) if (Math.abs(pos - v) < 0.04) pos = v;
	const a = labelPoint(G, { pos, segment: best.segment })!,
		dx = p.x - a[0],
		dy = p.y - a[1];
	const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'above' : 'below';
	const st: Required<Pick<LabelStyle, 'pos' | 'segment' | 'side' | 'dx' | 'dy'>> = {
			pos,
			segment: best.segment,
			side,
			dx: 0,
			dy: 0,
		},
		base = arrowLabelGeom({ ...e, labelStyle: st }, st, content, step);
	st.dx = fine(p.x - base!.p[0]);
	st.dy = fine(p.y - base!.p[1]);
	if (Math.abs(st.dx) < 1) st.dx = 0;
	if (Math.abs(st.dy) < 1) st.dy = 0;
	return st;
}
