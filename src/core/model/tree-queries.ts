import type { Figure } from './figure';
import type { Item } from './item';

export const items = (fig: Figure): Item[] => fig.items || [];
export const itemById = (fig: Figure, id: string) => items(fig).find((i) => i.id === id);
export const childrenOf = (fig: Figure, id: string) =>
	items(fig)
		.filter((i) => i.parent === id)
		.sort((a, b) => a.order - b.order);
export function ancestors(fig: Figure, id: string): Item[] {
	const out: Item[] = [],
		seen = new Set([id]);
	let p = itemById(fig, id)?.parent;
	while (p && !seen.has(p)) {
		seen.add(p);
		const item = itemById(fig, p);
		if (!item) break;
		out.push(item);
		p = item.parent;
	}
	return out;
}
export const descendants = (fig: Figure, id: string) =>
	items(fig).filter((i) => ancestors(fig, i.id).some((p) => p.id === id));
export const layerOf = (fig: Figure, id: string): string => {
	const i = itemById(fig, id);
	return i ? (ancestors(fig, id).at(-1) || i).parent : id;
};
export const itemsOfLayer = (fig: Figure, layer: string) => items(fig).filter((i) => layerOf(fig, i.id) === layer);
export const titleOf = (fig: Figure, id: string) => childrenOf(fig, id).find((i) => i.kind === 'Text');
export function subtreeState(fig: Figure, id: string, key: 'hidden' | 'locked'): boolean {
	const i = itemById(fig, id);
	const layer = fig.lines.find((l) => l.t === 'layer' && l.layer.id === layerOf(fig, id));
	return !!(i?.[key] || ancestors(fig, id).some((p) => p[key]) || (layer?.t === 'layer' && layer.layer[key]));
}

// Keep source slots belonging to different containers in place while respecting
// sibling order inside each container. This also keeps legacy edge indices stable.
export function orderedSiblings<T extends { treeParent?: string; order?: number }>(list: T[]): T[] {
	const buckets = new Map<string, T[]>();
	for (const i of list) {
		const key = i.treeParent || '';
		const bucket = buckets.get(key) || [];
		bucket.push(i);
		buckets.set(key, bucket);
	}
	for (const bucket of buckets.values()) bucket.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	return list.map((i) => buckets.get(i.treeParent || '')!.shift()!);
}
