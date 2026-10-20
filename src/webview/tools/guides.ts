import { half } from './util';
import type { ToolCtx } from './types';

// Does the arrow lie inside the rectangle (band select)?
export function edgeInside(c: ToolCtx, selected: Set<string>, e: any, x0: number, x1: number, y0: number, y1: number) {
	const a = c.endpointObject(e.from),
		b = c.endpointObject(e.to);
	if (!a || !b || a.hidden || b.hidden || a.locked || b.locked) {
		return false;
	}
	if (selected.has(e.from) && selected.has(e.to)) {
		return true;
	}
	const G = c.edgeGeom(e);
	if (!G) {
		return false;
	}
	const inside = ([x, y]: number[]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
	const segment = (p: number[], q: number[]) => {
		let lo = 0,
			hi = 1;
		for (const [k, min, max] of [
			[0, x0, x1],
			[1, y0, y1],
		]) {
			const d = q[k] - p[k];
			if (!d) {
				if (p[k] < min || p[k] > max) {
					return false;
				}
			} else {
				const t0 = (min - p[k]) / d,
					t1 = (max - p[k]) / d;
				lo = Math.max(lo, Math.min(t0, t1));
				hi = Math.min(hi, Math.max(t0, t1));
				if (lo > hi) {
					return false;
				}
			}
		}
		return true;
	};
	// Subdivide the actual cubic, rejecting disjoint control hulls. This also
	// catches tangencies and tight bends that fixed-distance sampling can miss.
	const curve = (pts: number[][], depth = 0): boolean => {
		const xs = pts.map((p) => p[0]),
			ys = pts.map((p) => p[1]);
		if (Math.max(...xs) < x0 || Math.min(...xs) > x1 || Math.max(...ys) < y0 || Math.min(...ys) > y1) {
			return false;
		}
		if (inside(pts[0]) || inside(pts[3])) {
			return true;
		}
		// Remaining hulls at this depth are below canvas precision.
		if (depth === 24) {
			return true;
		}
		const a = half(pts[0], pts[1]),
			b = half(pts[1], pts[2]),
			c = half(pts[2], pts[3]);
		const d = half(a, b),
			e = half(b, c),
			m = half(d, e);
		return curve([pts[0], a, d, m], depth + 1) || curve([m, e, c, pts[3]], depth + 1);
	};
	return G.curve ? curve(G.curve) : G.pts.slice(1).some((p: number[], i: number) => segment(G.pts[i], p));
}
export function nodeInside(c: ToolCtx, n: any, x0: number, x1: number, y0: number, y1: number) {
	const { w, h } = c.layout(n);
	return !n.hidden && !n.locked && n.x - w / 2 >= x0 && n.x + w / 2 <= x1 && n.y - h / 2 >= y0 && n.y + h / 2 <= y1;
}
// Smart guides: snap the moved boxes to the edges and centres of the other boxes, as PowerPoint does.
export function guides(c: ToolCtx, orig: Map<string, any>, dx: number, dy: number, lockX: boolean, lockY: boolean) {
	const tol = 6 / c.scale;
	const boxes = [...orig.keys()]
		.filter((id) => c.byId(id))
		.map((id) => {
			const o = orig.get(id),
				{ w, h } = c.layout(c.byId(id));
			return { x0: o.x + dx - w / 2, x1: o.x + dx + w / 2, y0: o.y + dy - h / 2, y1: o.y + dy + h / 2 };
		});
	if (!boxes.length) return { dx: 0, dy: 0, lines: [] };
	const m = {
		x0: Math.min(...boxes.map((b) => b.x0)),
		x1: Math.max(...boxes.map((b) => b.x1)),
		y0: Math.min(...boxes.map((b) => b.y0)),
		y1: Math.max(...boxes.map((b) => b.y1)),
	};
	const xs = [m.x0, (m.x0 + m.x1) / 2, m.x1],
		ys = [m.y0, (m.y0 + m.y1) / 2, m.y1];
	let bx: any = null,
		by: any = null;
	for (const n of c.nodes) {
		if (orig.has(n.id)) {
			continue;
		}
		const { w, h } = c.layout(n);
		const ox = [n.x - w / 2, n.x, n.x + w / 2],
			oy = [n.y - h / 2, n.y, n.y + h / 2];
		for (const a of lockX ? [] : xs) {
			for (const v of ox) {
				if (Math.abs(v - a) < tol && (!bx || Math.abs(v - a) < Math.abs(bx.d))) {
					bx = { d: v - a, x: v, n, w, h };
				}
			}
		}
		for (const a of lockY ? [] : ys) {
			for (const v of oy) {
				if (Math.abs(v - a) < tol && (!by || Math.abs(v - a) < Math.abs(by.d))) {
					by = { d: v - a, y: v, n, w, h };
				}
			}
		}
	}
	const lines: any[] = [];
	const gx = bx ? bx.d : 0,
		gy = by ? by.d : 0;
	if (bx) {
		const v = [m.y0 + gy, m.y1 + gy, bx.n.y - bx.h / 2, bx.n.y + bx.h / 2];
		lines.push({ x: bx.x, a: Math.min(...v), b: Math.max(...v) });
	}
	if (by) {
		const v = [m.x0 + gx, m.x1 + gx, by.n.x - by.w / 2, by.n.x + by.w / 2];
		lines.push({ y: by.y, a: Math.min(...v), b: Math.max(...v) });
	}
	return { dx: gx, dy: gy, lines };
}
// The fields of an arrow op that pin the arrow to the points `pts`.
export function fixedUpdate(c: ToolCtx, e: any, pts: number[][]) {
	const objects = c.nodes.map((n) => ({ ...n, ...c.layout(n) }));
	const side = (n: any, p: number[]) => {
		const options: [string, number][] = [
			['west', Math.abs(p[0] - n.x + n.w / 2)],
			['east', Math.abs(p[0] - n.x - n.w / 2)],
			['south', Math.abs(p[1] - n.y + n.h / 2)],
			['north', Math.abs(p[1] - n.y - n.h / 2)],
		];
		return options.sort((a, b) => a[1] - b[1])[0][0];
	};
	const a = objects.find((n) => n.id === e.from) || c.endpointObject(e.from),
		b = objects.find((n) => n.id === e.to) || c.endpointObject(e.to),
		sa = side(a, pts[0]),
		sb = side(b, pts[pts.length - 1]);
	const last = pts[pts.length - 1];
	return {
		route: 'fixed',
		chain: null,
		waypoints: pts.slice(1, -1),
		fromAnchor: sa,
		toAnchor: sb,
		fromOffset: pts[0][/north|south/.test(sa) ? 0 : 1] - a[/north|south/.test(sa) ? 'x' : 'y'],
		toOffset: last[/north|south/.test(sb) ? 0 : 1] - b[/north|south/.test(sb) ? 'x' : 'y'],
	};
}
