import type { Selection, ToolCtx } from './types';

export const fine = (v: number) => Math.round(v * 10) / 10;
export const half = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
export const copySel = (s: Selection): Selection => ({
	nodes: new Set(s.nodes),
	edges: new Set(s.edges),
	group: s.group,
	label: s.label,
	key: s.key,
});
/** The nodes of a selection that can be moved: neither locked nor hidden. */
export const movable = (c: ToolCtx, ids: Iterable<string>) => {
	const selected = new Set(ids);
	const inFrame = (id: string): boolean => {
		let item = c.items?.find((i) => i.id === id);
		const seen = new Set<string>();
		while (item && !seen.has(item.id)) {
			seen.add(item.id);
			const p = c.items?.find((i) => i.id === item!.parent);
			if (p?.kind === 'Frame' && selected.has(p.id)) return true;
			item = p;
		}
		return false;
	};
	return [
		...new Set([
			...selected,
			...c.nodes.filter((n) => inFrame(n.id)).map((n) => n.id),
			...(c.lines ?? []).filter((n) => inFrame(n.id)).map((n) => n.id),
		]),
	].filter((id) => {
		const n = c.byId(id) || c.lines?.find((l) => l.id === id);
		return n && !n.locked && !n.hidden;
	});
};
/** Where a node starts a drag: position and attachment. */
export function origins(c: ToolCtx, ids: string[]) {
	return new Map<string, any>(
		ids.map((id) => {
			const n = c.byId(id);
			if (!n) {
				const l = c.lines!.find((l) => l.id === id)!;
				return [id, { x: l.start[0], y: l.start[1], line: { start: [...l.start], end: [...l.end] } }];
			}
			return [id, { x: n.x, y: n.y, attachment: n.attachment && { ...n.attachment } }];
		}),
	);
}
