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
		horizontal = (c === 0 || c === 4) && r > 0 && r < 4,
		stack = horizontal ? 0 : prior.reduce((n, b) => n + b.h + gap, 0),
		stackX = horizontal ? prior.reduce((n, b) => n + b.w + gap, 0) : 0;
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
						: -stack;
	// Keep the slot origin explicit: resizing changes the rectangle around this point.
	const origin: [number, number] = [
		p.x +
			(c === 0
				? -p.w / 2 - gap - stackX
				: c === 4
					? p.w / 2 + gap + stackX
					: c === 1
						? -p.w / 2 + padding
						: c === 3
							? p.w / 2 - padding
							: 0),
		p.y +
			(r === 0
				? p.h / 2 + gap + stack
				: r === 4
					? -p.h / 2 - gap - stack
					: r === 1
						? p.h / 2 - padding - stack
						: r === 3
							? -p.h / 2 + padding + stack
							: -stack),
	];
	return { x: p.x + x, y: p.y + y, origin };
}
