import { startEdit, beginEdit } from '../tools/live/dispatch';
import { store } from '../store/store';
import { calls } from '../store/calls';
import { byId } from '../store/model';
import { newId } from '../store/layers';
import { render } from '../render/scene';
import type { Op } from './registry/types';

export function selectedItems(): string[] {
	const label = store.selN.label;
	if (label && store.selN.size <= 1 && !store.selE.size && !store.selG) {
		const owner = label.group || store.edges[label.index!]?.id;
		return store.items
			.filter(
				(i) => i.parent === owner && i.kind === 'Text' && i.order === (label.slot === undefined ? 0 : label.slot + 1),
			)
			.map((i) => i.id);
	}
	return [
		...new Set([
			...(store.selG ? [store.selG] : []),
			...[...store.selN].filter((id) => {
				if (!store.selG) return true;
				let item = store.items.find((i) => i.id === id);
				const seen = new Set<string>();
				while (item && !seen.has(item.id)) {
					seen.add(item.id);
					if (item.parent === store.selG) return false;
					item = store.items.find((i) => i.id === item!.parent);
				}
				return true;
			}),
			...[...store.selE].map((i) => store.edges[i]?.id).filter((id): id is string => !!id),
		]),
	];
}
let escapedSelection = '';

export function interact(action: string, args: any = {}): Op | void {
	if (action !== 'selection.parent') escapedSelection = '';
	const ids = selectedItems(),
		p = args.p || { x: 0, y: 0 };
	switch (action) {
		case 'canvas.wheel':
			calls.openWheel?.(args.screen);
			return;
		case 'create.shape': {
			const id = newId();
			store.pendingEdit = id;
			store.pendingSelect = [id];
			return {
				op: 'addNode',
				id,
				title: 'Box',
				cat: store.cats.some((c) => c.key === store.lastCat) ? store.lastCat : '',
				x: p.x,
				y: p.y,
			};
		}
		case 'create.text': {
			const id = newId(),
				parent = args.attach && ids.length === 1 ? ids[0] : store.activeLayer;
			store.pendingEdit = id;
			return { op: 'addText', id, parent, text: 'Label', x: p.x, y: p.y };
		}
		case 'create.icon': {
			if (!args.icon) {
				calls.chooseCanvasIcon?.(args);
				return;
			}
			const id = newId(),
				parent = args.attach && ids.length === 1 ? ids[0] : null;
			store.pendingSelect = [id];
			const op = {
				op: 'addNode',
				id,
				kind: 'icon',
				icon: args.icon,
				title: '',
				width: 8,
				minh: 8,
				x: p.x,
				y: p.y,
				cat: '',
			};
			return parent ? { op: 'batch', ops: [op, { op: 'reparent', id, newParent: parent }] } : op;
		}
		case 'create.line': {
			const id = newId();
			return { op: 'addLine', id, start: [p.x, p.y], end: [p.x + 20, p.y], layer: store.activeLayer };
		}
		case 'selection.editLabel': {
			const item = store.items.find((i) => i.id === ids[0]);
			if (item?.kind === 'Connector') {
				beginEdit({ kind: 'edge', index: store.edges.findIndex((e) => e.id === item.id) });
				return;
			}
			if (item?.kind === 'Frame' || item?.kind === 'Line') {
				const label = store.items.find((i) => i.parent === item.id && i.kind === 'Text');
				if (label) startEdit(label.id);
				else return interact('create.text', { ...args, attach: true });
				return;
			}
			if (item) startEdit(item.id);
			return;
		}
		case 'selection.hide':
			return { op: 'hide', ids, hidden: true };
		case 'selection.lock':
			return { op: 'lock', ids, locked: true };
		case 'selection.setCategory':
			return { op: 'batch', ops: ids.map((id) => ({ op: 'setCategory', id, category: args.category })) };
		case 'selection.detach':
			return { op: 'batch', ops: ids.map((id) => ({ op: 'detach', id })) };
		case 'selection.resetLook':
			return { op: 'batch', ops: ids.map((id) => ({ op: 'resetOverride', id })) };
		case 'selection.applyLook':
			return {
				op: 'batch',
				ops: ids.map((id) => ({
					op: store.items.find((i) => i.id === id)?.cat ? 'applyToCategory' : 'applyToTheme',
					id,
				})),
			};
		case 'selection.toLayer':
			return {
				op: 'batch',
				ops: ids
					.filter((id) => store.items.find((i) => i.id === id)?.kind !== 'Connector')
					.map((id) => ({ op: 'reparent', id, newParent: args.layer })),
			};
		case 'selection.forward':
		case 'selection.backward':
		case 'selection.back': {
			const delta = action === 'selection.forward' ? 1 : -1;
			const ops: Op[] = [];
			for (const id of ids) {
				const item = store.items.find((i) => i.id === id);
				if (!item || item.kind === 'Connector') continue;
				const siblings = store.items.filter((i) => i.parent === item.parent).sort((a, b) => a.order - b.order);
				ops.push({
					op: 'reparent',
					id,
					newParent: item.parent,
					index:
						action === 'selection.back'
							? 0
							: Math.max(0, Math.min(siblings.length - 1, siblings.findIndex((i) => i.id === id) + delta)),
				});
			}
			return { op: 'batch', ops };
		}
		case 'selection.parent': {
			const item = store.items.find((i) => i.id === ids[0]),
				parent = escapedSelection === JSON.stringify(ids) ? undefined : store.items.find((i) => i.id === item?.parent);
			escapedSelection = parent ? JSON.stringify([parent.id]) : '';
			store.selN = new Set();
			store.selE.clear();
			store.selG = null;
			store.selectedLayers.clear();
			if (parent?.kind === 'Connector') {
				const i = store.edges.findIndex((e) => e.id === parent.id);
				if (i >= 0) store.selE.add(i);
			} else if (parent?.kind === 'Frame') {
				store.selG = parent.id;
				const inside = (id: string): boolean => {
					const item = store.items.find((i) => i.id === id);
					return (
						!!item &&
						(item.parent === parent.id ||
							(!!store.items.find((p) => p.id === item.parent && p.kind === 'Frame') && inside(item.parent)))
					);
				};
				for (const n of [...store.nodes, ...store.lines]) if (inside(n.id)) store.selN.add(n.id);
			} else if (parent) store.selN.add(parent.id);
			render();
			return;
		}
		case 'layer.select': {
			const layer = args.id;
			store.activeLayer = layer;
			store.selG = null;
			if (!args.additive) {
				store.selN = new Set();
				store.selE.clear();
				store.selectedLayers.clear();
			}
			store.selectedLayers.add(layer);
			for (const i of store.items) {
				let root = i;
				const seen = new Set<string>();
				while (!seen.has(root.id)) {
					seen.add(root.id);
					const parent = store.items.find((p) => p.id === root.parent);
					if (!parent) break;
					root = parent;
				}
				if (root.parent !== layer || i.hidden || i.locked) continue;
				if (i.kind === 'Connector') {
					const ix = store.edges.findIndex((e) => e.id === i.id);
					if (ix >= 0) store.selE.add(ix);
				} else store.selN.add(i.id);
			}
			render();
			return;
		}
		case 'selection.deleteItems': {
			const op = { op: 'batch', ops: ids.map((id) => ({ op: 'deleteItem', id })) };
			store.selN = new Set();
			store.selE.clear();
			store.selG = null;
			return op;
		}
	}
}
