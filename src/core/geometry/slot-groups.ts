import type { Figure } from '../model/figure';
import type { Item } from '../model/item';
import { ancestors, descendants, itemById } from '../model/tree-queries';
import { payload } from '../model/tree';
import { slotCell } from '../model/slots';
import type { PlacementRect as SlotRect } from './slot-position';

function flush(b: SlotRect, slot: string) {
	const [c, r] = slotCell(slot);
	return {
		...b,
		x: b.x + (c === 0 || c === 3 ? b.w / 2 : c === 1 || c === 4 ? -b.w / 2 : 0),
		y: b.y + (r === 0 || r === 3 ? -b.h / 2 : r === 1 || r === 4 ? b.h / 2 : 0),
	};
}

/** A pinned group's entry rectangle stays fixed until the next explicit placement. */
export function groupFootprint(fig: Figure, i: Item, size: (id: string) => SlotRect): SlotRect {
	if (i.kind !== 'Frame') return { x: 0, y: 0, w: 0, h: 0 };
	if (i.frame.pin) return { x: 0, y: 0, w: i.frame.pin[0], h: i.frame.pin[1] };
	const members = descendants(fig, i.id).flatMap((c) => {
		const n = 'node' in c && c.node;
		if (n) return [{ ...size(c.id), x: n.x, y: n.y }];
		if (c.kind === 'Line') return [size(c.id)];
		return [];
	});
	const lo = (axis: 'x' | 'y', dim: 'w' | 'h') => Math.min(...members.map((b) => b[axis] - b[dim] / 2));
	const hi = (axis: 'x' | 'y', dim: 'w' | 'h') => Math.max(...members.map((b) => b[axis] + b[dim] / 2));
	const b = members.length
		? {
				x: (lo('x', 'w') + hi('x', 'w')) / 2,
				y: (lo('y', 'h') + hi('y', 'h')) / 2,
				w: hi('x', 'w') - lo('x', 'w'),
				h: hi('y', 'h') - lo('y', 'h'),
			}
		: { x: 0, y: 0, w: 0, h: 0 };
	if (itemById(fig, i.parent)?.kind === 'Shape' && i.slot) {
		i.frame.pin = [b.w, b.h];
		const origin = flush(b, i.slot);
		for (const c of descendants(fig, i.id)) {
			if (ancestors(fig, c.id).find((p) => p.kind === 'Frame' && p.slot)?.id !== i.id) continue;
			const p = payload(c),
				n = 'node' in c && c.node;
			if (n && !c.slot) p.local = { parent: i.id, x: n.x - origin.x, y: n.y - origin.y };
			if (c.kind === 'Line' && !c.slot)
				p.local = {
					parent: i.id,
					x: (c.line.start[0] + c.line.end[0]) / 2 - origin.x,
					y: (c.line.start[1] + c.line.end[1]) / 2 - origin.y,
				};
		}
	}
	return b;
}

export function localOrigin(fig: Figure, i: Item, place: (id: string) => SlotRect) {
	const p = payload(i),
		local = p.local;
	const owner = ancestors(fig, i.id).find((a) => a.kind === 'Frame' && a.slot);
	if (!owner || (local && local.parent !== owner.id)) {
		delete p.local;
		return undefined;
	}
	const b = flush(place(owner.id), owner.slot!);
	if (!p.local) {
		const n = 'node' in i && i.node;
		const x = n ? n.x : i.kind === 'Line' ? (i.line.start[0] + i.line.end[0]) / 2 : b.x;
		const y = n ? n.y : i.kind === 'Line' ? (i.line.start[1] + i.line.end[1]) / 2 : b.y;
		p.local = { parent: owner.id, x: x - b.x, y: y - b.y };
	}
	return b;
}

/** Materialise before a reparent or an explicit slot choice takes a fresh fit. */
export function releaseGroup(fig: Figure, id: string) {
	const i = itemById(fig, id);
	if (!i) return;
	if (i.kind === 'Frame') delete i.frame.pin;
	const subtree = new Set([id, ...descendants(fig, id).map((c) => c.id)]);
	for (const c of [i, ...descendants(fig, id)]) {
		const local = payload(c).local;
		if (local && subtree.has(local.parent) && local.parent !== (i.kind === 'Frame' ? id : '')) continue;
		const p = payload(c),
			n = 'node' in c && c.node;
		if (n && p.local) {
			const x = n.x,
				y = n.y;
			Object.defineProperties(n, {
				x: { value: x, writable: true, configurable: true, enumerable: true },
				y: { value: y, writable: true, configurable: true, enumerable: true },
			});
		}
		if (c.kind === 'Line' && p.local) {
			const start = [...c.line.start],
				end = [...c.line.end];
			Object.defineProperties(c.line, {
				start: { value: start, writable: true, configurable: true, enumerable: true },
				end: { value: end, writable: true, configurable: true, enumerable: true },
			});
			delete c.line.vector;
		}
		delete p.local;
	}
}
