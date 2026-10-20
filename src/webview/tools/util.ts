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
export const movable = (c: ToolCtx, ids: Iterable<string>) =>
	[...ids].filter((id) => c.byId(id) && !c.byId(id).locked && !c.byId(id).hidden);
/** Where a node starts a drag: position and attachment. */
export function origins(c: ToolCtx, ids: string[]) {
	return new Map(
		ids.map((id) => {
			const n = c.byId(id);
			return [id, { x: n.x, y: n.y, attachment: n.attachment && { ...n.attachment } }];
		}),
	);
}
