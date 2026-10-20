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
	if (store.selN.size || store.selE.size || store.selG) {
		store.selectedLayers.clear();
	}
	etools.style.display = 'none';
	const scene = sceneNow();
	const overlay = buildOverlay();
	renderer.draw(scene, overlay.prims, viewNow());
	return overlay.edge;
}

// The canvas, then the floating toolbar and the panels that follow the document and the selection.
export function render() {
	const edge = drawCanvas();
	if (edge && !store.drag) {
		calls.showToolbar(edge.i, edge.G);
	}
	calls.renderInspector();
	calls.renderLayers();
	calls.updateZoombar();
}

// Only the view changed (pan, zoom, resize): the scene stays, the view transform and the overlay move.
export function renderView() {
	etools.style.display = 'none';
	const overlay = buildOverlay();
	renderer.setView(viewNow(), overlay.prims);
	if (overlay.edge && !store.drag) {
		calls.showToolbar(overlay.edge.i, overlay.edge.G);
	}
	calls.updateZoombar();
}
