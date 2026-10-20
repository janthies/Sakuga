// @ts-nocheck
import { store } from '../store/store';
import { labelPoint } from '../../core/geometry/label-geometry';
import { baseEdgeGeom } from './geometry';
import { geo } from '../store/geometry';
import { fine, px, py } from '../store/model';
import { el } from './svg';

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
export function arrowLabelGeom(e, st = e.labelStyle || {}, content = e.label, step = e.style?.step) {
	return baseEdgeGeom(e) ? geo().label(e, st, content, step) : null;
}
export function frameTitleGeom(g) {
	return geo().frameTitle(g);
}
export function projectLabel(e, p, content = e.label, step = e.style?.step) {
	const G = baseEdgeGeom({ ...e, labelStyle: e.labelStyle || {} });
	let best = { d: Infinity };
	for (let segment = 0; segment < (G.curve ? 1 : G.pts.length - 1); segment++)
		for (let i = 0; i <= 100; i++) {
			const pos = i / 100,
				q = labelPoint(G, { pos, segment }),
				d = Math.hypot(p.x - q[0], p.y - q[1]);
			if (d < best.d) best = { d, pos, q, segment };
		}
	let pos = best.pos;
	for (const v of [0.25, 0.5, 0.75]) if (Math.abs(pos - v) < 0.04) pos = v;
	const a = labelPoint(G, { pos, segment: best.segment }),
		dx = p.x - a[0],
		dy = p.y - a[1];
	const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'above' : 'below';
	const st = { pos, segment: best.segment, side, dx: 0, dy: 0 },
		base = arrowLabelGeom({ ...e, labelStyle: st }, st, content, step);
	st.dx = fine(p.x - base.p[0]);
	st.dy = fine(p.y - base.p[1]);
	if (Math.abs(st.dx) < 1) st.dx = 0;
	if (Math.abs(st.dy) < 1) st.dy = 0;
	return st;
}
export function labelSelection(g, ref, geom, w, h, align = 'middle') {
	const key = JSON.stringify(ref),
		selected = store.selN.label && JSON.stringify(store.selN.label) === key,
		p = geom.p;
	if (selected)
		el(
			'line',
			{
				x1: px(geom.anchor[0]),
				y1: py(geom.anchor[1]),
				x2: px(p[0]),
				y2: py(p[1]),
				stroke: 'var(--sel)',
				'stroke-width': 1,
				'stroke-dasharray': '3 3',
				'pointer-events': 'none',
			},
			g,
		);
	el(
		'rect',
		{
			x: px(p[0] - (align === 'middle' ? w / 2 : align === 'end' ? w : 0)),
			y: py(p[1] + h / 2),
			width: w * store.view.s,
			height: h * store.view.s,
			fill: 'transparent',
			stroke: selected ? 'var(--sel)' : 'none',
			'stroke-opacity': 0.5,
			'stroke-width': 1,
			'data-label': key,
			class: 'attached-label',
		},
		g,
	);
}
