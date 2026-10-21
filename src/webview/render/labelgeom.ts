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
	let best = { d: Infinity, pos: 0.5 };
	for (let j = 0; j <= 100; j++) {
		const pos = j / 100,
			q = labelPoint(G, { pos })!,
			d = Math.hypot(p.x - q[0], p.y - q[1]);
		if (d < best.d) best = { d, pos };
	}
	let pos = best.pos;
	for (const v of [0.25, 0.5, 0.75]) if (Math.abs(pos - v) < 0.04) pos = v;
	const a = labelPoint(G, { pos })!,
		dx = p.x - a[0],
		dy = p.y - a[1];
	return { pos, side: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'above' : 'below' };
}
