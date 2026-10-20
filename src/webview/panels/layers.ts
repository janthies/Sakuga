// @ts-nocheck
import { store } from '../store/store';
import { calls } from '../store/calls';
import { renderLayers2, renderLayers3 } from './layers-rows';
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
	const list = document.getElementById('layer-list'),
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
const layerList = document.getElementById('layer-list');
export function renderLayers() {
	const ctx = {};
	if (renderLayers1(ctx)) return;
	if (renderLayers2(ctx)) return;
	if (renderLayers3(ctx)) return;
}
function renderLayers1(ctx) {
	ctx.list = document.getElementById('layer-list');
	if (ctx.list.querySelector('input')) {
		return true;
	}
	ctx.updateSelection = () => {
		for (const row of ctx.list.children) {
			const selected = row.classList.contains('container-layer')
				? store.selectedLayers.has(row.dataset.id)
				: groupById(row.dataset.id)
					? store.selG === row.dataset.id
					: store.selN.has(row.dataset.id);
			row.classList.toggle('selected', selected);
			row.setAttribute('aria-selected', String(selected));
			row.classList.remove('drop-group', 'drop-above', 'drop-below');
		}
		document.getElementById('group').disabled = !store.selN.size && !store.selG;
		document.getElementById('ungroup').disabled = !store.selG;
		const del = document.getElementById('delete-selection');
		if (del) {
			const count = store.selN.size + store.selE.size;
			del.textContent = store.selectedLayers.size ? 'Delete layer' : count === 1 ? 'Delete object' : 'Delete objects';
			del.disabled = store.selectedLayers.size ? store.layers.length < 2 : !count;
			del.title = del.textContent;
		}
		const move = document.querySelector('#layer-controls select');
		if (move) {
			move.disabled = !store.selN.size && !store.selG;
		}
	};
	if (store.selN.size || store.selE.size || store.selG) {
		store.selectedLayers.clear();
	}
	const signature = JSON.stringify([
		store.selN.size,
		store.selE.size,
		store.selG,
		store.layers,
		store.nodes.map((n) => [n.id, n.layer, n.group, n.title, n.cat, n.hidden, n.locked]),
		store.groups,
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
	ctx.button = (row, key, title, action) => {
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
	ctx.rename = (name, obj, op) => {
		const field = document.createElement('input');
		field.value = obj.name;
		name.replaceChildren(field);
		field.focus();
		field.select();
		let done = false;
		const finish = (commit) => {
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
		field.onblur = () => finish(true);
	};
	ctx.makeRow = (id, depth) => {
		const row = document.createElement('div');
		row.className = 'layer-row';
		row.dataset.id = id;
		row.draggable = true;
		row.setAttribute('role', 'treeitem');
		row.setAttribute('aria-level', depth + 1);
		ctx.list.appendChild(row);
		return row;
	};
	ctx.drop = (row, layer, target = null) => {
		row.ondragover = (ev) => {
			if (!store.layerDrag) {
				return;
			}
			ev.preventDefault();
			const fraction = (ev.clientY - row.getBoundingClientRect().top) / row.offsetHeight;
			row.classList.remove('drop-group', 'drop-above', 'drop-below');
			row.classList.add(
				!store.layerDrag.layer && (!target || (groupById(target) && fraction > 0.25 && fraction < 0.75))
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
			if (!store.layerDrag) {
				return;
			}
			if (store.layerDrag.layer) {
				const order = store.layers.map((l) => l.id).filter((id) => id !== store.layerDrag.layer);
				const above = ev.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
				order.splice(order.indexOf(layer.id) + (above ? 1 : 0), 0, store.layerDrag.layer);
				if (layer.id !== store.layerDrag.layer) {
					post({ op: 'reorderLayers', order });
				}
			} else {
				const ids = store.layerDrag;
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
				const into = groupById(target) && fraction > 0.25 && fraction < 0.75;
				if (target && same) {
					dropLayers(target, fraction < 0.5, into);
				} else {
					const ops = [{ op: 'setLayer', ids, layer: layer.id }];
					if (target) {
						const parent = groupById(target)
							? into
								? target
								: groupById(target).parent || ''
							: byId(target)?.group || '';
						ops.push({ op: 'setGroup', ids, group: parent });
						const order = store.nodes.filter((n) => !moving.has(n.id)).map((n) => n.id);
						const positions = groupById(target)
							? order.flatMap((id, i) => (inGroup(byId(id), target) ? [i] : []))
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
		if (!layerList.contains(ev.relatedTarget)) {
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
