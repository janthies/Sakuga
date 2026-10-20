// @ts-nocheck
import { store } from '../store/store';
import { endpointObject } from '../render/anchors';
import { edgeGeom } from '../render/edges';
import { half } from '../render/geometry';
import { byId, layout } from '../store/model';

export function edgeInside(e, x0, x1, y0, y1) {
	const a = endpointObject(e.from),
		b = endpointObject(e.to);
	if (!a || !b || a.hidden || b.hidden || a.locked || b.locked) {
		return false;
	}
	if (store.selN.has(e.from) && store.selN.has(e.to)) {
		return true;
	}
	const G = edgeGeom(e);
	if (!G) {
		return false;
	}
	const inside = ([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
	const segment = (p, q) => {
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
	const curve = (pts, depth = 0) => {
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
	return G.curve ? curve(G.curve) : G.pts.slice(1).some((p, i) => segment(G.pts[i], p));
}
export function nodeInside(n, x0, x1, y0, y1) {
	const { w, h } = layout(n);
	return !n.hidden && !n.locked && n.x - w / 2 >= x0 && n.x + w / 2 <= x1 && n.y - h / 2 >= y0 && n.y + h / 2 <= y1;
}
// Smart guides: snap the moved boxes to the edges and centres of the other boxes, as PowerPoint does.
export function guides(orig, dx, dy, lockX, lockY) {
	const tol = 6 / store.view.s;
	const boxes = [...orig.keys()].map((id) => {
		const o = orig.get(id),
			{ w, h } = layout(byId(id));
		return { x0: o.x + dx - w / 2, x1: o.x + dx + w / 2, y0: o.y + dy - h / 2, y1: o.y + dy + h / 2 };
	});
	const m = {
		x0: Math.min(...boxes.map((b) => b.x0)),
		x1: Math.max(...boxes.map((b) => b.x1)),
		y0: Math.min(...boxes.map((b) => b.y0)),
		y1: Math.max(...boxes.map((b) => b.y1)),
	};
	const xs = [m.x0, (m.x0 + m.x1) / 2, m.x1],
		ys = [m.y0, (m.y0 + m.y1) / 2, m.y1];
	let bx = null,
		by = null;
	for (const n of store.nodes) {
		if (orig.has(n.id)) {
			continue;
		}
		const { w, h } = layout(n);
		const ox = [n.x - w / 2, n.x, n.x + w / 2],
			oy = [n.y - h / 2, n.y, n.y + h / 2];
		for (const a of lockX ? [] : xs) {
			for (const c of ox) {
				if (Math.abs(c - a) < tol && (!bx || Math.abs(c - a) < Math.abs(bx.d))) {
					bx = { d: c - a, x: c, n, w, h };
				}
			}
		}
		for (const a of lockY ? [] : ys) {
			for (const c of oy) {
				if (Math.abs(c - a) < tol && (!by || Math.abs(c - a) < Math.abs(by.d))) {
					by = { d: c - a, y: c, n, w, h };
				}
			}
		}
	}
	const lines = [];
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
export function fixedUpdate(e, pts) {
	const objects = store.nodes.map((n) => ({ ...n, ...layout(n) }));
	const side = (n, p) => {
		const options = [
			['west', Math.abs(p[0] - n.x + n.w / 2)],
			['east', Math.abs(p[0] - n.x - n.w / 2)],
			['south', Math.abs(p[1] - n.y + n.h / 2)],
			['north', Math.abs(p[1] - n.y - n.h / 2)],
		];
		return options.sort((a, b) => a[1] - b[1])[0][0];
	};
	const a = objects.find((n) => n.id === e.from) || endpointObject(e.from),
		b = objects.find((n) => n.id === e.to) || endpointObject(e.to),
		sa = side(a, pts[0]),
		sb = side(b, pts.at(-1));
	return {
		route: 'fixed',
		chain: null,
		waypoints: pts.slice(1, -1),
		fromAnchor: sa,
		toAnchor: sb,
		fromOffset: pts[0][/north|south/.test(sa) ? 0 : 1] - a[/north|south/.test(sa) ? 'x' : 'y'],
		toOffset: pts.at(-1)[/north|south/.test(sb) ? 0 : 1] - b[/north|south/.test(sb) ? 'x' : 'y'],
	};
}
