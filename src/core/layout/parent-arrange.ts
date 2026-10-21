import type { Figure } from '../model/figure';
import type { Op } from '../ops/types';
import { itemById, subtreeState } from '../model/tree-queries';
import { geometryOf } from '../geometry/figure-geometry';
import { BOX_SLOTS, slotCell } from '../model/slots';

export function commonParent(fig: Figure, ids: string[]) {
	const parent = ids.length ? itemById(fig, itemById(fig, ids[0])?.parent || '') : undefined;
	return parent &&
		['Shape', 'Frame'].includes(parent.kind) &&
		ids.every((id) => itemById(fig, id)?.parent === parent.id)
		? parent
		: undefined;
}
/** Slot children remain derived; group children receive absolute moves within the group's bounds. */
export function arrangeInParent(fig: Figure, ids: string[], command: string): Op | undefined {
	const parent = commonParent(fig, ids);
	if (!parent || command.startsWith('same')) return undefined;
	const geo = geometryOf(fig),
		b = parent.kind === 'Shape' ? geo.node(parent.id) : geo.frame(parent.id);
	if (!b) return { op: 'batch', ops: [] };
	const selected = ids
		.map((id) => itemById(fig, id)!)
		.filter((i) => !subtreeState(fig, i.id, 'locked') && !subtreeState(fig, i.id, 'hidden'));
	const dist = command.startsWith('distribute'),
		horizontal = command === 'distributeX' || ['left', 'centerX', 'right'].includes(command);
	const rect = (id: string) => (itemById(fig, id)?.kind === 'Frame' ? geo.frame(id) : geo.node(id));
	const us = selected
		.map((i) => ({ i, b: rect(i.id) }))
		.filter((u): u is typeof u & { b: NonNullable<typeof u.b> } => !!u.b);
	if (dist && us.length < 2) return { op: 'batch', ops: [] };
	us.sort((a, c) => (horizontal ? a.b.x - c.b.x : a.b.y - c.b.y));
	const ops: Op[] = [];
	let position = horizontal ? b.x - b.w / 2 : b.y - b.h / 2;
	const extent = us.reduce((sum, u) => sum + (horizontal ? u.b.w : u.b.h), 0);
	const gap = ((horizontal ? b.w : b.h) - extent) / Math.max(1, us.length - 1);
	for (const [index, u] of us.entries()) {
		if (parent.kind === 'Shape') {
			let [col, row] = slotCell(u.i.slot || 'centre');
			if (horizontal)
				col = dist
					? 1 + Math.round((index * 2) / (us.length - 1))
					: ({ left: 1, centerX: 2, right: 3 } as Record<string, number>)[command] || 2;
			else
				row = dist
					? 3 - Math.round((index * 2) / (us.length - 1))
					: ({ top: 1, centerY: 2, bottom: 3 } as Record<string, number>)[command] || 2;
			ops.push({ op: 'slot', id: u.i.id, slot: BOX_SLOTS[row * 5 + col] });
		} else {
			const size = horizontal ? u.b.w : u.b.h;
			const fraction = ['left', 'bottom'].includes(command) ? 0 : ['right', 'top'].includes(command) ? 1 : 0.5;
			const target = dist
				? position + size / 2
				: (horizontal ? b.x - b.w / 2 : b.y - b.h / 2) + ((horizontal ? b.w : b.h) - size) * fraction + size / 2;
			// Line moves use their start point; other items use the rectangle centre.
			const origin = u.i.kind === 'Line' ? { x: u.i.line.start[0], y: u.i.line.start[1] } : u.b;
			ops.push({
				op: 'move',
				id: u.i.id,
				x: origin.x + (horizontal ? target - u.b.x : 0),
				y: origin.y + (horizontal ? 0 : target - u.b.y),
			});
			position += size + gap;
		}
	}
	return { op: 'batch', ops };
}
