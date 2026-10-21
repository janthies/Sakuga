// The adapter between the store and the renderer: build the scene and the overlay from the store, draw them.
import { buildScene } from '../../core/scene';
import { store } from '../store/store';
import { calls } from '../store/calls';
import { geo, touch } from '../store/geometry';
import { etools, svg } from '../platform/dom';
import { createRenderer } from './renderer';
import { buildOverlay } from './overlay';

export const renderer = createRenderer(svg);

function viewNow() {
	const r = svg.getBoundingClientRect();
	return { ...store.view, width: r.width, height: r.height, grid: store.grid };
}
function sceneNow() {
	return buildScene(
		{
			nodes: store.nodes,
			outerGap: store.outerGap,
			lines: store.lines,
			edges: store.edges,
			groups: store.groups,
			categories: store.cats,
			layers: store.layers,
			legend: store.legend,
			font: store.figureFont,
			arrowStyle: store.arrowsStyle,
		},
		{ icons: store.icons, geometry: geo() },
		{ editing: store.editing, haloEdges: [...store.selE] },
	);
}

// Everything changed (or may have): rebuild the scene and patch the canvas. Returns the selected arrow, if any.
export function drawCanvas() {
	touch();
	etools.style.display = 'none';
	const scene = sceneNow();
	const overlay = buildOverlay();
	renderer.draw(scene, overlay.prims, viewNow());
	return overlay.edge;
}

// The canvas and the panels that follow the document and selection.
export function render() {
	drawCanvas();
	calls.renderInspector();
	calls.renderLayers();
	calls.updateZoombar();
}

// Only the view changed (pan, zoom, resize): the scene stays, the view transform and the overlay move.
export function renderView() {
	etools.style.display = 'none';
	const overlay = buildOverlay();
	renderer.setView(viewNow(), overlay.prims);
	calls.updateZoombar();
}
