// The frame rectangle of a group around its boxes, child frames and U-routes.
import type { EdgeLike, GroupLike, Obj } from '../model/node';
import { geometry } from './route-geometry';

export const padding = (g: GroupLike): number =>
	g.padding || (g.frame === 'dashed' ? 2.8 : g.frame === 'dotted' ? 1.8 : 3);
const TITLE_PT: Record<string, number> = { scriptsize: 8, footnotesize: 9, small: 10, normalsize: 10.95, large: 12 };

export function bounds(
	id: string,
	nodes: Obj[],
	groups: GroupLike[],
	seen: Set<string> = new Set(),
	edges: EdgeLike[] = [],
): Obj | null {
	if (seen.has(id)) return null;
	seen = new Set(seen);
	seen.add(id);
	const g = groups.find((g) => g.id === id);
	if (!g) return null;
	const items = [
		...nodes.filter((n) => n.group === id && !n.hidden),
		...groups
			.filter((c) => c.parent === id)
			.map((c) => bounds(c.id, nodes, groups, seen, edges))
			.filter((b): b is Obj => !!b)
			.map((b) => {
				const child = groups.find((g) => g.id === b.id)!,
					pos = child.titlePosition || 'legacy';
				if (child.frame !== 'none' && child.name && (pos.startsWith('above') || pos === 'below-left')) {
					const extra = ((TITLE_PT[child.titleFont || 'scriptsize']! + 3) * 25.4) / 72.27;
					return { ...b, h: b.h + extra, y: b.y + (pos === 'below-left' ? -extra / 2 : extra / 2) };
				}
				return b;
			}),
	];
	for (const e of edges.filter((e) => e.route === 'u')) {
		const a = nodes.find((n) => n.id === e.from && n.group === id && !n.hidden),
			b = nodes.find((n) => n.id === e.to && n.group === id && !n.hidden);
		if (a && b) {
			const route = geometry(e, a, b, edges, 'manhattan');
			items.push(...route.pts.map((p: any) => ({ x: p[0], y: p[1], w: 0, h: 0 })));
		}
	}
	if (!items.length) return null;
	const m = g.frame === 'none' ? 0 : padding(g);
	const x0 = Math.min(...items.map((n) => n.x - n.w / 2)) - m,
		x1 = Math.max(...items.map((n) => n.x + n.w / 2)) + m;
	const y0 = Math.min(...items.map((n) => n.y - n.h / 2)) - m,
		y1 =
			Math.max(...items.map((n) => n.y + n.h / 2)) +
			m +
			(g.frame !== 'none' && g.titlePosition?.startsWith('inside') ? 5 : 0);
	return { id, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, group: g.parent, frame: true };
}
