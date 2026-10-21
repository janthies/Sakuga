import { store } from '../store/store';
import { selectedRoots } from '../store/layers';
import { selectedItems } from './interaction';
import { post } from '../store/model';

export function groupSelection() {
	const roots = selectedRoots().filter((id) => store.items.find((i) => i.id === id)?.kind !== 'Connector');
	if (!roots.length) return;
	const chain = (id: string) => {
		const out: string[] = [];
		let parent = store.items.find((i) => i.id === id)?.parent;
		while (parent && !out.includes(parent)) {
			out.push(parent);
			parent = store.items.find((i) => i.id === parent)?.parent;
		}
		return out;
	};
	const parent = chain(roots[0]).find((p) => roots.every((id) => chain(id).includes(p)));
	if (!parent) return;
	let n = 1;
	while (store.items.some((i) => i.id === `g${n}`)) n++;
	const id = `g${n}`;
	store.selG = id;
	post({
		op: 'batch',
		ops: [
			{ op: 'addGroup', id, name: `Group ${n}`, frame: 'none' },
			{ op: 'reparent', id, newParent: parent },
			...roots.map((child) => ({ op: 'reparent', id: child, newParent: id })),
		],
	});
}
export function ungroupSelection() {
	const selected = new Set(selectedItems().filter((id) => store.items.find((i) => i.id === id)?.kind !== 'Connector'));
	const roots = [...selected].filter((id) => {
		let p = store.items.find((i) => i.id === id)?.parent;
		const seen = new Set<string>();
		while (p && !seen.has(p)) {
			if (selected.has(p)) return false;
			seen.add(p);
			p = store.items.find((i) => i.id === p)?.parent;
		}
		return true;
	});
	if (roots.length) post({ op: 'batch', ops: roots.map((id) => ({ op: 'ungroup', id })) });
	store.selG = null;
}
