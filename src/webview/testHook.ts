// @ts-nocheck
import { store } from './store/store';
import { layout } from './store/model';
import { baseEdgeGeom, boxHalf, resolveRoute } from './render/geometry';
import { edgeGeom } from './render/edges';
import { arrowLabelGeom, frameTitleGeom } from './render/labelgeom';
import { frameRect } from './render/anchors';
import { contentBox } from './render/boxes';
import { render } from './render/scene';

export function initTestHook() {
	// Test hook (S0): inert unless a test sets window.__sakugaTestHook = true before this script loads.
	if (window.__sakugaTestHook === true) {
		window.__sakugaTest = {
			layout,
			boxHalf,
			resolveRoute,
			baseEdgeGeom,
			edgeGeom,
			arrowLabelGeom,
			frameRect,
			frameTitleGeom,
			contentBox,
			state: () => ({
				nodes: store.nodes,
				edges: store.edges,
				groups: store.groups,
				figureFont: store.figureFont,
				arrowsStyle: store.arrowsStyle,
			}),
			setView: (v) => {
				Object.assign(store.view, v);
				store.moved = true;
			},
			render,
			// Read-only accessors for the interaction tests (S2).
			selection: () => ({
				nodes: [...store.selN],
				edges: [...store.selE],
				group: store.selG,
				label: store.selN.label ?? null,
				key: store.keyObject,
			}),
			drag: () => store.drag,
			editing: () => store.editing,
			tidyPreview: () => store.tidyPreview,
			view: () => store.view,
		};
	}
}
