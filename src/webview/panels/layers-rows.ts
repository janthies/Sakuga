// @ts-nocheck
import { store } from '../store/store';
import { calls } from '../store/calls';
import { byId, groupById, members, post, snap } from '../store/model';
import { render } from '../render/scene';
import { icon, show } from '../store/constants';
import { fillOf } from '../render/svg';
import { hierarchy, moveToLayer, newId, selectLayer, selectedRoots } from '../store/layers';
import { startEdit } from '../tools/edit';
import { svg } from '../platform/dom';
import { deleteSelection } from '../commands/clipboard';

export function renderLayers2(ctx) {
	for (const layer of [...store.layers].reverse()) {
		const ns = store.nodes.filter((n) => n.layer === layer.id),
			row = ctx.makeRow(layer.id, 0);
		row.classList.add('container-layer');
		row.classList.toggle('selected', store.selectedLayers.has(layer.id));
		for (const [prop, on, off] of [
			['hidden', 'eyeClosed', 'eye'],
			['locked', 'lock', 'unlock'],
		]) {
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
		count.textContent = ns.length;
		row.appendChild(count);
		row.onclick = (ev) => {
			if (ev.shiftKey) {
				const a = store.layers.findIndex((l) => l.id === store.activeLayer),
					b = store.layers.indexOf(layer);
				if (!(ev.ctrlKey || ev.metaKey)) {
					store.selectedLayers.clear();
				}
				for (const l of store.layers.slice(Math.min(a, b), Math.max(a, b) + 1)) {
					store.selectedLayers.add(l.id);
				}
			} else if (ev.ctrlKey || ev.metaKey) {
				if (!store.selectedLayers.size) {
					store.selectedLayers.add(store.activeLayer);
				}
				if (store.selectedLayers.has(layer.id)) {
					store.selectedLayers.delete(layer.id);
				} else {
					store.selectedLayers.add(layer.id);
				}
			} else {
				store.selectedLayers.clear();
				store.selectedLayers.add(layer.id);
			}
			store.activeLayer = layer.id;
			store.selN.clear();
			store.selE.clear();
			store.selG = null;
			render();
		};
		name.ondblclick = () => ctx.rename(name, layer, 'layerProps');
		row.ondragstart = (ev) => {
			store.layerDrag = { layer: layer.id };
			ev.dataTransfer.setData('text/plain', layer.id);
		};
		ctx.drop(row, layer);
		if (!store.expandedLayers.has(layer.id)) {
			continue;
		}
		const gs = store.groups.filter((g) => members(g.id).some((id) => ns.some((n) => n.id === id)));
		const visit = (items, depth) => {
			for (const item of items) {
				const g = groupById(item.id),
					n = byId(item.id),
					child = ctx.makeRow(item.id, depth);
				child.style.paddingLeft = `${depth * 12}px`;
				child.classList.toggle('selected', g ? store.selG === g.id : store.selN.has(n.id));
				if (g) {
					const d = ctx.button(child, 'triangle', 'Expand/collapse group', () => {
						if (store.collapsed.has(g.id)) {
							store.collapsed.delete(g.id);
						} else {
							store.collapsed.add(g.id);
						}
						calls.renderLayers();
					});
					d.classList.toggle('expanded', !store.collapsed.has(g.id));
					const folder = document.createElement('span');
					folder.innerHTML = icon('folder');
					child.appendChild(folder);
				} else {
					const swatch = document.createElement('i');
					swatch.className = 'layer-swatch';
					swatch.style.background = fillOf(n.cat);
					child.appendChild(swatch);
				}
				const label = document.createElement('span');
				label.className = 'layer-name';
				label.textContent = show(g ? g.name : n.title).replace(/\\/g, ' ');
				child.appendChild(label);
				child.onclick = (ev) => {
					store.selectedLayers.clear();
					store.activeLayer = layer.id;
					if (ev.shiftKey && store.layerAnchor) {
						const rows = [...ctx.list.children].filter((r) => !r.classList.contains('container-layer'));
						const a = rows.findIndex((r) => r.dataset.id === store.layerAnchor),
							b = rows.indexOf(child);
						if (a >= 0) {
							if (!(ev.ctrlKey || ev.metaKey)) {
								store.selN.clear();
							}
							for (const r of rows.slice(Math.min(a, b), Math.max(a, b) + 1)) {
								for (const id of groupById(r.dataset.id) ? members(r.dataset.id) : [r.dataset.id]) {
									if (byId(id) && !byId(id).locked && !byId(id).hidden) {
										store.selN.add(id);
									}
								}
							}
							store.selG = null;
							store.selE.clear();
						} else {
							selectLayer(item.id);
						}
					} else {
						selectLayer(item.id, ev.ctrlKey || ev.metaKey);
						store.layerAnchor = item.id;
					}
					store.keyObject =
						(ev.shiftKey || ev.ctrlKey || ev.metaKey) && (store.selN.has(item.id) || store.selG === item.id)
							? item.id
							: null;
					render();
				};
				label.ondblclick = () => {
					if (g) {
						ctx.rename(label, g, 'groupProps');
					} else if (!n.locked && !n.hidden) {
						startEdit(n.id);
					}
				};
				child.ondragstart = (ev) => {
					ev.stopPropagation();
					if ((g ? members(g.id) : [n.id]).some((id) => byId(id).locked || byId(id).hidden)) {
						ev.preventDefault();
						return;
					}
					if (g ? store.selG !== g.id : !store.selN.has(item.id)) {
						selectLayer(item.id);
					}
					store.layerDrag = selectedRoots();
					ev.dataTransfer.setData('text/plain', item.id);
				};
				ctx.drop(child, layer, item.id);
				if (!store.collapsed.has(item.id)) {
					visit(item.children, depth + 1);
				}
			}
		};
		visit(hierarchy(ns, gs), 1);
	}
}
export function renderLayers3(ctx) {
	let controls = document.getElementById('layer-controls');
	if (!controls) {
		controls = document.createElement('div');
		controls.id = 'layer-controls';
		document.getElementById('layer-tools').prepend(controls);
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
	const addObject = document.createElement('button');
	addObject.textContent = '+ Object';
	addObject.className = 'lc lc-obj';
	addObject.title = 'New box on the active layer';
	addObject.onclick = () => {
		const r = svg.getBoundingClientRect(),
			id = newId();
		store.pendingEdit = id;
		store.pendingSelect = [id];
		store.selectedLayers.clear();
		post({
			op: 'addNode',
			id,
			title: 'Box',
			cat: store.lastCat,
			x: snap((r.width / 2 - store.view.ox) / store.view.s),
			y: snap((store.view.oy - r.height / 2) / store.view.s),
		});
	};
	controls.appendChild(addObject);
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
	document.getElementById('group').disabled = !store.selN.size && !store.selG;
	document.getElementById('ungroup').disabled = !store.selG;
}
