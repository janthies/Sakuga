import { store } from '../store/store';
import { post } from '../store/model';
import type { Op } from '../tools/types';

export function treeDrop(ids: string[], layer: string, target: string | null, fraction: number) {
	const t = store.items.find((i) => i.id === target);
	const into = t && ['Shape', 'Frame'].includes(t.kind) && fraction > 0.25 && fraction < 0.75;
	const parent = into ? t.id : t?.parent || layer;
	// Reject the complete drop if it would create a cycle.
	let ancestor: string | undefined = target || parent;
	const seen = new Set<string>();
	while (ancestor && !seen.has(ancestor)) {
		if (ids.includes(ancestor)) return;
		seen.add(ancestor);
		ancestor = store.items.find((i) => i.id === ancestor)?.parent;
	}
	const siblings = store.items
		.filter((i) => i.parent === parent && !ids.includes(i.id))
		.sort((a, b) => a.order - b.order);
	let index = into || !t ? siblings.length : siblings.findIndex((i) => i.id === target) + (fraction < 0.5 ? 1 : 0);
	const ops: Op[] = ids
		.filter((id) => store.items.find((i) => i.id === id)?.kind !== 'Connector')
		.map((id) => ({ op: 'reparent', id, newParent: parent, index: index++ }));
	store.collapsed.delete(parent);
	store.expandedLayers.add(layer);
	post({ op: 'batch', ops });
}
