import { store } from './store/store';
import { layout } from './store/model';
import { geo } from './store/geometry';
import { edgeGeom } from './render/edges';
import { arrowLabelGeom, frameTitleGeom } from './render/labelgeom';
import { frameRect } from './render/anchors';
import { contentBox } from './render/boxes';
import { drawCanvas, render, renderer } from './render/scene';
import type { ViewEdge, ViewNode } from './store/types';
import type { Group, LabelStyle } from '../core/model/figure';

declare global {
	interface Window {
		__sakugaTestHook?: boolean;
		__sakugaTest?: Record<string, unknown>;
	}
}

export function initTestHook() {
	// Test hook (S0): inert unless a test sets window.__sakugaTestHook = true before this script loads.
	if (window.__sakugaTestHook === true) {
		window.__sakugaTest = {
			layout,
			boxHalf: (n: ViewNode) => geo().half(n),
			resolveRoute: (e: ViewEdge) => geo().route(e),
			baseEdgeGeom: (e: ViewEdge) => geo().base(e),
			// the core answers before the canvas decides what to draw
			rawEdge: (e: ViewEdge) => geo().edge(e),
			rawLabel: (e: ViewEdge, st?: LabelStyle, content?: string, step?: number) => geo().label(e, st, content, step),
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
			setView: (v: Partial<typeof store.view>) => {
				Object.assign(store.view, v);
				store.moved = true;
			},
			render,
			// the canvas alone, without the panels (the perf budget measures this)
			drawCanvas,
			hit: (target: Element) => renderer.hit(target),
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
			view: () => store.view,
		};
	}
}
