import { renderLayerItems } from './layers-items';
import { appState } from '../commands/state';
import { runCommand } from '../commands/registry';
import { store } from '../store/store';
import { calls } from '../store/calls';
import { byId, groupById, members, post, snap } from '../store/model';
import { render } from '../render/scene';
import { icon, show } from '../store/constants';
import { fillOf } from '../render/svg';
import { hierarchy, moveToLayer, newId, selectLayer, selectedRoots } from '../store/layers';
import { startEdit } from '../tools/live/dispatch';
import { svg } from '../platform/dom';
import { deleteSelection } from '../commands/clipboard';
import type { Layer } from '../store/types';

import type { LayerCtx } from './layers-context';
export type { LayerCtx } from './layers-context';

export function renderLayers2(ctx: LayerCtx) {
	for (const layer of [...store.layers].reverse()) {
		const ns = store.nodes.filter((n) => n.layer === layer.id),
			row = ctx.makeRow(layer.id, 0);
		row.classList.add('container-layer');
		row.classList.toggle('selected', store.selectedLayers.has(layer.id));
		for (const [prop, on, off] of [
			['hidden', 'eyeClosed', 'eye'],
			['locked', 'lock', 'unlock'],
		] as const) {
			ctx.button(row, layer[prop] ? on : off, `${layer[prop] ? 'Disable' : 'Enable'} ${prop}`, () =>
				post({ op: 'layerProps', id: layer.id, [prop]: !layer[prop] }),
			);
		}
		const disclosure = ctx.button(
			row,
			'triangle',
			store.expandedLayers.has(layer.id) ? 'Collapse layer' : 'Expand layer',
			() => {
				if (store.expandedLayers.has(layer.id)) {
					store.expandedLayers.delete(layer.id);
				} else {
					store.expandedLayers.add(layer.id);
				}
				calls.renderLayers();
			},
		);
		disclosure.classList.toggle('expanded', store.expandedLayers.has(layer.id));
		row.setAttribute('aria-expanded', String(store.expandedLayers.has(layer.id)));
		const name = document.createElement('span');
		name.className = 'layer-name';
		name.textContent = layer.name;
		row.appendChild(name);
		const count = document.createElement('span');
		count.className = 'layer-count';
		count.textContent = String(ns.length);
		row.appendChild(count);
		row.onclick = (ev) => {
			runCommand(appState, 'layer.select', { id: layer.id, additive: ev.shiftKey || ev.ctrlKey || ev.metaKey });
		};
		name.ondblclick = () => ctx.rename(name, layer, 'layerProps');
		row.ondragstart = (ev) => {
			store.layerDrag = { layer: layer.id };
			ev.dataTransfer?.setData('text/plain', layer.id);
		};
		ctx.drop(row, layer);
		if (!store.expandedLayers.has(layer.id)) {
			continue;
		}
		renderLayerItems(ctx, layer);
	}
}
export function renderLayers3(ctx: LayerCtx) {
	let controls = document.getElementById('layer-controls');
	if (!controls) {
		controls = document.createElement('div');
		controls.id = 'layer-controls';
		document.getElementById('layer-tools')!.prepend(controls);
	}
	controls.replaceChildren();
	const add = document.createElement('button');
	add.textContent = '+ Layer';
	add.className = 'lc lc-add';
	add.title = 'New layer';
	add.onclick = () => {
		let i = 1;
		while (store.layers.some((l) => l.id === `layer${i}`)) {
			i++;
		}
		store.activeLayer = `layer${i}`;
		store.selN.clear();
		store.selE.clear();
		store.selG = null;
		store.selectedLayers.clear();
		store.selectedLayers.add(store.activeLayer);
		post({ op: 'addLayer', id: store.activeLayer, name: `Layer ${i}` });
	};
	controls.appendChild(add);
	const dup = document.createElement('button');
	dup.textContent = 'Duplicate';
	dup.className = 'lc lc-dup';
	dup.title = 'Duplicate layer';
	dup.onclick = () => {
		let id = 'layer-copy',
			i = 2;
		while (store.layers.some((l) => l.id === id)) {
			id = `layer-copy-${i++}`;
		}
		const source = store.activeLayer;
		store.activeLayer = id;
		store.selN.clear();
		store.selE.clear();
		store.selG = null;
		store.selectedLayers.clear();
		store.selectedLayers.add(id);
		post({ op: 'batch', ops: [{ op: 'duplicateLayer', id: source, newId: id }] });
	};
	controls.appendChild(dup);
	const merge = document.createElement('button');
	merge.textContent = store.selectedLayers.size > 1 ? 'Merge selected' : 'Merge down';
	merge.className = 'lc lc-merge';
	merge.title = merge.textContent;
	merge.disabled = store.selectedLayers.size < 2 && store.layers.findIndex((l) => l.id === store.activeLayer) < 1;
	merge.onclick = () => {
		const ids =
			store.selectedLayers.size > 1
				? store.layers.filter((l) => store.selectedLayers.has(l.id)).map((l) => l.id)
				: [store.layers[store.layers.findIndex((l) => l.id === store.activeLayer) - 1].id, store.activeLayer];
		const target = ids[0];
		post({ op: 'batch', ops: [{ op: 'mergeLayers', ids, target }] });
		store.activeLayer = target;
		store.selN.clear();
		store.selE.clear();
		store.selG = null;
		store.selectedLayers.clear();
		store.selectedLayers.add(target);
	};
	controls.appendChild(merge);
	const del = document.createElement('button');
	del.id = 'delete-selection';
	del.className = 'lc lc-del';
	del.title = 'Delete';
	del.onclick = () => {
		if (store.selectedLayers.size) {
			post({ op: 'batch', ops: [...store.selectedLayers].map((id) => ({ op: 'deleteLayer', id })) });
			store.selectedLayers.clear();
		} else {
			deleteSelection();
		}
		render();
	};
	controls.appendChild(del);
	const move = document.createElement('select');
	move.setAttribute('aria-label', 'Move selection to layer');
	const placeholder = new Option('Move selection to…', '');
	move.appendChild(placeholder);
	for (const l of store.layers) {
		move.appendChild(new Option(l.name, l.id));
	}
	move.disabled = !store.selN.size && !store.selG;
	move.onchange = () => {
		if (move.value) {
			moveToLayer(selectedRoots(), move.value);
		}
	};
	controls.appendChild(move);
	ctx.updateSelection();
	(document.getElementById('group') as HTMLButtonElement).disabled = !store.selN.size && !store.selG;
	(document.getElementById('ungroup') as HTMLButtonElement).disabled = !store.selG;
}
