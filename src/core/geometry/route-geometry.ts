// Arrow geometry for an edge between two measured boxes: anchored, bent, U-shaped, or the legacy unanchored path.
import type { EdgeLike, Obj, Point } from '../model/node';
import { autoRoute } from './route-auto';
import { borderPoint, lane, point } from './route-base';
import { fixedGeometry, loopGeometry } from './route-fixed';

export function geometry(
	e: EdgeLike,
	a: Obj,
	b: Obj,
	edges: EdgeLike[],
	style: string,
	objects: Obj[] = [a, b],
	prior: Point[][] = [],
): any {
	if (!a || !b) return null;
	if (e.from === e.to) return loopGeometry(e, a);
	if (e.route === 'fixed') return fixedGeometry(e, a, b, objects);
	if (e.route === 'auto' || e.route === 'manhattan') {
		const g = autoRoute(e, a, b, objects, prior),
			l = lane(e, edges);
		if (l && g.sa && g.sb && !e.fromAnchor && !e.toAnchor) {
			const off = (n: any, s: any, p: any) => {
				const h = /north|south/.test(s),
					limit = (h ? n.w : n.h) / 2 - 0.5;
				return Math.max(-limit, Math.min(limit, p[h ? 0 : 1] - n[h ? 'x' : 'y'] + l));
			};
			return autoRoute(
				{
					...e,
					fromAnchor: g.sa,
					toAnchor: g.sb,
					fromOffset: off(a, g.sa, g.pts[0]),
					toOffset: off(b, g.sb, g.pts.at(-1)),
				},
				a,
				b,
				objects,
				prior,
			);
		}
		return g;
	}
	if (!a || !b) return null;
	const l = lane(e, edges);
	const sideA = e.fromAnchor || (e.route === 'u' ? 'south' : undefined),
		sideB = e.toAnchor || (e.route === 'u' ? 'south' : undefined);
	const p = point(a, sideA, e.fromOffset !== undefined ? a : b),
		q = point(b, sideB, e.toOffset !== undefined ? b : a);
	if (e.fromOffset !== undefined) p[/north|south/.test(sideA) ? 0 : 1] += e.fromOffset;
	if (e.toOffset !== undefined) q[/north|south/.test(sideB) ? 0 : 1] += e.toOffset;
	const forward = q[0] < p[0] || (q[0] === p[0] && q[1] < p[1]) ? -1 : 1;
	const dx = (q[0] - p[0]) * forward,
		dy = (q[1] - p[1]) * forward,
		len = Math.hypot(dx, dy) || 1;
	const shift = [(-dy / len) * l, (dx / len) * l];
	for (const [v, n, side, offset] of [
		[p, a, sideA, e.fromOffset],
		[q, b, sideB, e.toOffset],
	]) {
		if (offset !== undefined) continue;
		// A lane slides along a chosen side, never off the rectangle.
		if (side?.includes('east') || side?.includes('west'))
			v[1] += Math.max(-n.h / 2 + 0.5, Math.min(n.h / 2 - 0.5, shift[1]));
		else if (side?.includes('north') || side?.includes('south'))
			v[0] += Math.max(-n.w / 2 + 0.5, Math.min(n.w / 2 - 0.5, shift[0]));
		else {
			const vertical = Math.abs(v[0] - n.x) < n.w / 2 - 0.01;
			if (vertical) v[0] += shift[0];
			else v[1] += shift[1];
		}
	}
	const route = e.route === 'auto' ? style : e.route;
	let pts = [p, q],
		curve;
	if (route === 'u' || (sideA && sideA === sideB && route === 'manhattan')) {
		const s = sideA || 'south',
			h = s === 'north' || s === 'south',
			sign = s === 'north' || s === 'east' ? 1 : -1;
		const mid =
			e.mid ??
			(h
				? sign > 0
					? Math.max(p[1], q[1]) + 7
					: Math.min(p[1], q[1]) - 7
				: sign > 0
					? Math.max(p[0], q[0]) + 7
					: Math.min(p[0], q[0]) - 7);
		pts = h ? [p, [p[0], mid], [q[0], mid], q] : [p, [mid, p[1]], [mid, q[1]], q];
	} else if (route === 'hvh' || route === 'vhv' || route === 'manhattan') {
		const h = route === 'hvh' || (route === 'manhattan' && Math.abs(dx) >= Math.abs(dy)),
			mid = e.mid ?? (h ? (p[0] + q[0]) / 2 : (p[1] + q[1]) / 2);
		pts = h ? [p, [mid, p[1]], [mid, q[1]], q] : [p, [p[0], mid], [q[0], mid], q];
	} else if (route === 'bend' || route === 'curved') {
		const angle = ((route === 'curved' ? 20 : e.bend || 0) * Math.PI) / 180,
			th = Math.atan2(q[1] - p[1], q[0] - p[0]),
			L = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.3915;
		curve = [
			p,
			[p[0] + Math.cos(th + angle) * L, p[1] + Math.sin(th + angle) * L],
			[q[0] - Math.cos(th - angle) * L, q[1] - Math.sin(th - angle) * L],
			q,
		];
	}
	if (pts.length > 2 && (pts.every((p) => p[0] === pts[0][0]) || pts.every((p) => p[1] === pts[0][1])))
		pts = [pts[0], pts[pts.length - 1]];
	const label = curve
		? [0, 1].map((k) => curve[0][k] / 8 + (3 * curve[1][k]) / 8 + (3 * curve[2][k]) / 8 + curve[3][k] / 8)
		: pts.length === 4
			? [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2]
			: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
	return {
		pts,
		curve,
		label,
		r: { type: curve ? 'bend' : pts.length === 4 ? (pts[0][1] === pts[1][1] ? 'hvh' : 'vhv') : 'line', mid: e.mid },
		special: true,
	};
}
// Preserve the existing unanchored path when only its label is edited.
export function legacyGeometry(e: EdgeLike, a: Obj, b: Obj, style: string): any {
	if (!a || !b) return null;
	const border = borderPoint;
	let type = e.route === 'auto' ? style : e.route,
		mid = e.mid,
		at,
		bend = e.bend;
	const dx = b.x - a.x,
		dy = b.y - a.y,
		aw = a.w / 2,
		ah = a.h / 2,
		bw = b.w / 2,
		bh = b.h / 2;
	if (type === 'curved') {
		type = 'bend';
		bend = 20;
	}
	if (type === 'manhattan') {
		const xo = Math.abs(dx) < aw + bw - 1,
			yo = Math.abs(dy) < ah + bh - 1;
		if (xo && !yo) {
			if (Math.abs(dx) < 0.05) type = 'straight';
			else if (Math.abs(dx) <= aw - 1) {
				type = 'vert';
				at = 'b';
			} else if (Math.abs(dx) <= bw - 1) {
				type = 'vert';
				at = 'a';
			} else type = 'vhv';
		} else if (yo && !xo) {
			if (Math.abs(dy) < 0.05) type = 'straight';
			else if (Math.abs(dy) <= ah - 1) {
				type = 'horz';
				at = 'b';
			} else if (Math.abs(dy) <= bh - 1) {
				type = 'horz';
				at = 'a';
			} else type = 'hvh';
		} else type = Math.abs(dy) >= Math.abs(dx) ? 'vhv' : 'hvh';
		if (type === 'hvh' || type === 'vhv') mid = Math.round((type === 'hvh' ? a.x + b.x : a.y + b.y) * 5) / 10;
	}
	let pts, curve;
	if (type === 'vert') {
		const x = at === 'b' ? b.x : a.x,
			sgn = dy < 0 ? -1 : 1;
		pts = [
			[x, a.y + sgn * ah],
			[x, b.y - sgn * bh],
		];
	} else if (type === 'horz') {
		const y = at === 'b' ? b.y : a.y,
			sgn = dx < 0 ? -1 : 1;
		pts = [
			[a.x + sgn * aw, y],
			[b.x - sgn * bw, y],
		];
	} else if (type === 'hvh' || type === 'vhv') {
		const h = type === 'hvh';
		if (mid === null || mid === undefined) {
			const c = h ? [b.x, a.y] : [a.x, b.y];
			pts = [border(a, c), c, border(b, c)];
		} else {
			const c = h ? [mid, a.y] : [a.x, mid],
				d = h ? [mid, b.y] : [b.x, mid];
			pts = [border(a, c), c, d, border(b, d)];
		}
	} else if (type === 'bend') {
		const th = Math.atan2(dy, dx),
			d = ((bend || 0) * Math.PI) / 180,
			out = th + d,
			inn = th + Math.PI - d,
			p = border(a, [a.x + Math.cos(out) * 1000, a.y + Math.sin(out) * 1000]),
			q = border(b, [b.x + Math.cos(inn) * 1000, b.y + Math.sin(inn) * 1000]),
			L = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.3915;
		curve = [
			p,
			[p[0] + Math.cos(out) * L, p[1] + Math.sin(out) * L],
			[q[0] + Math.cos(inn) * L, q[1] + Math.sin(inn) * L],
			q,
		];
		pts = [p, q];
	} else pts = [border(a, [b.x, b.y]), border(b, [a.x, a.y])];
	const label = curve
		? [0, 1].map((k) => curve[0][k] / 8 + (3 * curve[1][k]) / 8 + (3 * curve[2][k]) / 8 + curve[3][k] / 8)
		: pts.length === 4
			? pts[1].map((v, k) => (v + pts[2][k]) / 2)
			: pts[0].map((v, k) => (v + pts[1][k]) / 2);
	return { pts, curve, label, r: { type: type === 'straight' ? 'line' : type, mid, at, bend }, special: true };
}
