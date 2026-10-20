// The outline of a box and its decorations (double border, corner mark, hatching) as primitives.
import type { FigNode } from '../model/figure';
import { PT } from '../text';
import { n4, prim, styleColor, weight } from './style';
import type { Attrs, Prim } from './types';

// The shape of a box at its place. `attrs` carries the paint; the geometry comes from the node.
export function boxShape(
	key: string,
	n: FigNode,
	w: number,
	h: number,
	r: number,
	attrs: Attrs,
	hit: Partial<Prim>,
): Prim {
	const shape = n.style?.shape;
	const x = n.x - w / 2,
		y = -(n.y + h / 2);
	if (shape === 'ellipse' || shape === 'circle') {
		return prim('ellipse', key, { ...attrs, cx: n.x, cy: -n.y, rx: w / 2, ry: h / 2 }, hit);
	}
	if (shape === 'triangle') {
		const radius = (h - 0.158) / 1.5,
			half = (w - 0.158) / 2;
		const d = `M ${n4(n.x)} ${n4(-(n.y + radius))} L ${n4(n.x + half)} ${n4(-(n.y - radius / 2))} L ${n4(n.x - half)} ${n4(-(n.y - radius / 2))} Z`;
		return prim('path', key, { ...attrs, d }, hit);
	}
	if (shape === 'diamond') {
		const d = `M ${n4(n.x)} ${n4(-(n.y + h / 2))} L ${n4(n.x + w / 2)} ${n4(-n.y)} L ${n4(n.x)} ${n4(-(n.y - h / 2))} L ${n4(n.x - w / 2)} ${n4(-n.y)} Z`;
		return prim('path', key, { ...attrs, d }, hit);
	}
	if (shape === 'cylinder') {
		const rr = h / 2,
			f = n4;
		const d = `M ${f(x + rr)} ${f(y)} L ${f(x + w - rr)} ${f(y)} A ${f(rr)} ${f(h / 2)} 0 0 1 ${f(x + w - rr)} ${f(y + h)} L ${f(x + rr)} ${f(y + h)} A ${f(rr)} ${f(h / 2)} 0 0 1 ${f(x + rr)} ${f(y)} M ${f(x + w - rr)} ${f(y)} A ${f(rr)} ${f(h / 2)} 0 0 0 ${f(x + w - rr)} ${f(y + h)}`;
		return prim('path', key, { ...attrs, d }, hit);
	}
	return prim('rect', key, { ...attrs, x, y, width: w, height: h, rx: r, ry: r }, hit);
}

// The same geometry under another key, without the hit area.
function copy(box: Prim, key: string, attrs: Attrs): Prim {
	return prim(box.kind, key, { ...box.attrs, ...attrs });
}

// Clip path, double border, corner mark and pattern of one box; empty when it has none of them.
export function decorations(key: string, n: FigNode, w: number, h: number, box: Prim): Prim[] {
	const st = n.style || {};
	const double = st.border === 'double',
		mark = st.mark && st.mark !== 'none',
		pattern = st.pattern && st.pattern !== 'none';
	if (!double && !mark && !pattern) return [];
	const x = n.x - w / 2,
		y = -(n.y + h / 2);
	const out: Prim[] = [];
	const clipId = `sg-clip-${n.id}`;
	const outline = copy(box, `${key}:clip-outline`, { fill: '#fff' });
	for (const k of ['class', 'stroke', 'stroke-width', 'stroke-dasharray']) delete outline.attrs[k];
	const defs = prim(
		'defs',
		`${key}:defs`,
		{},
		{ children: [prim('clipPath', `${key}:clip`, { id: clipId }, { children: [outline] })] },
	);
	out.push(defs);
	if (double) {
		const outer = prim(
			'g',
			`${key}:double`,
			{},
			{
				children: [
					copy(box, `${key}:double:outer`, {
						fill: 'none',
						'stroke-width': 2 * weight(st) + 0.8 * PT,
						'pointer-events': 'none',
					}),
					copy(box, `${key}:double:gap`, {
						fill: 'none',
						stroke: '#fff',
						'stroke-width': 0.8 * PT,
						'pointer-events': 'none',
					}),
				],
			},
		);
		for (const c of outer.children!) delete c.attrs.class;
		out.push(outer);
	}
	const g: Prim[] = [];
	if (mark) {
		const corner = st.markCorner || 'ne',
			size = st.markSize === 'medium' ? 5 : 2.4,
			right = corner.endsWith('e'),
			top = corner.startsWith('n'),
			cx = right ? x + w - 0.5 : x + 0.5,
			cy = top ? y + 0.5 : y + h - 0.5,
			dx = right ? -size : size,
			dy = top ? size : -size,
			fill = styleColor(st.markColor, '#33333A');
		g.push(
			st.mark === 'circle'
				? prim('circle', `${key}:mark`, { cx: cx + dx / 2, cy: cy + dy / 2, r: size / 4, fill })
				: prim('path', `${key}:mark`, { d: `M ${n4(cx)} ${n4(cy)} l ${n4(dx)} 0 l ${n4(-dx)} ${n4(dy)} Z`, fill }),
		);
	}
	if (pattern) {
		// 3 pt tiles and 0.4 pt strokes, as in TikZ's patterns library.
		const tile = 3 * PT,
			id = `sg-pattern-${n.id}`,
			color = styleColor(st.patternColor, '#bfbfbf');
		const cells: Prim[] = [];
		if (st.pattern === 'dots') {
			for (const cx of [0, tile])
				for (const cy of [0, tile])
					cells.push(prim('circle', `${key}:dot${cells.length}`, { cx, cy, r: 0.5 * PT, fill: color }));
		} else {
			const d =
				st.pattern === 'horizontal'
					? `M 0 ${n4(tile - 0.5 * PT)} H ${n4(tile)}`
					: st.pattern === 'vertical'
						? `M ${n4(0.5 * PT)} 0 V ${n4(tile)}`
						: `M 0 ${n4(tile)} L ${n4(tile)} 0` +
							(st.pattern === 'crosshatch' ? ` M 0 0 L ${n4(tile)} ${n4(tile)}` : '');
			cells.push(prim('path', `${key}:hatch`, { d, stroke: color, 'stroke-width': 0.4 * PT, fill: 'none' }));
		}
		defs.children!.push(
			prim(
				'pattern',
				`${key}:pattern`,
				{ id, patternUnits: 'userSpaceOnUse', width: tile, height: tile, x: 0, y: 0 },
				{ children: cells },
			),
		);
		g.push(prim('rect', `${key}:fillpattern`, { x, y, width: w, height: h, fill: `url(#${id})` }));
	}
	out.push(prim('g', `${key}:decor`, { 'clip-path': `url(#${clipId})`, 'pointer-events': 'none' }, { children: g }));
	return out;
}
