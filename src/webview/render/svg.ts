// @ts-nocheck
import { store } from '../store/store';
import { byId, catOf, fontPt, layout, px, py, textMm } from '../store/model';
import { ARROW, ARROW_DASHED, LINE, NS, PT, show } from '../store/constants';

export function el(tag, attrs, parent) {
	const e = document.createElementNS(NS, tag);
	for (const k in attrs) {
		e.setAttribute(k, attrs[k]);
	}
	if (parent) {
		parent.appendChild(e);
	}
	return e;
}
export function text(parent, x, y, s, pt, family, fill, anchor = 'middle') {
	const t = el(
		'text',
		{
			x: px(x),
			y: py(y),
			'text-anchor': anchor,
			'dominant-baseline': 'central',
			'font-size': pt * PT * store.view.s,
			'font-family': family,
			fill,
			'pointer-events': 'none',
		},
		parent,
	);
	t.textContent = s;
	return t;
}
// Point on the border of n in the direction of (tx, ty), as TikZ does for (a) -- (b).
export function border(n, tx, ty) {
	const { w, h } = layout(n);
	const dx = tx - n.x,
		dy = ty - n.y;
	if (!dx && !dy) {
		return [n.x, n.y];
	}
	const shape = n.style?.shape;
	if (shape === 'ellipse' || shape === 'circle') {
		const t = 1 / Math.hypot(dx / (w / 2), dy / (h / 2));
		return [n.x + dx * t, n.y + dy * t];
	}
	if (shape === 'diamond') {
		const t = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2));
		return [n.x + dx * t, n.y + dy * t];
	}
	const t = Math.min(dx ? w / 2 / Math.abs(dx) : Infinity, dy ? h / 2 / Math.abs(dy) : Infinity);
	return [n.x + dx * t, n.y + dy * t];
}
export function bbox() {
	const b = store.nodes.filter((n) => !n.hidden).map((n) => ({ n, ...layout(n) }));
	if (!b.length) {
		return { x0: 0, x1: 0, y0: 0, y1: 0 };
	}
	return {
		x0: Math.min(...b.map((o) => o.n.x - o.w / 2)),
		x1: Math.max(
			...b.map(
				(o) =>
					o.n.x +
					o.w / 2 +
					(o.n.kind === 'icon' && o.n.title ? 1 + textMm(show(o.n.title), fontPt(o.n), 'Sakuga Sans') : 0),
			),
		),
		y0: Math.min(...b.map((o) => o.n.y - o.h / 2)),
		y1: Math.max(...b.map((o) => o.n.y + o.h / 2)),
	};
}
// LaTeX arrow tip: length 1.5 mm, width 1.2 mm.
export function arrow(g, x1, y1, x2, y2, kind, attrs) {
	const len = Math.hypot(x2 - x1, y2 - y1) || 1;
	const ux = (x2 - x1) / len,
		uy = (y2 - y1) / len;
	const L = 1.5,
		W = 1.2;
	const bx = x2 - ux * L,
		by = y2 - uy * L;
	const color = kind === 'arr-dashed' ? ARROW_DASHED : ARROW;
	el(
		'line',
		{
			x1: px(x1),
			y1: py(y1),
			x2: px(bx + ux * 0.2),
			y2: py(by + uy * 0.2),
			stroke: color,
			'stroke-width': Math.max(0.8, LINE * store.view.s),
			'stroke-dasharray': kind === 'arr-dashed' ? `${1.4 * PT * store.view.s} ${1.4 * PT * store.view.s}` : 'none',
			...attrs,
		},
		g,
	);
	const c = 0.35;
	const d = [
		`M ${px(x2)} ${py(y2)}`,
		`Q ${px(bx + ux * L * c - uy * W * 0.15)} ${py(by + uy * L * c + ux * W * 0.15)} ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)}`,
		`L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}`,
		`Q ${px(bx + ux * L * c + uy * W * 0.15)} ${py(by + uy * L * c - ux * W * 0.15)} ${px(x2)} ${py(y2)} Z`,
	].join(' ');
	if (kind === 'circle') {
		const d =
			Array.from({ length: 25 }, (_, i) => {
				const th = (i / 24) * 2 * Math.PI;
				return `${i ? 'L' : 'M'} ${px(x2 - (ux * L) / 2 + (ux * Math.cos(th) * L) / 2 - (uy * Math.sin(th) * W) / 2)} ${py(y2 - (uy * L) / 2 + (uy * Math.cos(th) * L) / 2 + (ux * Math.sin(th) * W) / 2)}`;
			}).join(' ') + ' Z';
		el('path', { d, fill: color, ...attrs }, g);
	} else if (kind === 'bar') {
		el(
			'path',
			{
				d: `M ${px(x2 - (uy * W) / 2)} ${py(y2 + (ux * W) / 2)} L ${px(x2 + (uy * W) / 2)} ${py(y2 - (ux * W) / 2)}`,
				stroke: color,
				'stroke-width': LINE * store.view.s,
				...attrs,
			},
			g,
		);
	} else if (kind === 'triangle' || kind === 'barb' || kind === 'Stealth') {
		el(
			'path',
			{
				d: `M ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)} L ${px(x2)} ${py(y2)} L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}${kind === 'barb' ? '' : ' Z'}`,
				fill: kind === 'Stealth' ? color : '#fff',
				stroke: color,
				'stroke-width': LINE * store.view.s,
				...attrs,
			},
			g,
		);
	} else {
		el('path', { d, fill: color, ...attrs }, g);
	}
}
export function tip(g, [x2, y2], [x1, y1], color, attrs, kind = 'Latex', style = {}) {
	const len = Math.hypot(x2 - x1, y2 - y1) || 1;
	const ux = (x2 - x1) / len,
		uy = (y2 - y1) / len;
	const L = style.tipLength ?? 1.5,
		W = style.tipWidth ?? 1.2,
		c = 0.35;
	const bx = x2 - ux * L,
		by = y2 - uy * L;
	const d = [
		`M ${px(x2)} ${py(y2)}`,
		`Q ${px(bx + ux * L * c - uy * W * 0.15)} ${py(by + uy * L * c + ux * W * 0.15)} ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)}`,
		`L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}`,
		`Q ${px(bx + ux * L * c + uy * W * 0.15)} ${py(by + uy * L * c - ux * W * 0.15)} ${px(x2)} ${py(y2)} Z`,
	].join(' ');
	if (kind === 'circle') {
		const d =
			Array.from({ length: 25 }, (_, i) => {
				const th = (i / 24) * 2 * Math.PI;
				return `${i ? 'L' : 'M'} ${px(x2 - (ux * L) / 2 + (ux * Math.cos(th) * L) / 2 - (uy * Math.sin(th) * W) / 2)} ${py(y2 - (uy * L) / 2 + (uy * Math.cos(th) * L) / 2 + (ux * Math.sin(th) * W) / 2)}`;
			}).join(' ') + ' Z';
		el('path', { d, fill: color, ...attrs }, g);
	} else if (kind === 'bar') {
		el(
			'path',
			{
				d: `M ${px(x2 - (uy * W) / 2)} ${py(y2 + (ux * W) / 2)} L ${px(x2 + (uy * W) / 2)} ${py(y2 - (ux * W) / 2)}`,
				stroke: color,
				'stroke-width': LINE * store.view.s,
				...attrs,
			},
			g,
		);
	} else if (kind === 'triangle' || kind === 'barb' || kind === 'Stealth') {
		el(
			'path',
			{
				d: `M ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)} L ${px(x2)} ${py(y2)} L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}${kind === 'barb' ? '' : ' Z'}`,
				fill: kind === 'Stealth' ? color : '#fff',
				stroke: color,
				'stroke-width': LINE * store.view.s,
				...attrs,
			},
			g,
		);
	} else {
		el('path', { d, fill: color, ...attrs }, g);
	}
	const shorten = kind === 'bar' ? 0 : L * 0.8;
	return [x2 - ux * shorten, y2 - uy * shorten];
}
export function selBox(ids) {
	const b = ids
		.map((id) => byId(id))
		.filter(Boolean)
		.map((n) => ({ n, ...layout(n) }));
	return {
		x0: Math.min(...b.map((o) => o.n.x - o.w / 2)),
		x1: Math.max(
			...b.map(
				(o) =>
					o.n.x +
					o.w / 2 +
					(o.n.kind === 'icon' && o.n.title ? 1 + textMm(show(o.n.title), fontPt(o.n), 'Sakuga Sans') : 0),
			),
		),
		y0: Math.min(...b.map((o) => o.n.y - o.h / 2)),
		y1: Math.max(...b.map((o) => o.n.y + o.h / 2)),
	};
}
export function darkerColor(color) {
	const hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color.slice(1) : (store.palette[color] || store.palette.grey).hex;
	return (
		'#' +
		[0, 2, 4]
			.map((i) =>
				Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.6)
					.toString(16)
					.padStart(2, '0'),
			)
			.join('')
			.toUpperCase()
	);
}
export function fillOf(key) {
	const c = catOf(key);
	if (c && /^#[0-9a-f]{6}$/i.test(c.color)) return c.color;
	const p = c && store.palette[c.color];
	if (!p) {
		return '#ffffff';
	}
	const k = p.mix / 100;
	const ch = (i) => Math.round(parseInt(p.hex.slice(i, i + 2), 16) * k + 255 * (1 - k));
	return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
}
export const styleColor = (key, fallback) => {
	if (key === 'none') {
		return 'none';
	}
	if (/^#[0-9a-f]{6}$/i.test(key || '')) {
		return key;
	}
	if (key === 'black!25') {
		return '#bfbfbf';
	}
	const p = store.palette[key];
	if (!p) {
		return fallback;
	}
	return `rgb(${[0, 2, 4].map((i) => Math.round((parseInt(p.hex.slice(i, i + 2), 16) * p.mix) / 100 + 255 * (1 - p.mix / 100))).join(',')})`;
};
export const dash = (st) =>
	st?.border === 'dashed'
		? `${3 * PT * store.view.s} ${3 * PT * store.view.s}`
		: st?.border === 'dotted'
			? `${weight(st)} ${2 * PT * store.view.s}`
			: 'none';
export const weight = (st) => (st?.lineWidth ?? ({ medium: 0.8, thick: 1.2 }[st?.weight] || 0.45)) * PT * store.view.s;
// Title lines as TeX sets them with text width and align=center (greedy fill).
export function iconShape(parent, name) {
	const data = store.icons.find((i) => i.name === name);
	if (!data) {
		return;
	}
	for (const d of data.paths || []) {
		el('path', { d }, parent);
	}
	for (const c of data.circles || []) {
		el('circle', c, parent);
	}
	for (const r of data.rects || []) {
		el('rect', r, parent);
	}
}
export function drawIcon(parent, name, x, y, w = 3, h = 3) {
	const g = el(
		'g',
		{
			transform: `translate(${px(x)},${py(y) - (h / 2) * store.view.s}) scale(${(w * store.view.s) / 24},${(h * store.view.s) / 24})`,
			fill: 'none',
			stroke: '#666',
			'stroke-width': (0.6 * PT * 24) / 3,
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			'pointer-events': 'none',
		},
		parent,
	);
	iconShape(g, name);
	for (const shape of g.children) {
		shape.setAttribute('vector-effect', 'non-scaling-stroke');
		shape.setAttribute('stroke-width', 0.6 * PT * store.view.s);
	}
}
