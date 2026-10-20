// @ts-nocheck
import { store } from '../store/store';
import { baseEdgeGeom } from './geometry';
import { PT, show, sizes } from '../store/constants';
import { fine, px, py, textMm } from '../store/model';
import { frameRect } from './anchors';
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
export function labelPoint(G, st = {}) {
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
	const i = Math.max(0, Math.min(G.pts.length - 2, st.segment ?? (G.pts.length === 4 ? 1 : 0))),
		a = G.pts[i],
		b = G.pts[i + 1];
	return a.map((v, k) => v + (b[k] - v) * t);
}
export function arrowLabelGeom(e, st = e.labelStyle || {}, content = e.label, step = e.style?.step) {
	const G = baseEdgeGeom(e);
	if (!G) return null;
	const anchor = labelPoint(G, {
		segment:
			st.segment ?? (e.style?.position === 'start' ? 0 : e.style?.position === 'end' ? G.pts.length - 2 : undefined),
		pos: st.pos ?? (e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : undefined),
	});
	const pt = sizes[st.font || store.figureFont] || 10,
		lines = content.split('\\\\'),
		h = Math.max(lines.length * pt * PT * 1.25, step ? 3.6 : 0),
		w =
			Math.max(
				...lines.map((l) =>
					textMm(show(l), pt, 'Sakuga Sans', {
						text: st.bold && st.italic ? 'bold-italic' : st.bold ? 'bold' : st.italic ? 'italic' : '',
					}),
				),
			) +
			2 * PT +
			(step ? 4.4 : 0),
		side =
			st.side ||
			e.style?.side ||
			(G.loop ? { north: 'above', south: 'below', east: 'right', west: 'left' }[G.side] : undefined);
	const p = [anchor[0] + (st.dx || 0), anchor[1] + (st.dy || 0)];
	if (side === 'left' || side === 'right') p[0] += (side === 'right' ? 1 : -1) * (w / 2);
	else if (side) p[1] += (side === 'above' ? 1 : -1) * (h / 2 + PT);
	return { p, anchor, w, h, pt };
}
export function frameTitleGeom(g) {
	const b = frameRect(g.id);
	if (!b) return null;
	const st = g.labelStyle || {},
		pos = g.titlePosition || 'legacy',
		pt = sizes[st.font || g.titleFont || 'scriptsize'],
		inside = pos.startsWith('inside') || pos === 'legacy',
		right = pos === 'inside-top-right',
		center = pos === 'above-center',
		below = pos === 'below-left';
	const anchor = [center ? b.x : right ? b.x + b.w / 2 : b.x - b.w / 2, below ? b.y - b.h / 2 : b.y + b.h / 2];
	return {
		p: [
			anchor[0] + (center ? 0 : right ? -1.5 * PT : 1.5 * PT) + (st.dx || 0),
			anchor[1] + (below ? -1 : inside ? -1 : 1) * (1.5 * PT + (pt * PT) / 2) + (st.dy || 0),
		],
		anchor,
		pt,
		align: center ? 'middle' : right ? 'end' : 'start',
	};
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
