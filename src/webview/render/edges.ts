// @ts-nocheck
import { store } from '../store/store';
import { edgePath, hiddenEnd } from './geometry';
import { geo } from '../store/geometry';
import { ARROW, ARROW_DASHED, PT, show } from '../store/constants';
import { byId, px, py } from '../store/model';
import { arrowLabelGeom, labelSelection } from './labelgeom';
import { dash, el, styleColor, text, tip, weight } from './svg';

export function edgeGeom(e) {
	return hiddenEnd(e) ? null : geo().edge(e);
}
export function drawEdge(g, e, i) {
	const G = edgeGeom(e);
	if (!G) {
		return;
	}
	const alpha = (e.style?.opacity ?? 1) * (store.layers.find((l) => l.id === byId(e.from)?.layer)?.opacity ?? 1);
	g = el('g', { 'fill-opacity': alpha, 'stroke-opacity': alpha }, g);
	const color =
		e.style?.border === 'none' ? 'none' : styleColor(e.style?.color, e.kind === 'arr-dashed' ? ARROW_DASHED : ARROW);
	if (store.selE.has(i)) {
		el('path', { d: edgePath(G), fill: 'none', stroke: 'var(--sel)', 'stroke-width': 5, 'stroke-opacity': 0.35 }, g);
	}
	// the line stops inside the tip, as in TikZ
	const pts = G.curve ? G.curve.map((p) => [...p]) : G.pts.map((p) => [...p]);
	const last = pts.length - 1;
	if ((e.style?.end || (e.head === 'none' ? 'none' : 'Latex')) !== 'none') {
		pts[last] = tip(g, pts[last], pts[last - 1], color, {}, e.style?.end, e.style);
	}
	if ((e.style?.start || (e.head === 'both' ? 'Latex' : 'none')) !== 'none') {
		pts[0] = tip(g, pts[0], pts[1], color, {}, e.style?.start, e.style);
	}
	el(
		'path',
		{
			d: edgePath(G.curve ? { curve: pts } : { pts }),
			fill: 'none',
			stroke: color,
			'stroke-width': weight(e.style),
			'stroke-linejoin': 'round',
			'stroke-dasharray': e.style?.border
				? dash(e.style)
				: e.kind === 'arr-dashed'
					? `${1.4 * PT * store.view.s} ${1.4 * PT * store.view.s}`
					: 'none',
		},
		g,
	);
	if (G.blocked)
		el(
			'path',
			{
				d: edgePath(G),
				fill: 'none',
				stroke: '#d33',
				'stroke-width': 2,
				'stroke-dasharray': '5 4',
				'pointer-events': 'none',
			},
			g,
		);
	el(
		'path',
		{ d: edgePath(G), fill: 'none', stroke: 'transparent', 'stroke-width': 10, 'data-edge': i, class: 'hit' },
		g,
	);
	for (const [slot, content, st, badge] of [
		[undefined, e.label, e.labelStyle || {}, e.style?.step ? 4.4 : 0],
		...(e.labels || []).map((l, j) => [j, l.text, l.style || {}, 0]),
	]) {
		if (!content && !badge) continue;
		const geom = arrowLabelGeom(e, st, content, slot === undefined ? e.style?.step : 0),
			{
				p: [x, y],
				w,
				h,
				pt,
			} = geom,
			lines = content ? content.split('\\\\').map(show) : [],
			ref = { index: i, ...(slot === undefined ? {} : { slot }) };
		const c = styleColor(st.color || e.style?.color, '#595959');
		if (st.background !== false)
			el(
				'rect',
				{
					x: px(x - w / 2),
					y: py(y + h / 2),
					width: w * store.view.s,
					height: h * store.view.s,
					fill: '#fff',
					'pointer-events': 'none',
				},
				g,
			);
		lines.forEach((line, k) => {
			const t = text(g, x + badge / 2, y + ((lines.length - 1) / 2 - k) * pt * PT * 1.25, line, pt, 'Sakuga Sans', c);
			t.style.fontWeight = st.bold ? 'bold' : 'normal';
			t.style.fontStyle = st.italic ? 'italic' : 'normal';
		});
		if (badge) {
			const bx = x - w / 2 + 1.8;
			el('circle', { cx: px(bx), cy: py(y), r: 1.8 * store.view.s, fill: c, 'pointer-events': 'none' }, g);
			const t = text(g, bx, y, String(e.style.step), 8, 'Sakuga Sans', '#fff');
			t.style.fontWeight = 'bold';
		}
		labelSelection(g, ref, geom, w, h);
	}
}
