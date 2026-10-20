// @ts-nocheck
import { store } from './store';
import { byId, groupById, inGroup, members, post } from './model';
import { KIND_NAMES, show } from './constants';

// Sort sibling subtrees by their frontmost node, then flatten each subtree as a block.
export function hierarchy(ns = store.nodes, gs = store.groups) {
	const rank = (item) =>
		item.kind === 'node'
			? ns.findIndex((n) => n.id === item.id)
			: Math.max(-1, ...ns.map((n, i) => (inGroup(n, item.id, gs) ? i : -1)));
	const walk = (parent, seen = new Set()) => {
		const children = [
			...ns.filter((n) => (n.group || '') === parent).map((n) => ({ kind: 'node', id: n.id })),
			...gs.filter((g) => (g.parent || '') === parent && !seen.has(g.id)).map((g) => ({ kind: 'group', id: g.id })),
		].sort((a, b) => rank(b) - rank(a));
		return children.map((item) => ({
			...item,
			children: item.kind === 'group' ? walk(item.id, new Set([...seen, item.id])) : [],
		}));
	};
	return walk('');
}
export function completeOrder(ns, gs) {
	const flatten = (items) => items.flatMap((item) => (item.kind === 'node' ? [item.id] : flatten(item.children)));
	const front = flatten(hierarchy(ns, gs));
	return [...ns.map((n) => n.id).filter((id) => !front.includes(id)), ...front.reverse()];
}
export function selectedRoots() {
	if (store.selG) {
		return [store.selG, ...[...store.selN].filter((id) => !inGroup(byId(id), store.selG))];
	}
	return [...store.selN];
}
export function selectLayer(id, toggle = false) {
	const group = groupById(id),
		ids = group ? members(id) : [id];
	if (!toggle) {
		store.selN = new Set();
	}
	const remove = toggle && (group ? store.selG === id : store.selN.has(id));
	for (const key of ids.filter((key) => byId(key) && !byId(key).hidden && !byId(key).locked)) {
		if (remove) {
			store.selN.delete(key);
		} else {
			store.selN.add(key);
		}
	}
	store.selG = group && !remove && ids.some((key) => byId(key) && !byId(key).hidden && !byId(key).locked) ? id : null;
	store.keyObject = toggle && !remove ? id : null;
	store.selE = new Set();
}
export function dropLayers(target, above, into = true) {
	if (!store.layerDrag) {
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
	let at;
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
export function moveToLayer(ids, layer) {
	if (!ids.length) {
		return;
	}
	post({ op: 'batch', ops: [{ op: 'setLayer', ids, layer }] });
	store.activeLayer = layer;
}
export function slug(name, except) {
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
	const used = store.nodes.map((n) => +(/^n(\d+)$/.exec(n.id) || [0, 0])[1]);
	return 'n' + (Math.max(0, ...used) + 1);
}
export function nextStyleName(kind) {
	let i = store.styles.filter((s) => s.kind === kind).length + 1;
	while (store.styles.some((s) => s.name === `${KIND_NAMES[kind]} style ${i}`)) {
		i++;
	}
	return `${KIND_NAMES[kind]} style ${i}`;
}
