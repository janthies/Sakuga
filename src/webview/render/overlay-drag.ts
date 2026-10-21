import { BOX_SLOTS, slotCell } from '../../core/model/slots';
// Previews while the pointer is down: guides, copies, the band, connect lines, anchors.
import * as coreRoutes from '../../core/layout/route';
import { PT } from '../../core/text';
import { store } from '../store/store';
import { anchorPoint, byId, layout, nodeAt, px, py } from '../store/model';
import { ANCHORS, ARROW, LINE } from '../store/constants';
import { border, fillOf } from './svg';
import { endpointObject, endpointTarget } from './anchors';
import type { Out } from './out';
import type { DragOverlay, ViewNode } from '../store/types';

export function dragPrims(o: Out) {
	const d = store.drag;
	if (d?.slots) {
		const { parent: b, slot, line } = d.slots;
		if (b && !line) {
			const cw = b.w / 3,
				ch = b.h / 3;
			for (const name of BOX_SLOTS) {
				const [c, r] = slotCell(name);
				o.add('rect', {
					x: px(b.x - b.w / 2 + (c - 1) * cw),
					y: py(b.y + b.h / 2 - (r - 1) * ch),
					width: cw * store.view.s,
					height: ch * store.view.s,
					fill: name === slot ? 'var(--sel)' : 'white',
					'fill-opacity': name === slot ? 0.3 : 0.08,
					stroke: 'var(--sel)',
					'stroke-width': 0.8,
					'pointer-events': 'none',
				});
			}
		} else if (b) {
			const dx = b.end[0] - b.start[0],
				dy = b.end[1] - b.start[1],
				len = Math.hypot(dx, dy) || 1;
			for (let j = 0; j < 6; j++) {
				const t = ((j % 3) + 0.5) / 3,
					sign = j < 3 ? 1 : -1;
				const x = b.start[0] + dx * t - ((sign * dy) / len) * 4,
					y = b.start[1] + dy * t + ((sign * dx) / len) * 4;
				const name = ['start-above', 'middle-above', 'end-above', 'start-below', 'middle-below', 'end-below'][j];
				o.add('circle', {
					cx: px(x),
					cy: py(y),
					r: 3 * store.view.s,
					fill: name === slot ? 'var(--sel)' : 'white',
					'fill-opacity': 0.3,
					stroke: 'var(--sel)',
					'pointer-events': 'none',
				});
			}
		}
	}
	for (const gd of (d && d.guides) || []) {
		o.add(
			'line',
			gd.x !== undefined
				? { x1: px(gd.x), y1: py(gd.a - 3), x2: px(gd.x), y2: py(gd.b + 3), stroke: '#d63384', 'stroke-width': 1 }
				: { x1: px(gd.a - 3), y1: py(gd.y), x2: px(gd.b + 3), y2: py(gd.y), stroke: '#d63384', 'stroke-width': 1 },
		);
	}
	if (d && d.move && d.copy && (d.dx || d.dy)) {
		for (const id of d.orig.keys()) {
			const n = byId(id)!;
			const { w, h } = layout(n);
			o.add('rect', {
				x: px(n.x + d.dx - w / 2),
				y: py(n.y + d.dy + h / 2),
				width: w * store.view.s,
				height: h * store.view.s,
				fill: fillOf(n.cat),
				'fill-opacity': 0.5,
				stroke: 'var(--sel)',
				'stroke-width': 1,
				'pointer-events': 'none',
			});
		}
	}
	if (d && d.band) {
		const x = Math.min(d.x0, d.x1),
			y = Math.max(d.y0, d.y1);
		o.add('rect', {
			x: px(x),
			y: py(y),
			width: Math.abs(d.x1 - d.x0) * store.view.s,
			height: Math.abs(d.y1 - d.y0) * store.view.s,
			fill: 'var(--sel)',
			'fill-opacity': 0.08,
			stroke: 'var(--sel)',
			'stroke-width': 1,
			'pointer-events': 'none',
		});
	}
	if (d && (d.connect || d.endpoint !== undefined)) endpointPorts(o, d);
	if (d && d.connect) connectArrow(o, d);
	if (d?.endpoint !== undefined) {
		const n = d.target && endpointObject(d.target.id),
			pt = n && !n.frame ? coreRoutes.port({ ...n, ...layout(n) }, d.target.anchor, d.target.offset) : [d.x, d.y];
		o.add('circle', {
			cx: px(pt[0]),
			cy: py(pt[1]),
			r: 6,
			fill: 'none',
			stroke: d.target ? '#43a047' : 'var(--sel)',
			'stroke-width': 2,
		});
	}
	if (d?.target && d.move) anchorGrid(o, d);
}

// The ports of the box under the pointer, while an arrow end is dragged.
function endpointPorts(o: Out, d: DragOverlay) {
	const target = endpointTarget({ x: d.x, y: d.y });
	const n = target && endpointObject(target.id);
	if (!n || (n as { frame?: unknown }).frame) return;
	const box = { ...n, ...layout(n as ViewNode) };
	for (const side of ['north', 'east', 'south', 'west'])
		for (const f of [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]) {
			const off = (f - 0.5) * (/north|south/.test(side) ? box.w : box.h),
				p = coreRoutes.port(box, side, off);
			o.add('circle', {
				cx: px(p[0]),
				cy: py(p[1]),
				r: 2.5,
				fill: '#fff',
				stroke: 'var(--sel)',
				'pointer-events': 'none',
			});
		}
	if (target.fraction !== undefined)
		o.add(
			'text',
			{
				x: px(d.x + 2),
				y: py(d.y + 3),
				'text-anchor': 'middle',
				'dominant-baseline': 'central',
				'font-size': 8 * PT * store.view.s,
				'font-family': 'Sakuga Sans',
				fill: '#555',
				'pointer-events': 'none',
			},
			{
				text: { 0: '0', 0.25: '1/4', [1 / 3]: '1/3', 0.5: '1/2', [2 / 3]: '2/3', 0.75: '3/4', 1: '1' }[target.fraction],
			},
		);
}

// A faint arrow from the box to the pointer or to the box under it.
function connectArrow(o: Out, d: DragOverlay) {
	const a = byId(d.connect)!;
	const target = nodeAt(d);
	const [x1, y1] = border(a, d.x, d.y);
	const [x2, y2] = target && target !== a ? border(target, a.x, a.y) : [d.x, d.y];
	const s = store.view.s;
	const len = Math.hypot(x2 - x1, y2 - y1) || 1;
	const ux = (x2 - x1) / len,
		uy = (y2 - y1) / len;
	const L = 1.5,
		W = 1.2,
		c = 0.35;
	const bx = x2 - ux * L,
		by = y2 - uy * L;
	o.add('line', {
		x1: px(x1),
		y1: py(y1),
		x2: px(bx + ux * 0.2),
		y2: py(by + uy * 0.2),
		stroke: ARROW,
		'stroke-width': Math.max(0.8, LINE * s),
		opacity: 0.6,
	});
	o.add('path', {
		d: [
			`M ${px(x2)} ${py(y2)}`,
			`Q ${px(bx + ux * L * c - uy * W * 0.15)} ${py(by + uy * L * c + ux * W * 0.15)} ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)}`,
			`L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}`,
			`Q ${px(bx + ux * L * c + uy * W * 0.15)} ${py(by + uy * L * c - ux * W * 0.15)} ${px(x2)} ${py(y2)} Z`,
		].join(' '),
		fill: ARROW,
		opacity: 0.6,
	});
}

// The nine anchors of the box a dragged box would attach to.
function anchorGrid(o: Out, d: DragOverlay) {
	const { parent, anchor } = d.target,
		{ w, h } = layout(parent);
	ANCHORS.forEach((a, i) => {
		o.add('rect', {
			x: px(parent.x - w / 2 + ((i % 3) * w) / 3),
			y: py(parent.y + h / 2 - (Math.floor(i / 3) * h) / 3),
			width: (w / 3) * store.view.s,
			height: (h / 3) * store.view.s,
			fill: a === anchor ? 'var(--sel)' : 'transparent',
			'fill-opacity': 0.16,
			stroke: 'var(--sel)',
			'stroke-width': 0.8,
			'pointer-events': 'none',
		});
		const pt = anchorPoint(parent, a);
		o.add('circle', { cx: px(pt.x), cy: py(pt.y), r: 3, fill: 'var(--sel)', 'pointer-events': 'none' });
	});
}
