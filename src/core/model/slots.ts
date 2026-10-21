/** Rows run top to bottom; the outer ring surrounds the nine inside slots. */
export const BOX_SLOTS = [
	'outside-top-left',
	'above-left',
	'above',
	'above-right',
	'outside-top-right',
	'outside-left-top',
	'top-left',
	'top',
	'top-right',
	'outside-right-top',
	'outside-left',
	'left',
	'centre',
	'right',
	'outside-right',
	'outside-left-bottom',
	'bottom-left',
	'bottom',
	'bottom-right',
	'outside-right-bottom',
	'outside-bottom-left',
	'below-left',
	'below',
	'below-right',
	'outside-bottom-right',
] as const;
export type BoxSlot = (typeof BOX_SLOTS)[number];
export const LINE_SLOTS = [
	'start-above',
	'middle-above',
	'end-above',
	'start-below',
	'middle-below',
	'end-below',
] as const;
export type LineSlot = (typeof LINE_SLOTS)[number];
export type Slot = BoxSlot | LineSlot;
export function slotCell(slot: string): [number, number] {
	const i = BOX_SLOTS.indexOf(slot as BoxSlot);
	return i < 0 ? [2, 2] : [i % 5, Math.floor(i / 5)];
}
export function defaultSlot(occupied: string[]): BoxSlot {
	return (['centre', 'below', 'above', 'right', 'left'] as const).find((s) => !occupied.includes(s)) || 'centre';
}
export function slotAt(b: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }): BoxSlot {
	const axis = (v: number, c: number, size: number) =>
		v < c - size / 2
			? 0
			: v > c + size / 2
				? 4
				: Math.min(3, 1 + Math.floor(((v - c + size / 2) / Math.max(size, 0.001)) * 3));
	return BOX_SLOTS[(4 - axis(p.y, b.y, b.h)) * 5 + axis(p.x, b.x, b.w)];
}
export function legacySlot(anchor = 'center', own = 'center', dx = 0, dy = 0): BoxSlot {
	const x = anchor.includes('west') ? 1 : anchor.includes('east') ? 3 : 2;
	const y = anchor.includes('north') ? 1 : anchor.includes('south') ? 3 : 2;
	const col = dx < -1 && x === 1 ? 0 : dx > 1 && x === 3 ? 4 : x;
	const row = dy > 1 && y === 1 ? 0 : dy < -1 && y === 3 ? 4 : y;
	if (anchor === 'north' && own.includes('south')) return 'above';
	if (anchor === 'south' && own.includes('north')) return 'below';
	if (anchor === 'east' && own.includes('west')) return 'outside-right';
	if (anchor === 'west' && own.includes('east')) return 'outside-left';
	return BOX_SLOTS[row * 5 + col];
}
