import { FigureGeometry } from '../../src/core/geometry/figure-geometry';
import { buildScene } from '../../src/core/scene';
import type { SceneInput, SceneOpts } from '../../src/core/scene';
import { read } from './env';

const ICONS = JSON.parse(read('icons/icons.json'));
const { viewModel } = require('../../src/core/view/viewModel');

// The snapshot the host would send for this file, with attached boxes placed as the webview places them.
export function sceneInput(text: string): SceneInput {
	const m = viewModel(text);
	const input: SceneInput = {
		nodes: m.nodes,
		edges: m.edges,
		groups: m.groups,
		categories: m.categories,
		layers: m.layers,
		legend: m.legend,
		font: m.font,
		arrowStyle: m.arrows,
	};
	new FigureGeometry({ ...input }).place(input.nodes);
	return input;
}

export function sceneOf(text: string, opts: SceneOpts = {}) {
	return buildScene(sceneInput(text), { icons: ICONS }, opts);
}
