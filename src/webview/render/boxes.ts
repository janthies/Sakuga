// @ts-nocheck
import { store } from '../store/store';
import { byId, fontPt, groupById, layout, members, px, py, textMm } from '../store/model';
import { bbox, darkerColor, drawIcon, el, fillOf, styleColor, text, weight } from './svg';
import { frameRect } from './anchors';
import { LINE, PT, STROKE, show, sizes, smallerPt } from '../store/constants';
import { arrowLabelGeom, frameTitleGeom, labelSelection } from './labelgeom';
import { hierarchy } from '../store/layers';
import { edgeGeom } from './edges';

export function drawBox(n, w, h, attrs, parent) {
	const shape = n.style?.shape;
	if (shape === 'ellipse' || shape === 'circle') {
		return el(
			'ellipse',
			{ ...attrs, cx: px(n.x), cy: py(n.y), rx: (w * store.view.s) / 2, ry: (h * store.view.s) / 2 },
			parent,
		);
	}
	if (shape === 'diamond') {
		return el(
			'path',
			{
				...attrs,
				d: `M ${px(n.x)} ${py(n.y + h / 2)} L ${px(n.x + w / 2)} ${py(n.y)} L ${px(n.x)} ${py(n.y - h / 2)} L ${px(n.x - w / 2)} ${py(n.y)} Z`,
			},
			parent,
		);
	}
	if (shape === 'cylinder') {
		const x = px(n.x - w / 2),
			y = py(n.y + h / 2),
			ww = w * store.view.s,
			hh = h * store.view.s,
			rr = hh / 2;
		return el(
			'path',
			{
				...attrs,
				d: `M ${x + rr} ${y} L ${x + ww - rr} ${y} A ${rr} ${hh / 2} 0 0 1 ${x + ww - rr} ${y + hh} L ${x + rr} ${y + hh} A ${rr} ${hh / 2} 0 0 1 ${x + rr} ${y} M ${x + ww - rr} ${y} A ${rr} ${hh / 2} 0 0 0 ${x + ww - rr} ${y + hh}`,
			},
			parent,
		);
	}

	return el('rect', attrs, parent);
}
export function drawDecorations(n, w, h, box, parent) {
	const st = n.style || {},
		scale = store.view.s,
		x = px(n.x - w / 2),
		y = py(n.y + h / 2),
		ww = w * scale,
		hh = h * scale;
	const defs = el('defs', {}, parent),
		clip = el('clipPath', { id: `sg-clip-${n.id}` }, defs),
		outline = box.cloneNode(false);
	for (const k of ['data-node', 'class', 'stroke', 'stroke-width', 'stroke-dasharray']) {
		outline.removeAttribute(k);
	}
	outline.setAttribute('fill', '#fff');
	clip.append(outline);
	if (st.border === 'double') {
		const outer = box.cloneNode(false);
		outer.setAttribute('fill', 'none');
		outer.setAttribute('stroke-width', 2 * weight(st) + 0.8 * PT * scale);
		outer.setAttribute('pointer-events', 'none');
		outer.removeAttribute('data-node');
		parent.append(outer);
		const gap = outer.cloneNode(false);
		gap.setAttribute('stroke', '#fff');
		gap.setAttribute('stroke-width', 0.8 * PT * scale);
		parent.append(gap);
	}
	const g = el('g', { 'clip-path': `url(#sg-clip-${n.id})`, 'pointer-events': 'none' }, parent);
	if (st.mark && st.mark !== 'none') {
		const corner = st.markCorner || 'ne',
			size = (st.markSize === 'medium' ? 5 : 2.4) * scale,
			right = corner.endsWith('e'),
			top = corner.startsWith('n'),
			cx = right ? x + ww : x,
			cy = top ? y : y + hh,
			dx = right ? -size : size,
			dy = top ? size : -size,
			fill = styleColor(st.markColor, '#33333A');
		if (st.mark === 'circle') {
			el('circle', { cx: cx + dx / 2, cy: cy + dy / 2, r: size / 2, fill }, g);
		} else {
			el('path', { d: `M ${cx} ${cy} l ${dx} 0 l ${-dx} ${dy} Z`, fill }, g);
		}
	}
	if (st.pattern && st.pattern !== 'none') {
		// Match the 3pt tiles and 0.4pt strokes in TikZ's patterns library.
		const tile = 3 * PT * scale,
			id = `sg-pattern-${n.id}`,
			pattern = el(
				'pattern',
				{ id, patternUnits: 'userSpaceOnUse', width: tile, height: tile, x: px(0), y: py(0) },
				defs,
			);
		const color = styleColor(st.patternColor, '#bfbfbf');
		if (st.pattern === 'dots') {
			for (const cx of [0, tile]) {
				for (const cy of [0, tile]) {
					el('circle', { cx, cy, r: 0.5 * PT * scale, fill: color }, pattern);
				}
			}
		} else {
			const d =
				st.pattern === 'horizontal'
					? `M 0 ${tile - 0.5 * PT * scale} H ${tile}`
					: st.pattern === 'vertical'
						? `M ${0.5 * PT * scale} 0 V ${tile}`
						: `M 0 ${tile} L ${tile} 0` + (st.pattern === 'crosshatch' ? ` M 0 0 L ${tile} ${tile}` : '');
			el('path', { d, stroke: color, 'stroke-width': 0.4 * PT * scale, fill: 'none' }, pattern);
		}
		el('rect', { x, y, width: ww, height: hh, fill: `url(#${id})` }, g);
	}
}
function contentObjects() {
	const boxes = store.nodes
		.filter((n) => !n.hidden)
		.map((n) => {
			const { w, h } = layout(n),
				labelWidth = n.kind === 'icon' && n.title ? 1 + textMm(show(n.title), fontPt(n), 'Sakuga Sans') : 0;
			return { x0: n.x - w / 2, x1: n.x + w / 2 + labelWidth, y0: n.y - h / 2, y1: n.y + h / 2 };
		});
	for (const g of store.groups) {
		const b = g.frame !== 'none' && frameRect(g.id);
		if (!b) continue;
		boxes.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h / 2, y1: b.y + b.h / 2 });
		if (g.name) {
			const G = frameTitleGeom(g),
				w = textMm(show(g.name), G.pt, 'Sakuga Sans') + 3 * PT,
				h = G.pt * PT + 3 * PT;
			const x = G.p[0] - (G.align === 'middle' ? w / 2 : G.align === 'end' ? w : 0);
			boxes.push({ x0: x, x1: x + w, y0: G.p[1] - h / 2, y1: G.p[1] + h / 2 });
		}
	}
	for (const e of store.edges) {
		if (e.hidden || byId(e.from)?.hidden || byId(e.to)?.hidden) continue;
		const G = edgeGeom(e);
		if (!G?.pts?.length) continue;
		boxes.push({
			x0: Math.min(...G.pts.map((p) => p[0])),
			x1: Math.max(...G.pts.map((p) => p[0])),
			y0: Math.min(...G.pts.map((p) => p[1])),
			y1: Math.max(...G.pts.map((p) => p[1])),
		});
		const labels = [
			...(e.label || e.style?.step ? [{ text: e.label || '', style: e.labelStyle, step: e.style?.step }] : []),
			...(e.labels || []),
		];
		for (const l of labels) {
			const L = arrowLabelGeom(e, l.style || {}, l.text, l.step);
			if (L) boxes.push({ x0: L.p[0] - L.w / 2, x1: L.p[0] + L.w / 2, y0: L.p[1] - L.h / 2, y1: L.p[1] + L.h / 2 });
		}
	}
	return boxes;
}
// The extent of everything drawn, with the legend rows; Fit and the size read-out use it.
export function contentBox() {
	if (!store.nodes.length) {
		return { x0: -40, x1: 40, y1: 40, y0: -40 };
	}
	const b = bbox(),
		used = new Set(store.nodes.map((n) => n.cat));
	const rows = Math.min(3, store.cats.filter((c) => used.has(c.key) && c.legend !== false).length);
	const objects = contentObjects();
	return {
		x0: Math.min(b.x0, ...objects.map((o) => o.x0)),
		x1: Math.max(b.x1, ...objects.map((o) => o.x1)),
		y0: Math.min(store.legend && rows ? b.y0 - 7 - rows * 6 : b.y0, ...objects.map((o) => o.y0)),
		y1: Math.max(b.y1, ...objects.map((o) => o.y1)),
	};
}
export function drawGroups(parent) {
	const draw = (items) => {
		for (const item of items) {
			const g = groupById(item.id);
			if (!g) {
				continue;
			}
			const ids = members(g.id).filter((id) => !byId(id).hidden);
			if (g.frame !== 'none' && ids.length) {
				const alpha = store.layers.find((l) => l.id === byId(ids[0]).layer)?.opacity ?? 1;
				const frameParent = el('g', { 'fill-opacity': alpha, 'stroke-opacity': alpha }, parent);
				const rect = frameRect(g.id),
					b = { x0: rect.x - rect.w / 2, x1: rect.x + rect.w / 2, y0: rect.y - rect.h / 2, y1: rect.y + rect.h / 2 },
					m = 0;
				const p = /^#[0-9a-f]{6}$/i.test(g.color)
					? { hex: g.color.slice(1) }
					: store.palette[g.color] || store.palette.grey;
				const strength = (g.fillStrength ?? 30) / 100,
					outline =
						g.outline || (g.frame === 'region' || g.frame === 'none' ? (g.lineWidth ? 'solid' : 'none') : g.frame);
				const fill = p
					? `rgb(${[0, 2, 4].map((i) => Math.round(parseInt(p.hex.slice(i, i + 2), 16) * strength + 255 * (1 - strength))).join(',')})`
					: '#eee';
				el(
					'rect',
					{
						x: px(b.x0 - m),
						y: py(b.y1 + m),
						width: (b.x1 - b.x0 + 2 * m) * store.view.s,
						height: (b.y1 - b.y0 + 2 * m) * store.view.s,
						rx: (g.frame === 'region' ? 1.5 : 2.5) * PT * store.view.s,
						fill: (g.fill || (g.frame === 'region' ? 'tint' : 'none')) === 'none' ? 'none' : fill,
						stroke:
							outline === 'none'
								? 'none'
								: styleColor(g.frameColor || (g.outline ? darkerColor(g.color) : ''), '#737373'),
						'stroke-width': (g.lineWidth || (g.frame === 'dotted' ? 1.5 : 0.7)) * PT * store.view.s,
						'stroke-linecap': outline === 'dotted' ? 'round' : 'butt',
						'stroke-dasharray':
							outline === 'dashed'
								? `${9 * PT * store.view.s} ${3 * PT * store.view.s}`
								: outline === 'dotted'
									? `0 ${4.5 * PT * store.view.s}`
									: 'none',
						'data-group': g.id,
						class: 'group-frame',
						'pointer-events': g.frame === 'region' ? 'all' : 'stroke',
					},
					frameParent,
				);
				const pos = g.titlePosition || 'legacy';
				if (g.name && (pos !== 'legacy' || g.frame === 'region')) {
					const geom = frameTitleGeom(g),
						st = g.labelStyle || {},
						{
							p: [x, y],
							pt,
							align,
						} = geom,
						w = textMm(show(g.name), pt, 'Sakuga Sans') + 3 * PT,
						h = pt * PT + 3 * PT;
					if (st.background === true)
						el(
							'rect',
							{
								x: px(x - (align === 'middle' ? w / 2 : align === 'end' ? w : 0)),
								y: py(y + h / 2),
								width: w * store.view.s,
								height: h * store.view.s,
								fill: 'white',
							},
							frameParent,
						);
					const title = text(
						frameParent,
						x,
						y,
						show(g.name),
						pt,
						'Sakuga Sans',
						styleColor(
							st.color ||
								g.titleColor ||
								(pos === 'legacy' ? '' : darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'))),
							'#737373',
						),
						align,
					);
					title.style.fontWeight = (st.bold ?? g.titleBold) ? 'bold' : 'normal';
					title.style.fontStyle = st.italic ? 'italic' : 'normal';
					labelSelection(frameParent, { group: g.id }, geom, w, h, align);
				}
			}
			draw(item.children);
		}
	};
	draw(hierarchy());
}
// The same legend the TikZ output draws: one swatch per used category, three per column.
export function renderLegend(g) {
	const used = new Set(store.nodes.map((n) => n.cat));
	const list = store.cats.filter((c) => used.has(c.key) && c.legend !== false);
	if (!store.legend || !list.length) {
		return;
	}
	const b = bbox();
	list.forEach((c, i) => {
		const x = b.x0 + Math.floor(i / 3) * 34,
			y = b.y0 - 7 - (i % 3) * 6;
		el(
			'rect',
			{
				x: px(x),
				y: py(y),
				width: 3.6 * store.view.s,
				height: 3.6 * store.view.s,
				rx: PT * store.view.s,
				ry: PT * store.view.s,
				fill: fillOf(c.key),
				stroke: STROKE,
				'stroke-width': Math.max(0.8, LINE * store.view.s),
				'pointer-events': 'none',
			},
			g,
		);
		if (c.icon) {
			drawIcon(g, c.icon, x + 4.6, y - 1.8);
		}
		text(
			g,
			x + 4.6 + (c.icon ? 4 : 0),
			y - 1.8,
			show(c.name),
			smallerPt(sizes[store.figureFont]),
			'Sakuga Sans',
			'#000',
			'start',
		);
	});
}
