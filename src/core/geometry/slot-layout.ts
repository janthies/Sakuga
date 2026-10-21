import { groupFootprint, localOrigin } from './slot-groups';
import { positionInSlot } from './slot-position';
import type { Figure, FigNode } from '../model/figure';
import { nodes, fontSize } from '../model/queries';
import { childrenOf, itemById } from '../model/tree-queries';
import { payload } from '../model/tree';
import { BOX_SLOTS, slotCell } from '../model/slots';
import { layout, need } from '../text';

export const INNER_PADDING = 1.2;
export const OUTER_GAP = 1;
export interface SlotRect {
	origin?: [number, number];
	x: number;
	y: number;
	w: number;
	h: number;
	lines?: string[];
	textWidth?: number;
}
const rectangles = new WeakMap<object, SlotRect>();
const owners = new WeakMap<FigNode, Figure>(),
	revisions = new WeakMap<Figure, string>();
const signature = (fig: Figure) =>
	JSON.stringify([
		fig.theme,
		(fig.items || []).map((i) => (i.kind === 'Frame' ? i.frame.pin : i.kind === 'Line' ? i.line : undefined)),
		(fig.items || []).map((i) => [i.id, i.parent, i.slot, i.order]),
		nodes(fig).map((n) => [n.id, n.width, n.minh, n.title, n.code, n.codeFont, n.style, n.x, n.y]),
	]);
export const slotFrame = (g: import('../model/figure').Group) => rectangles.get(g);
export function slotRect(n: FigNode) {
	const fig = owners.get(n);
	if (fig && revisions.get(fig) !== signature(fig)) layoutSlots(fig);
	return rectangles.get(n);
}
/** Cache derived geometry outside the payload. Slot children never persist x/y. */
export function layoutSlots(fig: Figure) {
	const ns = nodes(fig),
		sized = new Map<string, SlotRect>(),
		visiting = new Set<string>();
	const pad = fig.theme?.kinds?.Shape?.innerPadding ?? INNER_PADDING;
	const gap = fig.theme?.kinds?.Shape?.outerGap ?? OUTER_GAP;
	const size = (id: string): SlotRect => {
		if (sized.has(id)) return sized.get(id)!;
		const i = itemById(fig, id),
			n = i && 'node' in i ? i.node : undefined;
		if (i?.kind === 'Line') {
			const l = i.line,
				v = l.vector || [l.end[0] - l.start[0], l.end[1] - l.start[1]],
				b = { x: (l.start[0] + l.end[0]) / 2, y: (l.start[1] + l.end[1]) / 2, w: Math.abs(v[0]), h: Math.abs(v[1]) };
			sized.set(id, b);
			return b;
		}
		if (i?.kind === 'Frame' && !visiting.has(id)) {
			visiting.add(id);
			const b = groupFootprint(fig, i, size);
			sized.set(id, b);
			visiting.delete(id);
			return b;
		}
		if (!i || !n || visiting.has(id)) return { x: 0, y: 0, w: 0, h: 0 };
		visiting.add(id);
		const parent = itemById(fig, i.parent),
			cell = slotCell(i.slot || '');
		let textWidth = n.width;
		if (i.kind === 'Text' && parent?.kind === 'Shape' && cell.every((c) => c >= 1 && c <= 3)) {
			const cols = new Set(
				childrenOf(fig, parent.id)
					.filter((c) => slotCell(c.slot || '')[1] === cell[1])
					.map((c) => slotCell(c.slot || '')[0])
					.filter((c) => c >= 1 && c <= 3),
			);
			textWidth = Math.max(
				1,
				need(n, fontSize(fig)).width,
				(parent.node.width - 2 * pad - (cols.size - 1) * gap) / Math.max(1, cols.size),
			);
		}
		const s = layout({ ...n, x: 0, y: 0, width: textWidth, derivedRect: undefined }, fontSize(fig));
		let w = s.w,
			h = s.h;
		if (i.kind === 'Shape') {
			const rows = [0, 0, 0],
				widths = [0, 0, 0],
				columns = [0, 0, 0];
			for (const slot of BOX_SLOTS) {
				const [c, r] = slotCell(slot);
				if (c < 1 || c > 3 || r < 1 || r > 3) continue;
				const kids = childrenOf(fig, id).filter((k) => k.slot === slot);
				const boxes = kids.map((k) => size(k.id));
				rows[r - 1] = Math.max(rows[r - 1], boxes.reduce((v, b) => v + b.h, 0) + Math.max(0, boxes.length - 1) * gap);
				widths[r - 1] += Math.max(0, ...boxes.map((b) => b.w));
				if (boxes.length) columns[r - 1]++;
			}
			w = Math.max(w, ...widths.map((v, r) => v + 2 * pad + Math.max(0, columns[r] - 1) * gap));
			h = Math.max(h, rows.reduce((a, b) => a + b, 0) + 2 * pad + 2 * gap);
		}
		const b = { x: 0, y: 0, w, h, lines: s.lines, textWidth };
		sized.set(id, b);
		visiting.delete(id);
		return b;
	};
	for (const i of fig.items || []) size(i.id);
	const done = new Set<string>();
	const place = (id: string): SlotRect => {
		const b = sized.get(id) || { x: 0, y: 0, w: 0, h: 0 };
		if (done.has(id)) return b;
		const i = itemById(fig, id),
			n = i && 'node' in i ? i.node : undefined;
		if (i?.kind === 'Frame') {
			done.add(id);
			const parent = itemById(fig, i.parent);
			if (parent?.kind === 'Shape' && i.slot) {
				const p = place(parent.id),
					siblings = childrenOf(fig, parent.id).filter((k) => k.slot === i.slot);
				const prior = siblings
					.slice(
						0,
						siblings.findIndex((k) => k.id === id),
					)
					.map((k) => size(k.id));
				Object.assign(b, positionInSlot(b, p, i.slot, prior, [], pad, gap));
			}
			if (parent?.kind === 'Shape' && i.slot) rectangles.set(i.frame, b);
			else rectangles.delete(i.frame);
			return b;
		}
		if (i?.kind === 'Line') {
			const l = i.line,
				parent = itemById(fig, i.parent);
			done.add(id);
			if (parent?.kind === 'Shape' && i.slot) {
				const p = place(parent.id),
					siblings = childrenOf(fig, parent.id).filter((k) => k.slot === i.slot),
					index = siblings.findIndex((k) => k.id === id);
				const rects = siblings.map((k) => sized.get(k.id)).filter((v): v is SlotRect => !!v);
				Object.assign(b, positionInSlot(b, p, i.slot, rects.slice(0, index), rects, pad, gap));
				const v = l.vector || [l.end[0] - l.start[0], l.end[1] - l.start[1]];
				l.vector = [v[0], v[1]];
				Object.defineProperties(l, {
					start: { configurable: true, enumerable: true, get: () => [b.x - v[0] / 2, b.y - v[1] / 2], set: () => {} },
					end: { configurable: true, enumerable: true, get: () => [b.x + v[0] / 2, b.y + v[1] / 2], set: () => {} },
				});
			} else if (localOrigin(fig, i, place) && l.local) {
				const origin = localOrigin(fig, i, place)!;
				const v = l.vector || [l.end[0] - l.start[0], l.end[1] - l.start[1]];
				l.vector = [v[0], v[1]];
				for (const [key, sign] of [
					['start', -1],
					['end', 1],
				] as const)
					Object.defineProperty(l, key, {
						configurable: true,
						enumerable: true,
						get: () => [
							origin.x + l.local!.x + (sign * l.vector![0]) / 2,
							origin.y + l.local!.y + (sign * l.vector![1]) / 2,
						],
						set: (point: number[]) => {
							const other = key === 'start' ? l.end : l.start;
							l.local!.x = (point[0] + other[0]) / 2 - origin.x;
							l.local!.y = (point[1] + other[1]) / 2 - origin.y;
							l.vector = [(point[0] - other[0]) * sign, (point[1] - other[1]) * sign];
						},
					});
				b.x = origin.x + l.local.x;
				b.y = origin.y + l.local.y;
			} else {
				const start = [...l.start],
					end = [...l.end];
				Object.defineProperties(l, {
					start: { value: start, writable: true, enumerable: true, configurable: true },
					end: { value: end, writable: true, enumerable: true, configurable: true },
				});
				delete l.vector;
			}
			rectangles.set(l, b);
			return b;
		}
		if (!i || !n) return b;
		done.add(id);
		const parent = itemById(fig, i.parent);
		if (parent?.kind === 'Shape' && i.slot) {
			const p = place(parent.id),
				[c, r] = slotCell(i.slot),
				siblings = childrenOf(fig, parent.id).filter((k) => k.slot === i.slot),
				index = siblings.findIndex((k) => k.id === id);
			const prior = siblings
				.slice(0, index)
				.map((k) => sized.get(k.id))
				.filter((v): v is SlotRect => !!v);
			const rects = siblings.map((k) => sized.get(k.id)).filter((v): v is SlotRect => !!v);
			Object.assign(b, positionInSlot(b, p, i.slot, prior, rects, pad, gap));
			rectangles.set(n, b);
			for (const k of ['x', 'y'] as const)
				Object.defineProperty(n, k, {
					configurable: true,
					enumerable: true,
					get: () => rectangles.get(n)![k],
					set: () => {},
				});
		} else {
			// Detachment materialises the last computed position before removing the cache.
			const origin = localOrigin(fig, i, place);
			if (origin && n.local) {
				for (const k of ['x', 'y'] as const)
					Object.defineProperty(n, k, {
						configurable: true,
						enumerable: true,
						get: () => origin[k] + n.local![k],
						set: (v: number) => {
							n.local![k] = v - origin[k];
						},
					});
				b.x = n.x;
				b.y = n.y;
				if (i.kind === 'Shape') rectangles.set(n, b);
				Object.defineProperty(n, 'derivedRect', {
					configurable: true,
					enumerable: false,
					get: () => rectangles.get(n),
				});
				return b;
			}
			const old = Object.getOwnPropertyDescriptor(n, 'x')?.get ? rectangles.get(n) : undefined;
			const x = old?.x ?? n.x ?? 0,
				y = old?.y ?? n.y ?? 0;
			Object.defineProperties(n, {
				x: { value: x, writable: true, enumerable: true, configurable: true },
				y: { value: y, writable: true, enumerable: true, configurable: true },
			});
			rectangles.delete(n);
			b.x = x;
			b.y = y;
		}
		if (i.kind === 'Shape') rectangles.set(n, b);
		Object.defineProperty(n, 'derivedRect', { configurable: true, enumerable: false, get: () => rectangles.get(n) });
		return b;
	};
	for (const i of fig.items || []) place(i.id);
	for (const n of ns) owners.set(n, fig);
	revisions.set(fig, signature(fig));
}
