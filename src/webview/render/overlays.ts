// @ts-nocheck
import * as coreRoutes from '../../core/layout/route';
import { store } from '../store/store';
import { calls } from '../store/calls';
import { anchorPoint, byId, layout, nodeAt, px, py } from '../store/model';
import { arrow, border, el, fillOf, selBox, styleColor, text } from './svg';
import { svg } from '../platform/dom';
import { renderLegend } from './boxes';
import { endpointObject, endpointTarget } from './anchors';
import { ANCHORS } from '../store/constants';

export function renderBase3(ctx) {
	if (store.selN.size > 1 && [...store.selN].every((id) => !byId(id).locked && !byId(id).hidden) && !store.editing) {
		const b = selBox([...store.selN]),
			m = 2.5,
			hs = 7;
		el(
			'rect',
			{
				x: px(b.x0 - m),
				y: py(b.y1 + m),
				width: (b.x1 - b.x0 + 2 * m) * store.view.s,
				height: (b.y1 - b.y0 + 2 * m) * store.view.s,
				fill: 'none',
				stroke: 'var(--sel)',
				'stroke-width': 1,
				'pointer-events': 'none',
			},
			ctx.gn,
		);
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
		]) {
			el(
				'rect',
				{
					x: px(x) - hs / 2,
					y: py(y) - hs / 2,
					width: hs,
					height: hs,
					fill: 'var(--sel)',
					stroke: '#fff',
					'stroke-width': 1,
					'data-scale': dir,
					class: `resize ${dir}`,
				},
				ctx.gn,
			);
		}
	}
	for (const n of store.nodes.filter((n) => !n.hidden && n.kind === 'label' && n.style?.step)) {
		const { w } = layout(n);
		const x = n.x - w / 2 + 1.8,
			c = styleColor(n.style?.textColor, '#595959');
		el('circle', { cx: px(x), cy: py(n.y), r: 1.8 * store.view.s, fill: c }, ctx.gn);
		const badge = text(ctx.gn, x, n.y, String(n.style.step), 8, 'Sakuga Sans', '#fff');
		badge.style.fontWeight = 'bold';
	}
	for (const n of store.nodes.filter((n) => !n.hidden && store.selN.has(n.id))) {
		if (n.attachment && byId(n.attachment.parent)) {
			const p = anchorPoint(byId(n.attachment.parent), n.attachment.anchor),
				o = anchorPoint(n, n.attachment.ownAnchor);
			el(
				'line',
				{
					x1: px(p.x),
					y1: py(p.y),
					x2: px(o.x),
					y2: py(o.y),
					stroke: 'var(--sel)',
					'stroke-width': 1,
					'pointer-events': 'none',
				},
				svg,
			);
			el('circle', { cx: px(p.x), cy: py(p.y), r: 3, fill: 'var(--sel)', 'pointer-events': 'none' }, svg);
		}
	}

	for (const gd of (store.drag && store.drag.guides) || []) {
		el(
			'line',
			gd.x !== undefined
				? { x1: px(gd.x), y1: py(gd.a - 3), x2: px(gd.x), y2: py(gd.b + 3), stroke: '#d63384', 'stroke-width': 1 }
				: { x1: px(gd.a - 3), y1: py(gd.y), x2: px(gd.b + 3), y2: py(gd.y), stroke: '#d63384', 'stroke-width': 1 },
			ctx.gn,
		);
	}
	renderLegend(ctx.gn);
	if (store.drag && store.drag.move && store.drag.copy && (store.drag.dx || store.drag.dy)) {
		for (const id of store.drag.orig.keys()) {
			const n = byId(id);
			const { w, h } = layout(n);
			el(
				'rect',
				{
					x: px(n.x + store.drag.dx - w / 2),
					y: py(n.y + store.drag.dy + h / 2),
					width: w * store.view.s,
					height: h * store.view.s,
					fill: fillOf(n.cat),
					'fill-opacity': 0.5,
					stroke: 'var(--sel)',
					'stroke-width': 1,
					'pointer-events': 'none',
				},
				ctx.gn,
			);
		}
	}
	if (store.drag && store.drag.band) {
		const x = Math.min(store.drag.x0, store.drag.x1),
			y = Math.max(store.drag.y0, store.drag.y1);
		el(
			'rect',
			{
				x: px(x),
				y: py(y),
				width: Math.abs(store.drag.x1 - store.drag.x0) * store.view.s,
				height: Math.abs(store.drag.y1 - store.drag.y0) * store.view.s,
				fill: 'var(--sel)',
				'fill-opacity': 0.08,
				stroke: 'var(--sel)',
				'stroke-width': 1,
				'pointer-events': 'none',
			},
			ctx.gn,
		);
	}
	if (store.drag && (store.drag.connect || store.drag.endpoint !== undefined)) {
		const target = endpointTarget({ x: store.drag.x, y: store.drag.y });
		const n = target && endpointObject(target.id);
		if (n && !n.frame) {
			const box = { ...n, ...layout(n) };
			for (const side of ['north', 'east', 'south', 'west'])
				for (const f of [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]) {
					const off = (f - 0.5) * (/north|south/.test(side) ? box.w : box.h),
						p = coreRoutes.port(box, side, off);
					el(
						'circle',
						{ cx: px(p[0]), cy: py(p[1]), r: 2.5, fill: '#fff', stroke: 'var(--sel)', 'pointer-events': 'none' },
						ctx.go,
					);
				}
			if (target.fraction !== undefined)
				text(
					ctx.go,
					store.drag.x + 2,
					store.drag.y + 3,
					{ 0: '0', 0.25: '1/4', [1 / 3]: '1/3', 0.5: '1/2', [2 / 3]: '2/3', 0.75: '3/4', 1: '1' }[target.fraction],
					8,
					'Sakuga Sans',
					'#555',
				);
		}
	}
	if (store.drag && store.drag.connect) {
		const a = byId(store.drag.connect);
		const target = nodeAt(store.drag);
		const [x1, y1] = border(a, store.drag.x, store.drag.y);
		const [x2, y2] = target && target !== a ? border(target, a.x, a.y) : [store.drag.x, store.drag.y];
		arrow(ctx.gn, x1, y1, x2, y2, 'arr', { opacity: 0.6 });
	}
	if (store.drag?.endpoint !== undefined) {
		const n = store.drag.target && endpointObject(store.drag.target.id),
			pt =
				n && !n.frame
					? coreRoutes.port({ ...n, ...layout(n) }, store.drag.target.anchor, store.drag.target.offset)
					: [store.drag.x, store.drag.y];
		el(
			'circle',
			{
				cx: px(pt[0]),
				cy: py(pt[1]),
				r: 6,
				fill: 'none',
				stroke: store.drag.target ? '#43a047' : 'var(--sel)',
				'stroke-width': 2,
			},
			svg,
		);
	}
	if (store.drag?.target && store.drag.move) {
		const { parent, anchor } = store.drag.target,
			{ w, h } = layout(parent);
		ANCHORS.forEach((a, i) => {
			el(
				'rect',
				{
					x: px(parent.x - w / 2 + ((i % 3) * w) / 3),
					y: py(parent.y + h / 2 - (Math.floor(i / 3) * h) / 3),
					width: (w / 3) * store.view.s,
					height: (h / 3) * store.view.s,
					fill: a === anchor ? 'var(--sel)' : 'transparent',
					'fill-opacity': 0.16,
					stroke: 'var(--sel)',
					'stroke-width': 0.8,
					'pointer-events': 'none',
				},
				svg,
			);
			const pt = anchorPoint(parent, a);
			el('circle', { cx: px(pt.x), cy: py(pt.y), r: 3, fill: 'var(--sel)', 'pointer-events': 'none' }, svg);
		});
	}

	calls.renderInspector();
	calls.renderLayers();
}
export function drawTidyPreview() {
	if (!store.tidyPreview) return;
	const g = el('g', { 'pointer-events': 'none', opacity: 0.55 }, svg);
	const ns = store.nodes.map((n) => ({
			...n,
			...store.tidyPreview.ops.find((o) => o.op === 'node' && o.id === n.id),
			...store.tidyPreview.ops.find((o) => o.op === 'move' && o.id === n.id),
		})),
		es = store.edges.map((e, index) => ({
			...e,
			...store.tidyPreview.ops.find((o) => o.op === 'arrow' && o.index === index),
		}));
	for (const group of store.groups) {
		const b = coreRoutes.bounds(
			group.id,
			ns.map((n) => ({ ...n, ...layout(n) })),
			store.groups,
			new Set(),
			es,
		);
		if (b && group.frame !== 'none')
			el(
				'rect',
				{
					x: px(b.x - b.w / 2),
					y: py(b.y + b.h / 2),
					width: b.w * store.view.s,
					height: b.h * store.view.s,
					fill: 'none',
					stroke: 'var(--sel)',
					'stroke-dasharray': '5 3',
				},
				g,
			);
	}

	for (const n of store.nodes) {
		const move = store.tidyPreview.ops.find((o) => o.op === 'move' && o.id === n.id),
			props = store.tidyPreview.ops.find((o) => o.op === 'node' && o.id === n.id);
		if (!move && !props) continue;
		const q = { ...n, ...props, ...move },
			s = layout(q);
		el(
			'rect',
			{
				x: px(q.x - s.w / 2),
				y: py(q.y + s.h / 2),
				width: s.w * store.view.s,
				height: s.h * store.view.s,
				fill: 'var(--sel)',
				'fill-opacity': 0.12,
				stroke: 'var(--sel)',
				'stroke-dasharray': '5 3',
			},
			g,
		);
	}
}
