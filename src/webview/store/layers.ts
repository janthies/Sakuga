import { store } from './store';
import { byId, groupById, inGroup, members, post } from './model';
import { KIND_NAMES, show } from './constants';
import { hierarchy as coreHierarchy } from '../../core/scene';
import type { Group } from '../../core/model/figure';
import type { ViewNode } from './types';

type Item = { kind: string; id: string; children: Item[] };

// Sort sibling subtrees by their frontmost node, then flatten each subtree as a block.
export const hierarchy = (ns = store.nodes, gs = store.groups) => coreHierarchy(ns, gs);
export function completeOrder(ns: ViewNode[], gs: Group[]) {
	const flatten = (items: Item[]): string[] =>
		items.flatMap((item) => (item.kind === 'node' ? [item.id] : flatten(item.children)));
	const front = flatten(hierarchy(ns, gs) as Item[]);
	return [...ns.map((n) => n.id).filter((id) => !front.includes(id)), ...front.reverse()];
}
export function selectedRoots() {
	const selected = new Set([...(store.selG ? [store.selG] : []), ...store.selN]);
	return [...selected].filter((id) => {
		let item = store.items.find((i) => i.id === id);
		const seen = new Set<string>();
		while (item && !seen.has(item.id)) {
			seen.add(item.id);
			if (selected.has(item.parent)) return false;
			item = store.items.find((i) => i.id === item!.parent);
		}
		return true;
	});
}
export function selectLayer(id: string, toggle = false) {
	const group = groupById(id),
		ids = group ? members(id) : [id];
	if (!toggle) {
		store.selN = new Set();
	}
	const remove = toggle && (group ? store.selG === id : store.selN.has(id));
	for (const key of ids.filter((key) => byId(key) && !byId(key)!.hidden && !byId(key)!.locked)) {
		if (remove) {
			store.selN.delete(key);
		} else {
			store.selN.add(key);
		}
	}
	store.selG = group && !remove && ids.some((key) => byId(key) && !byId(key)!.hidden && !byId(key)!.locked) ? id : null;
	store.keyObject = toggle && !remove ? id : null;
	store.selE = new Set();
}
export function dropLayers(target: string, above: boolean, into = true) {
	// A layer-row drag ({ layer }) is dropped by the layer panel itself.
	if (!Array.isArray(store.layerDrag)) {
		return;
	}
	const roots = store.layerDrag;
	const moving = new Set(roots.flatMap((id) => (groupById(id) ? members(id) : [id])));
	const targetGroup = groupById(target);
	const parent = targetGroup ? (into ? target : targetGroup.parent || '') : byId(target)?.group || '';
	if (
		roots.includes(target) ||
		moving.has(target) ||
		roots.some((id) => groupById(id) && (id === parent || inGroup({ group: parent }, id)))
	) {
		return;
	}
	const gs = store.groups.map((g) => ({ ...g, parent: roots.includes(g.id) ? parent : g.parent }));
	let ns = store.nodes.filter((n) => !moving.has(n.id));
	const block = store.nodes
		.filter((n) => moving.has(n.id))
		.map((n) => ({ ...n, group: roots.includes(n.id) ? parent : n.group }));
	let at: number;
	if (targetGroup) {
		const indices = ns.flatMap((n, i) => (inGroup(n, target, gs) ? [i] : []));
		at = indices.length ? (into || above ? Math.max(...indices) + 1 : Math.min(...indices)) : ns.length;
	} else {
		at = ns.findIndex((n) => n.id === target) + (above ? 1 : 0);
	}
	ns.splice(at, 0, ...block);
	post({
		op: 'batch',
		ops: [
			{ op: 'setGroup', ids: roots, group: parent },
			{ op: 'reorder', order: completeOrder(ns, gs) },
		],
	});
}
export function moveToLayer(ids: string[], layer: string) {
	if (!ids.length) {
		return;
	}
	post({ op: 'batch', ops: [{ op: 'setLayer', ids, layer }] });
	store.activeLayer = layer;
}
export function slug(name: string, except?: string) {
	const base =
		show(name)
			.toLowerCase()
			.replace(/ä/g, 'ae')
			.replace(/ö/g, 'oe')
			.replace(/ü/g, 'ue')
			.replace(/ß/g, 'ss')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'cat';
	let key = base;
	for (let i = 2; store.styles.some((s) => s.key === key && s.key !== except); i++) {
		key = `${base}-${i}`;
	}
	return key;
}
export function newId() {
	const used = [...store.items, ...store.nodes].map((n) => +(/^n(\d+)$/.exec(n.id) || [0, 0])[1]);
	return 'n' + (Math.max(0, ...used) + 1);
}
export function nextStyleName(kind: keyof typeof KIND_NAMES) {
	let i = store.styles.filter((s) => s.kind === kind).length + 1;
	while (store.styles.some((s) => s.name === `${KIND_NAMES[kind]} style ${i}`)) {
		i++;
	}
	return `${KIND_NAMES[kind]} style ${i}`;
}
