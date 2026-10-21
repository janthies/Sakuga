import { store } from '../store/store';
import { post } from '../store/model';
import type { LayerCtx } from './layers-context';

export function rowMarker(row: HTMLElement, kind: string, cat?: string) {
	const marker = document.createElement('span');
	marker.className = 'layer-marker';
	marker.textContent =
		({ Layer: '▤', Frame: '▱', Shape: '□', Text: 'T', Icon: '◇', Line: '╱', Connector: '→' } as Record<string, string>)[
			kind
		] || '□';
	marker.title = kind;
	const category = store.cats.find((c) => c.key === cat);
	if (category?.color)
		marker.style.color = store.palette[category.color] ? '#' + store.palette[category.color].hex : category.color;
	row.append(marker);
}
export function rowTail(
	ctx: LayerCtx,
	row: HTMLElement,
	item: { id: string; hidden?: boolean; locked?: boolean },
	count?: number,
) {
	const n = document.createElement('span');
	n.className = 'layer-count';
	n.textContent = count === undefined ? '' : String(count);
	row.append(n);
	for (const [prop, on, off] of [
		['hidden', 'eyeClosed', 'eye'],
		['locked', 'lock', 'unlock'],
	] as const) {
		const button = ctx.button(
			row,
			item[prop] ? on : off,
			`${prop === 'hidden' ? (item[prop] ? 'Show' : 'Hide') : item[prop] ? 'Unlock' : 'Lock'} ${item.id}`,
			() => {
				post(
					store.layers.some((l) => l.id === item.id)
						? { op: 'layerProps', id: item.id, [prop]: !item[prop] }
						: { op: prop === 'hidden' ? 'hide' : 'lock', ids: [item.id], [prop]: !item[prop] },
				);
			},
		);
		button.setAttribute('aria-pressed', String(!!item[prop]));
	}
}
