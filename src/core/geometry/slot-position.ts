import { slotCell } from '../model/slots';
export interface PlacementRect {
	x: number;
	y: number;
	w: number;
	h: number;
}
/** Meet the two sector anchors, then stack in tree order away from the parent. */
export function positionInSlot(
	b: PlacementRect,
	p: PlacementRect,
	slot: string,
	prior: PlacementRect[],
	siblings: PlacementRect[],
	padding: number,
	gap: number,
) {
	const [c, r] = slotCell(slot),
		stack = prior.reduce((n, b) => n + b.h + gap, 0),
		stackX = prior.reduce((n, b) => n + b.w + gap, 0),
		total = siblings.reduce((n, b) => n + b.h + gap, 0) - gap;
	const x =
		c === 0
			? -p.w / 2 - gap - b.w / 2 - stackX
			: c === 4
				? p.w / 2 + gap + b.w / 2 + stackX
				: c === 1
					? -p.w / 2 + padding + b.w / 2
					: c === 3
						? p.w / 2 - padding - b.w / 2
						: 0;
	const y =
		r === 0
			? p.h / 2 + gap + b.h / 2 + stack
			: r === 4
				? -p.h / 2 - gap - b.h / 2 - stack
				: r === 1
					? p.h / 2 - padding - b.h / 2 - stack
					: r === 3
						? -p.h / 2 + padding + b.h / 2 + stack
						: total / 2 - b.h / 2 - stack;
	return { x: p.x + x, y: p.y + y };
}
