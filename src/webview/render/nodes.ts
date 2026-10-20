// @ts-nocheck
import * as coreText from '../../core/text';
import { store } from '../store/store';
import { effectiveIcon, fontPt, isBox, layout, paintOrder, px, py } from '../store/model';
import { dash, drawIcon, el, fillOf, styleColor, text, weight } from './svg';
import { CODE, PT, STROKE, show } from '../store/constants';
import { drawBox, drawDecorations } from './boxes';

export function renderBase2(ctx) {
	for (const n of paintOrder()) {
		if (n.hidden) {
			continue;
		}
		const alpha = (n.style?.opacity ?? 1) * (store.layers.find((l) => l.id === n.layer)?.opacity ?? 1);
		const gn = el('g', { 'fill-opacity': alpha, 'stroke-opacity': alpha }, ctx.svgNodes);
		const { w, h, lines } = layout(n);
		const selected = store.selN.has(n.id);

		const r =
			n.kind === 'label' || n.style?.shape === 'rectangle'
				? 0
				: n.style?.shape === 'pill'
					? (h / 2) * store.view.s
					: 1.4 * PT * store.view.s;
		if (n.kind === 'icon') {
			drawIcon(gn, n.icon, n.x - w / 2, n.y, w, h);
			el(
				'rect',
				{
					x: px(n.x - w / 2),
					y: py(n.y + h / 2),
					width: w * store.view.s,
					height: h * store.view.s,
					fill: 'transparent',
					class: n.locked ? 'locked-node' : 'node',
					...(n.locked ? {} : { 'data-node': n.id }),
				},
				gn,
			);
			if (store.editing !== n.id) {
				const label = text(gn, n.x + w / 2 + 1, n.y, show(n.title), fontPt(n), 'Sakuga Sans', '#000', 'start');
				label.setAttribute('data-node', n.id);
				label.setAttribute('pointer-events', n.locked ? 'none' : 'auto');
			}
		} else {
			if (n.kind === 'label') {
				el(
					'rect',
					{
						x: px(n.x - w / 2),
						y: py(n.y + h / 2),
						width: w * store.view.s,
						height: h * store.view.s,
						fill: 'transparent',
						...(n.locked ? { class: 'locked-node' } : { 'data-node': n.id }),
					},
					gn,
				);
			}
			const box = drawBox(
				n,
				w,
				h,
				{
					x: px(n.x - w / 2),
					y: py(n.y + h / 2),
					width: w * store.view.s,
					height: h * store.view.s,
					rx: r,
					ry: r,
					fill: styleColor(n.style?.fill, n.kind === 'label' ? 'none' : fillOf(n.cat)),
					stroke:
						n.style?.border === 'none' || (n.kind === 'label' && !n.style?.border)
							? 'none'
							: styleColor(n.style?.color, STROKE),
					'stroke-dasharray': dash(n.style),
					'stroke-width': weight(n.style),
					...(n.locked ? {} : { 'data-node': n.id }),
					class: n.locked ? 'locked-node' : 'node',
				},
				gn,
			);
			drawDecorations(n, w, h, box, gn);
		}
		if (selected) {
			const m = 1.2;
			el(
				'rect',
				{
					x: px(n.x - w / 2 - m),
					y: py(n.y + h / 2 + m),
					width: (w + 2 * m) * store.view.s,
					height: (h + 2 * m) * store.view.s,
					fill: 'none',
					stroke: 'var(--sel)',
					'stroke-width': 1,
					'stroke-dasharray': '3 2',
					'pointer-events': 'none',
				},
				ctx.go,
			);
		}
		if (store.editing !== n.id && n.kind !== 'icon') {
			const pitch = { 8: 9.5, 9: 11, 10: 12, 10.95: 13.6, 12: 14 }[fontPt(n)] * PT,
				codePitch = pitch - PT;
			const total = (lines.length - 1) * pitch + (n.code ? codePitch : 0);
			const pos = n.iconPosition || 'left',
				name = effectiveIcon(n);
			const shiftX = name ? (pos === 'left' ? 2 : pos === 'right' ? -2 : 0) : 0;
			const shiftY = name && !['left', 'right'].includes(pos) ? (['sw', 'se'].includes(pos) ? 2 : -2) : 0;
			if (name) {
				const x = ['right', 'ne', 'se'].includes(pos) ? n.x + w / 2 - 4 : pos === 'above' ? n.x - 1.5 : n.x - w / 2 + 1;
				const iy = ['above', 'nw', 'ne'].includes(pos)
					? n.y + h / 2 - 2.5
					: ['sw', 'se'].includes(pos)
						? n.y - h / 2 + 2.5
						: n.y;
				drawIcon(gn, name, x, iy);
			}
			const tp = n.titlePosition || 'center';
			const textAnchor = tp.includes('west') ? 'start' : tp.includes('east') ? 'end' : 'middle';
			const tx = n.x + shiftX + (tp.includes('west') ? -n.width / 2 : tp.includes('east') ? n.width / 2 : 0);
			let y =
				(tp.includes('north')
					? n.y + h / 2 - 3.5 * PT - (fontPt(n) * PT) / 2
					: tp.includes('south')
						? n.y - h / 2 + 3.5 * PT + (fontPt(n) * PT) / 2 + total
						: n.y + total / 2) + shiftY;
			for (const l of lines) {
				const titleText = text(
					gn,
					tx + (n.kind === 'label' && n.style?.step ? 2.2 : 0),
					y,
					l,
					fontPt(n),
					'Sakuga Sans',
					styleColor(n.style?.textColor, '#000'),
					textAnchor,
				);
				titleText.style.fontWeight = n.style?.text?.startsWith('bold') ? 'bold' : 'normal';
				titleText.style.fontStyle = n.style?.text?.includes('italic') ? 'italic' : 'normal';
				y -= pitch;
			}
			if (n.code) {
				text(
					gn,
					tx,
					y + pitch - codePitch,
					show(n.code),
					coreText.sizes[coreText.codeSize(n, store.figureFont)],
					'Sakuga Mono',
					CODE,
					textAnchor,
				);
			}
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
			]) {
				el(
					'rect',
					{
						x: px(n.x + (fx * w) / 2) - hs / 2,
						y: py(n.y + (fy * h) / 2) - hs / 2,
						width: hs,
						height: hs,
						fill: '#fff',
						stroke: 'var(--sel)',
						'stroke-width': 1,
						'data-resize': `${n.id}:${dir}`,
						class: `resize ${dir}`,
					},
					ctx.go,
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
				el(
					'circle',
					{
						cx: px(hx),
						cy: py(hy),
						r: 5,
						fill: 'var(--handle)',
						stroke: 'var(--sel)',
						'stroke-width': 1.5,
						'data-handle': n.id,
						class: 'handle',
					},
					ctx.go,
				);
			}
		}
	}
}
