import { store } from '../store/store';
import { calls } from '../store/calls';
import { show } from '../store/constants';
import { selectLayer, selectedRoots } from '../store/layers';
import { render } from '../render/scene';
import { startEdit } from '../tools/live/dispatch';
import type { Item } from '../../core/model/item';
import type { LayerCtx } from './layers-context';
import type { Layer } from '../store/types';

export const itemSelected = (item: Item) =>
	item.kind === 'Connector'
		? store.selE.has(store.edges.findIndex((e) => e.id === item.id))
		: store.selN.has(item.id) || store.selG === item.id;
const names = { Shape: 'Box', Frame: 'Group', Text: 'Label', Icon: 'Icon', Line: 'Line', Connector: 'Arrow' };
function nameOf(item: Item) {
	return item.kind === 'Frame'
		? item.frame.name
		: item.kind === 'Text'
			? item.text
			: item.kind === 'Connector'
				? `${item.source.id} → ${item.target.id}`
				: 'node' in item
					? item.node?.title || names[item.kind]
					: names[item.kind];
}
export function renderLayerItems(ctx: LayerCtx, layer: Layer) {
	const visit = (parent: string, depth: number, seen = new Set<string>()) => {
		for (const item of store.items
			.filter((i) => i.parent === parent && !seen.has(i.id))
			.sort((a, b) => b.order - a.order)) {
			const row = ctx.makeRow(item.id, depth);
			row.style.paddingLeft = `${depth * 12}px`;
			row.classList.toggle('selected', itemSelected(item));
			const children = store.items.filter((i) => i.parent === item.id);
			if (children.length) {
				const d = ctx.button(row, 'triangle', 'Expand/collapse ' + names[item.kind].toLowerCase(), () => {
					if (store.collapsed.has(item.id)) store.collapsed.delete(item.id);
					else store.collapsed.add(item.id);
					calls.renderLayers();
				});
				d.classList.toggle('expanded', !store.collapsed.has(item.id));
			}
			const label = document.createElement('span');
			label.className = 'layer-name';
			label.textContent = show(nameOf(item)).replace(/\\\\/g, ' ');
			label.title = names[item.kind];
			row.append(label);
			row.onclick = (e) => {
				store.selectedLayers.clear();
				store.activeLayer = layer.id;
				const toggle = e.shiftKey || e.ctrlKey || e.metaKey;
				if (item.kind === 'Frame') selectLayer(item.id, toggle);
				else {
					const selected = itemSelected(item);
					if (!toggle) {
						store.selN = new Set();
						store.selE.clear();
						store.selG = null;
					}
					if (item.kind === 'Connector') {
						const i = store.edges.findIndex((ed) => ed.id === item.id);
						if (toggle && selected) store.selE.delete(i);
						else store.selE.add(i);
					} else if (toggle && selected) store.selN.delete(item.id);
					else store.selN.add(item.id);
				}
				store.layerAnchor = item.id;
				render();
			};
			label.ondblclick = () => {
				if (item.kind === 'Frame') ctx.rename(label, { id: item.id, name: item.frame.name }, 'groupProps');
				else if (!item.locked && !item.hidden) startEdit(item.id);
			};
			row.ondragstart = (e) => {
				e.stopPropagation();
				if (item.locked || item.hidden) {
					e.preventDefault();
					return;
				}
				if (!itemSelected(item)) row.click();
				store.layerDrag = selectedRoots();
				e.dataTransfer?.setData('text/plain', item.id);
			};
			ctx.drop(row, layer, item.id);
			if (!store.collapsed.has(item.id)) visit(item.id, depth + 1, new Set([...seen, item.id]));
		}
	};
	visit(layer.id, 1);
}

// Reveal the selected item once per selection change, so manual collapsing still works.
let lastSelection = '';
export function revealSelection() {
	const selected = store.items.filter(itemSelected),
		signature = JSON.stringify(selected.map((i) => i.id));
	if (signature === lastSelection) return false;
	lastSelection = signature;
	for (const item of selected) {
		let parent = item.parent;
		const seen = new Set<string>();
		while (!seen.has(parent)) {
			seen.add(parent);
			store.collapsed.delete(parent);
			const ancestor = store.items.find((i) => i.id === parent);
			if (!ancestor) {
				store.expandedLayers.add(parent);
				break;
			}
			parent = ancestor.parent;
		}
	}
	return true;
}
