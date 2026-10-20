// XY-cut / gap normalization / justification, ported from the measured tidy prototype: applies the plan,
// grows the surrounding frames, pushes neighbours away and re-anchors arrows.
import type { EdgeLike, GroupLike, Layout, NodeLike, OpLike } from '../model/node';
import { reanchor } from './route-reanchor';
import { bounds as frameBounds } from './route-bounds';
import { planTidy } from './sketch-plan';

export function tidy(
	nodes: NodeLike[],
	groups: GroupLike[],
	edges: EdgeLike[],
	selected: string[],
	layout: Layout,
): OpLike {
	const plan = planTidy(nodes, groups, edges, selected, layout);
	if (!plan) return { op: 'batch', ops: [] };
	const { top, o0 } = plan;

	const L = Math.min(...o0.map((r: any) => r.x0)),
		R = Math.max(...o0.map((r: any) => r.x1)),
		T = Math.min(...o0.map((r: any) => r.y0)),
		B = Math.max(...o0.map((r: any) => r.y1));
	// Anchor the left/top edges: any growth is pushed right/down into neighbouring space.
	const X0 = L,
		Y0 = T,
		ops: any[] = [],
		byId = new Map(nodes.map((n) => [n.id, n])),
		tidied = new Set(top.place.map((q: any) => q.id));
	const r2 = (v: any) => Math.round(v * 100) / 100;
	for (const q of top.place) {
		const n = byId.get(q.id)!,
			x = X0 + q.x + q.w / 2,
			y = -(Y0 + q.y + q.h / 2);
		if (Math.abs(x - n.x) > 0.005 || Math.abs(y - n.y) > 0.005) ops.push({ op: 'move', id: n.id, x: r2(x), y: r2(y) });
		const o: OpLike = { op: 'node', id: n.id };
		if (q.width !== undefined && Math.abs(q.width - n.width) > 0.005) o.width = r2(q.width);
		if (q.minh !== undefined && Math.abs(q.minh - (n.minh || 0)) > 0.005) o.minh = r2(q.minh);
		if (Object.keys(o).length > 2) ops.push(o);
	}
	// Grow the surrounding frames as well as the selection, and preserve clearance to
	// unselected siblings (including free labels/icons). A selected descendant counts
	// as growth of each containing frame. Side-by-side columns retain their own rows.
	const moved = nodes.map((n) => {
		const m = ops.find((o) => o.op === 'move' && o.id === n.id),
			z = ops.find((o) => o.op === 'node' && o.id === n.id);
		return { ...n, ...z, ...m };
	});
	const obstacles = [];
	const nodeRect = (n: any) => {
		const s = layout(n);
		return { x0: n.x - s.w / 2, x1: n.x + s.w / 2, y0: -n.y - s.h / 2, y1: -n.y + s.h / 2 };
	};
	obstacles.push({ old: { x0: L, x1: R, y0: T, y1: B }, now: { x0: L, x1: L + top.w, y0: T, y1: T + top.h } });
	const groupRect = (g: any, ns: any) => {
		const b = frameBounds(
			g.id,
			ns.map((n: any) => ({ ...n, ...layout(n) })),
			groups,
			new Set(),
			edges,
		);
		return b && { x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: -b.y - b.h / 2, y1: -b.y + b.h / 2 };
	};
	const contains = (g: any, id: any) => {
		let n = byId.get(id),
			p = n?.group;
		const seen = new Set();
		while (p && !seen.has(p)) {
			if (p === g.id) return true;
			seen.add(p);
			p = groups.find((g) => g.id === p)?.parent;
		}
		return false;
	};
	for (const g of groups)
		if ([...tidied].some((id) => contains(g, id))) {
			const old = groupRect(g, nodes),
				now = groupRect(g, moved);
			if (old && now) obstacles.push({ old, now, g });
		}
	for (const n of nodes) {
		if (tidied.has(n.id) || n.hidden || n.locked) continue;
		const b = nodeRect(n);
		let dx = 0,
			dy = 0;
		for (const ob of obstacles) {
			if (ob.g && contains(ob.g, n.id)) continue;
			const xOverlap = b.x0 < ob.now.x1 && b.x1 > ob.now.x0,
				yOverlap = b.y0 < ob.now.y1 && b.y1 > ob.now.y0;
			if (b.y0 >= ob.old.y1 - 0.1 && xOverlap) dy = Math.max(dy, ob.now.y1 - ob.old.y1);
			if (b.x0 >= ob.old.x1 - 0.1 && yOverlap) dx = Math.max(dx, ob.now.x1 - ob.old.x1);
		}
		if (dx > 0.005 || dy > 0.005) ops.push({ op: 'move', id: n.id, x: r2(n.x + dx), y: r2(n.y - dy) });
	}
	// Push complete unselected frames rigidly, then propagate pushes through chains
	// of neighbours. This keeps their original positive clearance, including labels.
	const shifts = new Map(
		ops
			.filter((o) => o.op === 'move' && !tidied.has(o.id))
			.map((o) => [o.id, [o.x - byId.get(o.id)!.x, byId.get(o.id)!.y - o.y]]),
	);
	for (let pass = 0; pass < nodes.length; pass++) {
		let changed = false;
		for (const g of groups) {
			const ns = nodes.filter((n) => contains(g, n.id));
			if (!ns.length || ns.some((n) => tidied.has(n.id) || n.locked || n.hidden)) continue;
			const dx = Math.max(0, ...ns.map((n) => shifts.get(n.id)?.[0] || 0)),
				dy = Math.max(0, ...ns.map((n) => shifts.get(n.id)?.[1] || 0));
			for (const n of ns)
				if (dx > (shifts.get(n.id)?.[0] || 0) + 0.005 || dy > (shifts.get(n.id)?.[1] || 0) + 0.005) {
					shifts.set(n.id, [dx, dy]);
					changed = true;
				}
		}
		for (const a of nodes) {
			const d = shifts.get(a.id);
			if (!d) continue;
			const A = nodeRect(a);
			for (const n of nodes) {
				if (n === a || tidied.has(n.id) || n.hidden || n.locked) continue;
				const b = nodeRect(n),
					v = shifts.get(n.id) || [0, 0];
				let [dx, dy] = v;
				if (d[0] > 0 && b.x0 >= A.x1 - 0.1 && b.y0 < A.y1 && b.y1 > A.y0) dx = Math.max(dx, d[0]);
				if (d[1] > 0 && b.y0 >= A.y1 - 0.1 && b.x0 < A.x1 && b.x1 > A.x0) dy = Math.max(dy, d[1]);
				if (dx > v[0] + 0.005 || dy > v[1] + 0.005) {
					shifts.set(n.id, [dx, dy]);
					changed = true;
				}
			}
		}
		if (!changed) break;
	}
	for (const [id, [dx, dy]] of shifts) {
		const n = byId.get(id)!,
			o = ops.find((o) => o.op === 'move' && o.id === id);
		const move = { op: 'move', id, x: r2(n.x + dx), y: r2(n.y - dy) };
		if (o) Object.assign(o, move);
		else ops.push(move);
	}
	const objects = (ns: any) => [
		...ns.map((n: any) => ({ ...n, ...layout(n) })),
		...groups
			.map((g) =>
				frameBounds(
					g.id,
					ns.map((n: any) => ({ ...n, ...layout(n) })),
					groups,
					new Set(),
					edges,
				),
			)
			.filter(Boolean),
	];
	const after = nodes.map((n) => ({
		...n,
		...ops.find((o) => o.op === 'node' && o.id === n.id),
		...ops.find((o) => o.op === 'move' && o.id === n.id),
	}));
	ops.push(...reanchor(edges, objects(nodes), objects(after)));
	return { op: 'batch', ops };
}
