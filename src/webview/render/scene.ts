// @ts-nocheck
import { store } from '../store/store';
import { calls } from '../store/calls';
import { drawTidyPreview, renderBase3 } from './overlays';
import { renderBase2 } from './nodes';
import { etools, svg } from '../platform/dom';
import { el } from './svg';
import { px, py } from '../store/model';
import { drawGroups } from './boxes';
import { drawEdge, edgeGeom } from './edges';

export function render() {
	renderBase();
	drawTidyPreview();
	calls.updateZoombar();
}
function renderBase() {
	const ctx = {};
	renderBase1(ctx);
	renderBase2(ctx);
	renderBase3(ctx);
}
function renderBase1(ctx) {
	if (store.selN.size || store.selE.size || store.selG) {
		store.selectedLayers.clear();
	}
	svg.replaceChildren();
	const gg = el('g', {}, svg);
	const gf = el('g', {}, svg);
	ctx.gn = el('g', {}, svg);
	const ge = el('g', {}, svg);
	ctx.go = el('g', {}, svg);
	if (store.grid >= 2 && store.grid * store.view.s >= 10) {
		const r = svg.getBoundingClientRect();
		const x0 = Math.ceil(-store.view.ox / store.view.s / store.grid) * store.grid,
			x1 = (r.width - store.view.ox) / store.view.s;
		const y1 = Math.floor(store.view.oy / store.view.s / store.grid) * store.grid,
			y0 = (store.view.oy - r.height) / store.view.s;
		const dots = [];
		for (let x = x0; x <= x1; x += store.grid) {
			for (let y = y1; y >= y0; y -= store.grid) {
				dots.push(`M ${px(x)} ${py(y)} h 0.01`);
			}
		}
		el('path', { d: dots.join(' '), stroke: '#c8c8c8', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, gg);
	}
	drawGroups(gf);
	store.edges.forEach((e, i) => drawEdge(ge, e, i));
	etools.style.display = 'none';
	if (
		store.selE.size === 1 &&
		store.selN.size === 0 &&
		!(store.drag && store.drag.mid !== undefined && store.drag.mid !== null && false)
	) {
		const i = [...store.selE][0],
			G = store.edges[i] && edgeGeom(store.edges[i]);
		if (G) {
			el(
				'circle',
				{
					cx: px(G.label[0]),
					cy: py(G.label[1]),
					r: 5,
					fill: '#fff',
					stroke: 'var(--sel)',
					'stroke-width': 1.5,
					'data-mid': i,
					class: 'midhandle',
				},
				ge,
			);
			if (!G.curve) {
				for (let j = 0; j < G.pts.length - 1; j++) {
					const a = G.pts[j],
						b = G.pts[j + 1];
					el(
						'rect',
						{
							x: px((a[0] + b[0]) / 2) - 4,
							y: py((a[1] + b[1]) / 2) - 4,
							width: 8,
							height: 8,
							fill: 'white',
							stroke: 'var(--sel)',
							'data-segment': i + ':' + j,
							class: 'handle',
						},
						ge,
					);
				}
				for (let j = 1; j < G.pts.length - 1; j++)
					el(
						'circle',
						{
							cx: px(G.pts[j][0]),
							cy: py(G.pts[j][1]),
							r: 3,
							fill: 'white',
							stroke: 'var(--sel)',
							'data-corner': i + ':' + j,
							class: 'handle',
						},
						ge,
					);
			}
			const pts = G.curve || G.pts;
			for (const [end, p] of [
				['from', pts[0]],
				['to', pts[pts.length - 1]],
			])
				el(
					'circle',
					{
						cx: px(p[0]),
						cy: py(p[1]),
						r: 5,
						fill: 'var(--handle)',
						stroke: 'var(--sel)',
						'stroke-width': 1.5,
						'data-endpoint': i + ':' + end,
						class: 'handle',
					},
					ge,
				);
			if (!store.drag) {
				calls.showToolbar(i, G);
			}
		}
	}
	ctx.svgNodes = ctx.gn;
}
