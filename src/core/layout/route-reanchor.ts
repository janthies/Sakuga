// Re-anchoring arrows after boxes moved, and removing a corner from a drawn path.
import type { EdgeLike, Obj, OpLike, Point } from '../model/node';
import { eps, tidy } from '../geometry/route-base';
import { fixedGeometry } from '../geometry/route-fixed';

export function removeCorner(pts: Point[], j: number): Point[] | null {
	pts = pts.map((p) => p.slice());
	if (j < 1 || j >= pts.length - 1) return pts;
	const a = pts[j - 1],
		b = pts[j + 1];
	if (Math.abs(a[0] - b[0]) < eps || Math.abs(a[1] - b[1]) < eps) pts.splice(j, 1);
	else if (j + 2 < pts.length) {
		const c = pts[j + 2];
		if (Math.abs(b[0] - c[0]) < eps) b[0] = a[0];
		else b[1] = a[1];
		pts.splice(j, 1);
	} else if (j > 1) {
		const c = pts[j - 2];
		if (Math.abs(a[0] - c[0]) < eps) a[0] = b[0];
		else a[1] = b[1];
		pts.splice(j, 1);
	}
	return tidy(pts);
}
// Preserve hand-routed interiors while re-attaching the end segments after layout.
export function reanchor(edges: EdgeLike[], before: Obj[], after: Obj[]): OpLike[] {
	const ops: OpLike[] = [];
	edges.forEach((e, index) => {
		if (!['fixed', 'u'].includes(e.route)) return;
		const a = before.find((n) => n.id === e.from),
			b = before.find((n) => n.id === e.to),
			A = after.find((n) => n.id === e.from),
			B = after.find((n) => n.id === e.to);
		if (!a || !b || !A || !B) return;
		if (['x', 'y', 'w', 'h'].every((k) => a[k] === A[k] && b[k] === B[k])) return;
		if (e.route === 'u') {
			const side = e.fromAnchor || 'south',
				h = /north|south/.test(side),
				axis = h ? 'y' : 'x',
				size = h ? 'h' : 'w',
				sign = /north|east/.test(side) ? 1 : -1;
			const old =
				sign > 0
					? Math.max(a[axis] + a[size] / 2, b[axis] + b[size] / 2)
					: Math.min(a[axis] - a[size] / 2, b[axis] - b[size] / 2);
			const now =
				sign > 0
					? Math.max(A[axis] + A[size] / 2, B[axis] + B[size] / 2)
					: Math.min(A[axis] - A[size] / 2, B[axis] - B[size] / 2);
			if (e.mid != null) ops.push({ op: 'arrow', index, mid: e.mid + now - old });
			return;
		}
		const g = fixedGeometry(e, a, b, before);
		if (!g?.pts?.length) return;
		const ps = g.pts,
			sa =
				e.fromAnchor ||
				(Math.abs(ps[1][0] - ps[0][0]) >= Math.abs(ps[1][1] - ps[0][1])
					? ps[1][0] >= ps[0][0]
						? 'east'
						: 'west'
					: ps[1][1] >= ps[0][1]
						? 'north'
						: 'south');
		const j = ps.length - 1,
			sb =
				e.toAnchor ||
				(Math.abs(ps[j - 1][0] - ps[j][0]) >= Math.abs(ps[j - 1][1] - ps[j][1])
					? ps[j - 1][0] >= ps[j][0]
						? 'east'
						: 'west'
					: ps[j - 1][1] >= ps[j][1]
						? 'north'
						: 'south');
		const delta = [A.x - a.x, A.y - a.y],
			same = Math.abs(delta[0] - (B.x - b.x)) < 0.001 && Math.abs(delta[1] - (B.y - b.y)) < 0.001;
		const fix = {
			...e,
			chain: undefined,
			waypoints: ps.slice(1, -1).map((p: any) => p.map((v: any, k: any) => v + (same ? delta[k] : 0))),
			fromAnchor: sa,
			toAnchor: sb,
			fromOffset: e.fromOffset ?? ps[0][/north|south/.test(sa) ? 0 : 1] - a[/north|south/.test(sa) ? 'x' : 'y'],
			toOffset: e.toOffset ?? ps[j][/north|south/.test(sb) ? 0 : 1] - b[/north|south/.test(sb) ? 'x' : 'y'],
		};
		const result = fixedGeometry(fix, A, B, after);
		ops.push({
			op: 'arrow',
			index,
			chain: null,
			waypoints: result.pts.slice(1, -1),
			fromAnchor: sa,
			toAnchor: sb,
			fromOffset: fix.fromOffset,
			toOffset: fix.toOffset,
		});
	});
	return ops;
}
