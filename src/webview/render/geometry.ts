// @ts-nocheck
import { geo } from '../store/geometry';
import { px, py } from '../store/model';
import { PT } from '../store/constants';
import { byId } from '../store/model';

export const half = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
// An arrow whose end box is hidden is not drawn, but the geometry (the serializer's) still exists.
export const hiddenEnd = (e) => !!(byId(e.from)?.hidden || byId(e.to)?.hidden);
// The path of an arrow from core; null when it is not drawn.
export function baseEdgeGeom(e) {
	return hiddenEnd(e) ? null : geo().base(e);
}
export function edgePath(G) {
	if (G.curve) {
		const [p1, c1, c2, p2] = G.curve;
		return `M ${px(p1[0])} ${py(p1[1])} C ${px(c1[0])} ${py(c1[1])} ${px(c2[0])} ${py(c2[1])} ${px(p2[0])} ${py(p2[1])}`;
	}
	const pts = G.pts,
		coord = (p) => `${px(p[0])} ${py(p[1])}`,
		parts = [`M ${coord(pts[0])}`];
	for (let i = 1; i < pts.length - 1; i++) {
		const a = pts[i - 1],
			b = pts[i],
			c = pts[i + 1],
			l1 = Math.hypot(a[0] - b[0], a[1] - b[1]),
			l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
		if (!l1 || !l2) {
			parts.push(`L ${coord(b)}`);
			continue;
		}
		const r = 2 * PT,
			pre = b.map((v, k) => v + ((a[k] - v) * r) / l1),
			post = b.map((v, k) => v + ((c[k] - v) * r) / l2);
		const c1 = pre.map((v, k) => v + 0.5522847 * (b[k] - v)),
			c2 = post.map((v, k) => v + 0.5522847 * (b[k] - v));
		parts.push(`L ${coord(pre)} C ${coord(c1)} ${coord(c2)} ${coord(post)}`);
	}
	parts.push(`L ${coord(pts[pts.length - 1])}`);
	return parts.join(' ');
}
