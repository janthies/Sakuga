import { store } from '../store/store';
import { completeOrder, selectedRoots } from '../store/layers';
import { byId, groupById, post } from '../store/model';

export function groupSelection() {
	const roots = selectedRoots();
	if (!roots.length || new Set([...store.selN].map((id) => byId(id)?.layer)).size > 1) {
		return;
	}
	const parents = roots.map((id) => groupById(id)?.parent ?? byId(id)?.group ?? '');
	const ancestors = (parent: string | undefined) => {
		const result = [''];
		while (parent && !result.includes(parent)) {
			result.unshift(parent);
			parent = groupById(parent)?.parent;
		}
		return result;
	};
	const parent = ancestors(parents[0]).find((p) => parents.every((q) => ancestors(q).includes(p))) || '';
	let i = 1;
	while (groupById(`g${i}`) || byId(`g${i}`)) {
		i++;
	}
	const group = {
		id: `g${i}`,
		name: `group ${i}`,
		frame: roots.some((id) => groupById(id)?.frame && groupById(id)!.frame !== 'none') ? 'solid' : 'dashed',
		color: 'grey',
		parent,
		fill: roots.some((id) => groupById(id)?.frame && groupById(id)!.frame !== 'none') ? 'none' : 'tint',
		outline: roots.some((id) => groupById(id)?.frame && groupById(id)!.frame !== 'none') ? 'solid' : 'dashed',
	};
	const ns = store.nodes.map((n) => ({ ...n, group: roots.includes(n.id) ? group.id : n.group }));
	const gs = [...store.groups.map((g) => ({ ...g, parent: roots.includes(g.id) ? group.id : g.parent })), group];
	store.selG = group.id;
	post({
		op: 'batch',
		ops: [
			{ op: 'addGroup', ...group },
			{ op: 'setGroup', ids: roots, group: group.id },
			{ op: 'reorder', order: completeOrder(ns, gs) },
		],
	});
}
export function ungroupSelection() {
	if (!store.selG) {
		return;
	}
	post({ op: 'ungroup', id: store.selG });
	store.selG = null;
}
