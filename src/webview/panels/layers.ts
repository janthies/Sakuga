import { itemSelected, revealSelection } from './layers-items';
import { store } from '../store/store';
import { calls } from '../store/calls';
import { LayerCtx, renderLayers2, renderLayers3 } from './layers-rows';
import type { Layer } from '../store/types';
import type { Op } from '../store/types';
import { byId, groupById, inGroup, members, post } from '../store/model';
import { icon } from '../store/constants';
import { render } from '../render/scene';
import { dropLayers } from '../store/layers';

function stopLayerScroll() {
	if (store.layerScrollFrame !== null) {
		cancelAnimationFrame(store.layerScrollFrame);
	}
	store.layerScrollFrame = null;
	store.layerPointerY = null;
}
function scrollLayers() {
	const list = document.getElementById('layer-list')!,
		rect = list.getBoundingClientRect(),
		margin = 32;
	if (!store.layerDrag || store.layerPointerY === null) {
		stopLayerScroll();
		return;
	}
	const speed =
		store.layerPointerY < rect.top + margin
			? -Math.min(12, (rect.top + margin - store.layerPointerY) / 3)
			: store.layerPointerY > rect.bottom - margin
				? Math.min(12, (store.layerPointerY - rect.bottom + margin) / 3)
				: 0;
	list.scrollTop += speed;
	store.layerScrollFrame = requestAnimationFrame(scrollLayers);
}
const layerList = document.getElementById('layer-list')!;
export function renderLayers() {
	const reveal = revealSelection();
	const ctx = {} as LayerCtx;
	if (renderLayers1(ctx)) return;
	renderLayers2(ctx);
	renderLayers3(ctx);
	if (reveal)
		ctx.list.querySelector<HTMLElement>('.selected:not(.container-layer)')?.scrollIntoView?.({ block: 'nearest' });
}
function renderLayers1(ctx: LayerCtx): boolean {
	ctx.list = document.getElementById('layer-list')!;
	if (ctx.list.querySelector('input')) {
		return true;
	}
	ctx.updateSelection = () => {
		for (const row of ctx.list.children as HTMLCollectionOf<HTMLElement>) {
			const id = row.dataset.id!;
			const item = store.items.find((i) => i.id === id);
			const selected = row.classList.contains('container-layer')
				? store.selectedLayers.has(id)
				: !!item && itemSelected(item);
			row.classList.toggle('selected', selected);
			row.setAttribute('aria-selected', String(selected));
			row.classList.remove('drop-group', 'drop-above', 'drop-below');
		}
		(document.getElementById('group') as HTMLButtonElement).disabled = !store.selN.size && !store.selG;
		(document.getElementById('ungroup') as HTMLButtonElement).disabled = !store.selG;
		const del = document.getElementById('delete-selection') as HTMLButtonElement | null;
		if (del) {
			const count = store.selN.size + store.selE.size;
			del.textContent = store.selectedLayers.size ? 'Delete layer' : count === 1 ? 'Delete object' : 'Delete objects';
			del.disabled = store.selectedLayers.size ? store.layers.length < 2 : !count;
			del.title = del.textContent;
		}
		const move = document.querySelector<HTMLSelectElement>('#layer-controls select');
		if (move) {
			move.disabled = !store.selN.size && !store.selG;
		}
	};
	const signature = JSON.stringify([
		store.selN.size,
		store.selE.size,
		store.selG,
		store.layers,
		store.nodes.map((n) => [n.id, n.layer, n.group, n.title, n.cat, n.hidden, n.locked]),
		store.groups,
		store.items.map((i) => [i.id, i.parent, i.order, i.hidden, i.locked, i.kind === 'Text' ? i.text : '']),
		store.cats,
		store.palette,
		store.activeLayer,
		[...store.selectedLayers],
		[...store.expandedLayers],
		[...store.collapsed],
	]);
	if (signature === store.layerSignature) {
		ctx.updateSelection();
		return true;
	}
	store.layerSignature = signature;
	ctx.list.replaceChildren();
	ctx.button = (row: HTMLElement, key: Parameters<typeof icon>[0], title: string, action: () => void) => {
		const b = document.createElement('button');
		b.innerHTML = icon(key);
		b.title = title;
		b.setAttribute('aria-label', title);
		b.onclick = (ev) => {
			ev.stopPropagation();
			action();
		};
		b.ondblclick = (ev) => ev.stopPropagation();
		row.appendChild(b);
		return b;
	};
	ctx.rename = (name: HTMLElement, obj: { id: string; name: string }, op: string) => {
		const field = document.createElement('input');
		field.value = obj.name;
		name.replaceChildren(field);
		field.focus();
		field.select();
		let done = false;
		const finish = (commit: boolean) => {
			if (done) {
				return;
			}
			done = true;
			if (commit && field.value.trim()) {
				post({ op, id: obj.id, name: field.value.trim() });
			}
			field.remove();
			store.layerSignature = '';
			renderLayers();
		};
		field.onclick = (ev) => ev.stopPropagation();
		field.onkeydown = (ev) => {
			ev.stopPropagation();
			if (ev.key === 'Enter' || ev.key === 'Escape') {
				finish(ev.key === 'Enter');
			}
		};
		field.onchange = () => finish(true);
		field.onblur = () => finish(true);
	};
	ctx.makeRow = (id: string, depth: number) => {
		const row = document.createElement('div');
		row.className = 'layer-row';
		row.dataset.id = id;
		row.draggable = true;
		row.setAttribute('role', 'treeitem');
		row.setAttribute('aria-level', String(depth + 1));
		ctx.list.appendChild(row);
		return row;
	};
	ctx.drop = (row: HTMLElement, layer: Layer, target: string | null = null) => {
		row.ondragover = (ev) => {
			const drag = store.layerDrag;
			if (!drag) {
				return;
			}
			ev.preventDefault();
			const fraction = (ev.clientY - row.getBoundingClientRect().top) / row.offsetHeight;
			row.classList.remove('drop-group', 'drop-above', 'drop-below');
			row.classList.add(
				Array.isArray(drag) && (!target || (groupById(target) && fraction > 0.25 && fraction < 0.75))
					? 'drop-group'
					: fraction < 0.5
						? 'drop-above'
						: 'drop-below',
			);
		};
		row.ondragleave = () => row.classList.remove('drop-group', 'drop-above', 'drop-below');
		row.ondrop = (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			const drag = store.layerDrag;
			if (!drag) {
				return;
			}
			if (!Array.isArray(drag)) {
				const order = store.layers.map((l) => l.id).filter((id) => id !== drag.layer);
				const above = ev.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
				order.splice(order.indexOf(layer.id) + (above ? 1 : 0), 0, drag.layer);
				if (layer.id !== drag.layer) {
					post({ op: 'reorderLayers', order });
				}
			} else {
				const ids = drag;
				if (!ids.length) {
					store.layerDrag = null;
					return;
				}
				const moving = new Set(ids.flatMap((id) => (groupById(id) ? members(id) : [id])));
				if (target && (moving.has(target) || ids.includes(target))) {
					store.layerDrag = null;
					render();
					return;
				}
				const same = [...moving].every((id) => byId(id)?.layer === layer.id);
				const fraction = (ev.clientY - row.getBoundingClientRect().top) / row.offsetHeight;
				const into = !!groupById(target) && fraction > 0.25 && fraction < 0.75;
				if (target && same) {
					dropLayers(target, fraction < 0.5, into);
				} else {
					const ops: Op[] = [{ op: 'setLayer', ids, layer: layer.id }];
					if (target) {
						const parent = groupById(target)
							? into
								? target
								: groupById(target)?.parent || ''
							: byId(target)?.group || '';
						ops.push({ op: 'setGroup', ids, group: parent });
						const order = store.nodes.filter((n) => !moving.has(n.id)).map((n) => n.id);
						const positions = groupById(target)
							? order.flatMap((id, i) => (inGroup(byId(id)!, target) ? [i] : []))
							: [order.indexOf(target)];
						const at = positions.length
							? into || fraction < 0.5
								? Math.max(...positions) + 1
								: Math.min(...positions)
							: order.length;
						order.splice(at, 0, ...store.nodes.filter((n) => moving.has(n.id)).map((n) => n.id));
						ops.push({ op: 'reorder', order });
					}
					post({ op: 'batch', ops });
				}
				store.activeLayer = layer.id;
			}
			store.layerDrag = null;
			render();
		};
		row.ondragend = () => {
			store.layerDrag = null;
			render();
		};
	};
	return false;
}

calls.renderLayers = renderLayers;

export function initPanelsLayers() {
	layerList.addEventListener('dragover', (ev) => {
		if (store.layerDrag) {
			ev.preventDefault();
			store.layerPointerY = ev.clientY;
			if (store.layerScrollFrame === null) {
				store.layerScrollFrame = requestAnimationFrame(scrollLayers);
			}
		}
	});
	layerList.addEventListener('dragleave', (ev) => {
		if (!layerList.contains(ev.relatedTarget as Node | null)) {
			stopLayerScroll();
		}
	});
	for (const event of ['drop', 'dragend']) {
		document.addEventListener(event, () => {
			stopLayerScroll();
			layerList
				.querySelectorAll('.drop-group,.drop-above,.drop-below')
				.forEach((row) => row.classList.remove('drop-group', 'drop-above', 'drop-below'));
		});
	}
}
