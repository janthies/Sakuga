// Shared pieces of the arrow routing: sides, ports, lanes, hit tests (millimetres, y upwards).
import type { EdgeLike, Obj, Point } from '../model/node';

export function lane(e: EdgeLike, edges: EdgeLike[]): number {
	if (Number.isFinite(e.lane)) return e.lane;
	const pair = edges.filter((o) => (o.from === e.from && o.to === e.to) || (o.from === e.to && o.to === e.from));
	return pair.length > 1 ? ((pair.length - 1) / 2 - pair.indexOf(e)) * 7 : 0;
}
export function point(n: Obj, side: string | undefined, toward: { x: number; y: number }, offset?: number): Point {
	if (side && side !== 'center')
		return [
			n.x + (side.includes('east') ? n.w / 2 : side.includes('west') ? -n.w / 2 : 0),
			n.y + (side.includes('north') ? n.h / 2 : side.includes('south') ? -n.h / 2 : 0),
		].map((v, k) =>
			n.frame && ((k === 1 && /east|west/.test(side)) || (k === 0 && /north|south/.test(side)))
				? Math.max(
						(k === 0 ? n.x - n.w / 2 : n.y - n.h / 2) + 0.5,
						Math.min((k === 0 ? n.x + n.w / 2 : n.y + n.h / 2) - 0.5, k === 0 ? toward.x : toward.y),
					)
				: v,
		);
	const dx = toward.x - n.x,
		dy = toward.y - n.y;
	const t = Math.min(dx ? n.w / 2 / Math.abs(dx) : Infinity, dy ? n.h / 2 / Math.abs(dy) : Infinity);
	return Number.isFinite(t) ? [n.x + dx * t, n.y + dy * t] : [n.x, n.y];
}
// Orthogonal routing in mm. One search contains every permitted port at both ends.
export const normals: Record<string, Point> = { east: [1, 0], west: [-1, 0], north: [0, 1], south: [0, -1] };
export const sides = Object.keys(normals),
	eps = 1e-7;
export const tidy = (pts: Point[]): Point[] => {
	const out: Point[] = [];
	for (const p of pts) {
		if (out.length && Math.hypot(p[0] - out.at(-1)![0], p[1] - out.at(-1)![1]) < eps) continue;
		while (out.length > 1) {
			const a = out.at(-2)!,
				b = out.at(-1)!;
			if (
				Math.abs((b[0] - a[0]) * (p[1] - b[1]) - (b[1] - a[1]) * (p[0] - b[0])) > eps ||
				(b[0] - a[0]) * (p[0] - b[0]) + (b[1] - a[1]) * (p[1] - b[1]) < 0
			)
				break;
			out.pop();
		}
		out.push(p.slice());
	}
	return out;
};
export function hits(r: Obj, p: Point, q: Point, m = 0): boolean {
	const x0 = r.x - r.w / 2 - m,
		x1 = r.x + r.w / 2 + m,
		y0 = r.y - r.h / 2 - m,
		y1 = r.y + r.h / 2 + m;
	return Math.abs(p[0] - q[0]) < eps
		? p[0] > x0 + eps && p[0] < x1 - eps && Math.max(p[1], q[1]) > y0 + eps && Math.min(p[1], q[1]) < y1 - eps
		: p[1] > y0 + eps && p[1] < y1 - eps && Math.max(p[0], q[0]) > x0 + eps && Math.min(p[0], q[0]) < x1 - eps;
}
export const inside = (r: Obj, p: Point, m = 0): boolean =>
	Math.abs(p[0] - r.x) <= r.w / 2 - m + eps && Math.abs(p[1] - r.y) <= r.h / 2 - m + eps;
export function port(n: Obj, s: string, offset = 0): Point {
	const p = point(n, s, n);
	p[/north|south/.test(s) ? 0 : 1] += offset;
	return p;
}
export function snapPort(
	n: Obj,
	s: string,
	p: { x: number; y: number },
	disable = false,
): { offset: number; fraction?: number } {
	const h = /north|south/.test(s),
		length = h ? n.w : n.h,
		center = h ? n.x : n.y,
		raw = Math.max(-length / 2, Math.min(length / 2, (h ? p.x : p.y) - center));
	let offset = raw,
		fraction;
	for (const f of [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1])
		if (
			!disable &&
			Math.abs(raw - (f - 0.5) * length) < 1.5 &&
			(fraction === undefined || Math.abs(raw - (f - 0.5) * length) < Math.abs(raw - offset))
		) {
			offset = (f - 0.5) * length;
			fraction = f;
		}
	return { offset: +offset.toFixed(4), fraction };
}
export function result(pts: Point[], more: Record<string, any> = {}): any {
	pts = tidy(pts);
	let total = 0;
	for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
	let left = total / 2,
		label = pts[0];
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1],
			b = pts[i],
			l = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (left <= l) {
			label = a.map((v, k) => v + (b[k] - v) * (l ? left / l : 0));
			break;
		}
		left -= l;
	}
	return {
		pts,
		label,
		r: { type: pts.length === 4 ? (pts[0][0] === pts[1][0] ? 'vhv' : 'hvh') : 'line' },
		special: true,
		...more,
	};
}
export const fmt = (v: number): string => String(+v.toFixed(4));
