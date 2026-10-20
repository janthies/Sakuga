// Loops and fixed chains: arrows whose path the user drew.
import type { EdgeLike, Obj, Point } from '../model/node';
import { eps, hits, normals, point, port, result, tidy } from './route-base';

export function loopGeometry(e: EdgeLike, n: Obj): any {
	const side = e.loopSide || 'north',
		angle = ({ north: 90, east: 0, south: 270, west: 180 } as Record<string, number>)[side],
		normal = normals[side],
		size = e.loopSize ?? 8;
	let p, q, out, inn;
	const round = /circle|ellipse/.test(n.style?.shape);
	if (round) {
		out = e.loopOut ?? angle + 22;
		inn = e.loopIn ?? angle - 22;
		const ray = (deg: any) => {
			const r = (deg * Math.PI) / 180;
			const k = 1 / Math.hypot(Math.cos(r) / (n.w / 2), Math.sin(r) / (n.h / 2));
			return [n.x + k * Math.cos(r), n.y + k * Math.sin(r)];
		};
		p = ray(out);
		q = ray(inn);
	} else {
		out = e.loopOut ?? angle;
		inn = e.loopIn ?? angle;
		const len = /north|south/.test(side) ? n.w : n.h;
		p = port(n, e.fromAnchor || side, e.fromOffset ?? -len / 6);
		q = port(n, e.toAnchor || side, e.toOffset ?? len / 6);
	}
	const d = Math.min(
			e.loopMax ?? 10000,
			Math.max(size, (0.3915 * (e.looseness ?? 1) * Math.hypot(q[0] - p[0], q[1] - p[1]) * 255) / 256),
		),
		c = (p: any, a: any) =>
			p.map((v: any, k: any) => v + d * (k ? Math.sin((a * Math.PI) / 180) : Math.cos((a * Math.PI) / 180))),
		curve = [p, c(p, out), c(q, inn), q];
	return result([p, q], {
		curve,
		label: p.map((v, k) => v / 8 + (3 * curve[1][k]) / 8 + (3 * curve[2][k]) / 8 + q[k] / 8),
		loop: true,
		side,
		out,
		inn,
		d,
		sa: side,
		sb: side,
	});
}
export function coordinate(text: string, objects: Obj[]): Point {
	text = text.replace(/^\(|\)$/g, '').trim();
	const m = /^(.*?)\s+(\|-|-\|)\s+(.*)$/.exec(text);
	if (m) {
		const a = coordinate(m[1], objects),
			b = coordinate(m[3], objects);
		return m[2] === '|-' ? [a[0], b[1]] : [b[0], a[1]];
	}
	const xy = /^(-?[\d.]+),\s*(-?[\d.]+)$/.exec(text);
	if (xy) return [+xy[1], +xy[2]];
	const ref = /^(?:\[([^\]]+)\])?([\w-]+)(?:\.(.*))?$/.exec(text);
	if (!ref) return [0, 0];
	const n = objects.find((n) => n.id === ref[2]);
	if (!n) return [0, 0];
	const p = point(n, ref[3] || 'center', n);
	for (const sh of (ref[1] || '').matchAll(/([xy])shift=(-?[\d.]+)mm/g)) p[sh[1] === 'x' ? 0 : 1] += +sh[2];
	return p;
}
export function chainPoints(chain: string[], objects: Obj[]): Point[] {
	const pts = [coordinate(chain[0], objects)];
	for (let i = 1; i < chain.length; i += 2) {
		const p = pts.at(-1)!,
			q = coordinate(chain[i + 1], objects),
			op = chain[i];
		if (op === '|-') pts.push([p[0], q[1]]);
		if (op === '-|') pts.push([q[0], p[1]]);
		pts.push(q);
	}
	return tidy(pts);
}
export function fixedGeometry(e: EdgeLike, a: Obj, b: Obj, objects: Obj[]): any {
	let pts = e.chain
		? chainPoints(e.chain, objects)
		: [
				port(a, e.fromAnchor || 'east', e.fromOffset),
				...(e.waypoints || []).map((p: any) => p.slice()),
				port(b, e.toAnchor || 'west', e.toOffset),
			];
	if (pts.length > 2) {
		const first = /east|west/.test(e.fromAnchor || 'east');
		pts[1][first ? 1 : 0] = pts[0][first ? 1 : 0];
		const last = /east|west/.test(e.toAnchor || 'west');
		pts.at(-2)[last ? 1 : 0] = pts.at(-1)[last ? 1 : 0];
	}
	if (e.chain && pts.length > 1) {
		if (/^\([\w-]+\)$/.test(e.chain[0])) pts[0] = point(a, undefined, { x: pts[1][0], y: pts[1][1] });
		if (/^\([\w-]+\)$/.test(e.chain.at(-1)))
			pts[pts.length - 1] = point(b, undefined, { x: pts.at(-2)[0], y: pts.at(-2)[1] });
	}
	// Only levels intersecting a moved endpoint are displaced. The remaining interior levels stay put.
	if (pts.length > 2)
		for (const [n, side, end, adj, next] of [
			[a, e.fromAnchor, 0, 1, 2],
			[b, e.toAnchor, pts.length - 1, pts.length - 2, pts.length - 3],
		]) {
			if (!normals[side]) continue;
			const normal = normals[side],
				axis = normal[0] ? 0 : 1,
				sign = normal[axis];
			if (sign * (pts[adj][axis] - pts[end][axis]) < eps) {
				const old = pts[adj][axis],
					value = pts[end][axis] + sign * 2;
				pts[adj][axis] = value;
				if (next !== end && Math.abs(pts[next][axis] - old) < eps) pts[next][axis] = value;
			}
		}
	for (let pass = 0; pass < 3; pass++)
		for (let i = 1; i < pts.length - 2; i++)
			for (const n of [a, b])
				if (hits(n, pts[i], pts[i + 1])) {
					const axis = Math.abs(pts[i][0] - pts[i + 1][0]) < eps ? 0 : 1,
						c = n[axis ? 'y' : 'x'],
						half = n[axis ? 'h' : 'w'] / 2,
						sign = pts[i][axis] >= c ? 1 : -1;
					pts[i][axis] = pts[i + 1][axis] = c + sign * (half + 2);
				}
	return result(pts, { fixed: true });
}
