// The selection, handles, guides and previews drawn above the figure, as primitives in screen pixels.
// Everything here comes from the store state (selection, hover, drag), never from the scene.
import { treeSelection } from './overlay-items';
import { PT } from '../../core/text';
import { prim } from '../../core/scene/style';
import type { Prim } from '../../core/scene';
import { store } from '../store/store';
import { anchorPoint, byId, layout, px, py, textMm } from '../store/model';
import { isBox, paintOrder } from '../store/model';
import { selBox } from './svg';
import { edgeGeom } from './edges';
import { arrowLabelGeom, frameTitleGeom, labelTarget } from './labelgeom';
import { show } from '../store/constants';
import { dragPrims } from './overlay-drag';
import { Out } from './out';
import type { Attrs, PrimKind } from '../../core/scene';
import type { ViewNode } from '../store/types';

// The overlay and the geometry of the single selected connector.
export function buildOverlay(): { prims: Prim[]; edge: { i: number; G: any } | null } {
	const o = new Out();
	const edge = edgeHandles(o);
	for (const n of paintOrder()) {
		if (!n.hidden) nodeSelection(o, n);
	}
	treeSelection(o);
	multiSelection(o);
	attachments(o);
	selectedLabel(o);
	dragPrims(o);
	return { prims: o.prims, edge };
}

function edgeHandles(o: Out) {
	if (!(store.selE.size === 1 && store.selN.size === 0)) return null;
	const i = [...store.selE][0],
		G = store.edges[i] && edgeGeom(store.edges[i]);
	if (!G) return null;
	o.add(
		'circle',
		{
			cx: px(G.label[0]),
			cy: py(G.label[1]),
			r: 5,
			fill: '#fff',
			stroke: 'var(--sel)',
			'stroke-width': 1.5,
			class: 'midhandle',
		},
		{ hit: { k: 'mid', index: i } },
	);
	if (!G.curve) {
		for (let j = 0; j < G.pts.length - 1; j++) {
			const a = G.pts[j],
				b = G.pts[j + 1];
			o.add(
				'rect',
				{
					x: px((a[0] + b[0]) / 2) - 4,
					y: py((a[1] + b[1]) / 2) - 4,
					width: 8,
					height: 8,
					fill: 'white',
					stroke: 'var(--sel)',
					class: 'handle',
				},
				{ hit: { k: 'segment', index: i, j } },
			);
		}
		for (let j = 1; j < G.pts.length - 1; j++)
			o.add(
				'circle',
				{ cx: px(G.pts[j][0]), cy: py(G.pts[j][1]), r: 3, fill: 'white', stroke: 'var(--sel)', class: 'handle' },
				{ hit: { k: 'corner', index: i, j } },
			);
	}
	const pts = G.curve || G.pts;
	for (const [end, p] of [
		['from', pts[0]],
		['to', pts[pts.length - 1]],
	])
		o.add(
			'circle',
			{
				cx: px(p[0]),
				cy: py(p[1]),
				r: 5,
				fill: 'var(--handle)',
				stroke: 'var(--sel)',
				'stroke-width': 1.5,
				class: 'handle',
			},
			{ hit: { k: 'endpoint', index: i, end } },
		);
	return { i, G };
}

function nodeSelection(o: Out, n: ViewNode) {
	const { w, h } = layout(n);
	const selected = store.selN.has(n.id);
	if (selected) {
		const m = 1.2;
		o.add('rect', {
			x: px(n.x - w / 2 - m),
			y: py(n.y + h / 2 + m),
			width: (w + 2 * m) * store.view.s,
			height: (h + 2 * m) * store.view.s,
			fill: 'none',
			stroke: 'var(--sel)',
			'stroke-width': 1,
			'stroke-dasharray': '3 2',
			'pointer-events': 'none',
		});
	}
	if (!n.locked && selected && store.selN.size === 1 && store.selE.size === 0 && store.editing !== n.id) {
		const hs = 7;
		for (const [dir, fx, fy] of [
			['nw', -1, 1],
			['n', 0, 1],
			['ne', 1, 1],
			['e', 1, 0],
			['se', 1, -1],
			['s', 0, -1],
			['sw', -1, -1],
			['w', -1, 0],
		] as [string, number, number][]) {
			o.add(
				'rect',
				{
					x: px(n.x + (fx * w) / 2) - hs / 2,
					y: py(n.y + (fy * h) / 2) - hs / 2,
					width: hs,
					height: hs,
					fill: '#fff',
					stroke: 'var(--sel)',
					'stroke-width': 1,
					class: `resize ${dir}`,
				},
				{ hit: { k: 'resize', id: n.id, dir } },
			);
		}
	}
	if (
		isBox(n) &&
		!n.locked &&
		store.editing !== n.id &&
		((selected && store.selN.size === 1 && store.selE.size === 0) || (store.hover === n.id && !store.drag))
	) {
		for (const [hx, hy] of [
			[n.x + w / 2 + 4, n.y],
			[n.x - w / 2 - 4, n.y],
			[n.x, n.y + h / 2 + 4],
			[n.x, n.y - h / 2 - 4],
		]) {
			o.add(
				'circle',
				{
					cx: px(hx),
					cy: py(hy),
					r: 5,
					fill: 'var(--handle)',
					stroke: 'var(--sel)',
					'stroke-width': 1.5,
					class: 'handle',
				},
				{ hit: { k: 'handle', id: n.id } },
			);
		}
	}
}

function multiSelection(o: Out) {
	if (!(
		store.selN.size > 1 &&
		[...store.selN].every((id) => byId(id) && !byId(id)!.locked && !byId(id)!.hidden) &&
		!store.editing
	))
		return;
	const b = selBox([...store.selN]),
		m = 2.5,
		hs = 7;
	o.add('rect', {
		x: px(b.x0 - m),
		y: py(b.y1 + m),
		width: (b.x1 - b.x0 + 2 * m) * store.view.s,
		height: (b.y1 - b.y0 + 2 * m) * store.view.s,
		fill: 'none',
		stroke: 'var(--sel)',
		'stroke-width': 1,
		'pointer-events': 'none',
	});
	const cx = (b.x0 + b.x1) / 2,
		cy = (b.y0 + b.y1) / 2;
	for (const [dir, x, y] of [
		['nw', b.x0 - m, b.y1 + m],
		['n', cx, b.y1 + m],
		['ne', b.x1 + m, b.y1 + m],
		['e', b.x1 + m, cy],
		['se', b.x1 + m, b.y0 - m],
		['s', cx, b.y0 - m],
		['sw', b.x0 - m, b.y0 - m],
		['w', b.x0 - m, cy],
	] as [string, number, number][]) {
		o.add(
			'rect',
			{
				x: px(x) - hs / 2,
				y: py(y) - hs / 2,
				width: hs,
				height: hs,
				fill: 'var(--sel)',
				stroke: '#fff',
				'stroke-width': 1,
				class: `resize ${dir}`,
			},
			{ hit: { k: 'scale', dir } },
		);
	}
}

// The line from a selected box to the anchor it hangs on.
function attachments(o: Out) {
	for (const n of store.nodes.filter((n) => !n.hidden && store.selN.has(n.id))) {
		if (n.attachment && byId(n.attachment.parent)) {
			const p = anchorPoint(byId(n.attachment.parent)!, n.attachment.anchor),
				q = anchorPoint(n, n.attachment.ownAnchor);
			o.add('line', {
				x1: px(p.x),
				y1: py(p.y),
				x2: px(q.x),
				y2: py(q.y),
				stroke: 'var(--sel)',
				'stroke-width': 1,
				'pointer-events': 'none',
			});
			o.add('circle', { cx: px(p.x), cy: py(p.y), r: 3, fill: 'var(--sel)', 'pointer-events': 'none' });
		}
	}
}

// The outline of the selected label and the line to the place it hangs from.
function selectedLabel(o: Out) {
	const ref = store.selN.label,
		target = ref && labelTarget(ref);
	if (!target) return;
	if (target.g) {
		const geom = frameTitleGeom(target.g);
		if (!geom) return;
		const w = textMm(show(target.g.name), geom.pt, 'Sakuga Sans') + 3 * PT,
			h = geom.pt * PT + 3 * PT;
		labelOutline(o, geom, w, h, geom.align);
	} else {
		const geom = arrowLabelGeom(target.e, target.style, target.text, target.step);
		if (geom) labelOutline(o, geom, geom.w, geom.h, 'middle');
	}
}
function labelOutline(o: Out, geom: { p: number[]; anchor: number[] }, w: number, h: number, align: string) {
	const p = geom.p;
	o.add('line', {
		x1: px(geom.anchor[0]),
		y1: py(geom.anchor[1]),
		x2: px(p[0]),
		y2: py(p[1]),
		stroke: 'var(--sel)',
		'stroke-width': 1,
		'stroke-dasharray': '3 3',
		'pointer-events': 'none',
	});
	o.add('rect', {
		x: px(p[0] - (align === 'middle' ? w / 2 : align === 'end' ? w : 0)),
		y: py(p[1] + h / 2),
		width: w * store.view.s,
		height: h * store.view.s,
		fill: 'none',
		stroke: 'var(--sel)',
		'stroke-opacity': 0.5,
		'stroke-width': 1,
		'pointer-events': 'none',
	});
}
