// Arrange on a copy, then repair routes in the same undoable batch.
import { apply } from '../ops/apply';
import type { Op } from '../ops/types';
import type { Figure } from '../model/figure';
import { edges } from '../model/queries';
import { geometryOf } from '../geometry/figure-geometry';
import type { Point, Obj } from '../model/node';

function segment(r: Obj, a: Point, b: Point): boolean {
	let lo = 0,
		hi = 1;
	for (const [k, centre, size] of [
		[0, r.x, r.w],
		[1, r.y, r.h],
	]) {
		const min = centre - size / 2 + 0.001,
			max = centre + size / 2 - 0.001,
			d = b[k] - a[k];
		if (!d) {
			if (a[k] <= min || a[k] >= max) return false;
		} else {
			const u = (min - a[k]) / d,
				v = (max - a[k]) / d;
			lo = Math.max(lo, Math.min(u, v));
			hi = Math.min(hi, Math.max(u, v));
		}
	}
	return lo < hi;
}
function cubic(r: Obj, pts: Point[], depth = 0): boolean {
	if (
		Math.max(...pts.map((p) => p[0])) <= r.x - r.w / 2 ||
		Math.min(...pts.map((p) => p[0])) >= r.x + r.w / 2 ||
		Math.max(...pts.map((p) => p[1])) <= r.y - r.h / 2 ||
		Math.min(...pts.map((p) => p[1])) >= r.y + r.h / 2
	)
		return false;
	if (depth === 16) return segment(r, pts[0], pts[3]);
	const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	const [a, b, c, d] = pts,
		ab = mid(a, b),
		bc = mid(b, c),
		cd = mid(c, d),
		abc = mid(ab, bc),
		bcd = mid(bc, cd),
		m = mid(abc, bcd);
	return cubic(r, [a, ab, abc, m], depth + 1) || cubic(r, [m, bcd, cd, d], depth + 1);
}
export function arrangeRoutes(figure: Figure, plan: Op): Op {
	const fig = JSON.parse(JSON.stringify(figure)) as Figure;
	apply(fig, plan);
	const repairs: Op[] = [];
	edges(fig).forEach((e, index) => {
		const geo = geometryOf(fig),
			g = geo.edge(e);
		if (!g) return;
		const crossed = geo
			.objects()
			.some(
				(r) =>
					!r.frame &&
					!r.hidden &&
					!r.kind &&
					r.id !== e.from &&
					r.id !== e.to &&
					(g.curve ? cubic(r, g.curve) : g.pts.slice(1).some((p: Point, j: number) => segment(r, g.pts[j], p))),
			);
		if (crossed) {
			const repair: Op = { op: 'arrow', index, resetAuto: true };
			apply(fig, repair);
			repairs.push(repair);
		}
	});
	return { op: 'batch', ops: [plan, ...repairs] };
}
