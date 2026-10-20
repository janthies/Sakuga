// @ts-nocheck
import * as coreRoutes from '../../core/layout/route';
import { store } from '../store/store';
import { byId, layout, px, py } from '../store/model';
import { endpointObject, frameRect } from './anchors';
import { border } from './svg';
import { PT } from '../store/constants';

// Same routing rules as resolveRoute in tikz.ts, so the canvas draws what TikZ will draw.
export function boxHalf(n) {
	return [(n.width + 2.27) / 2, Math.max(n.code ? 9.55 : 6.16, n.minh || 0) / 2];
}
export function resolveRoute(e, a, b) {
	const route = e.route === 'auto' ? store.arrowsStyle : e.route;
	if (route === 'straight') {
		return { type: 'line' };
	}
	if (route === 'curved') {
		return { type: 'bend', bend: 20 };
	}
	if (route === 'hvh' || route === 'vhv') {
		return { type: route, mid: e.mid };
	}
	if (route === 'bend') {
		return { type: 'bend', bend: e.bend };
	}
	const [aw, ah] = boxHalf(a),
		[bw, bh] = boxHalf(b);
	const dx = b.x - a.x,
		dy = b.y - a.y;
	const xo = Math.abs(dx) < aw + bw - 1,
		yo = Math.abs(dy) < ah + bh - 1;
	const midY = Math.round(((a.y + b.y) / 2) * 10) / 10,
		midX = Math.round(((a.x + b.x) / 2) * 10) / 10;
	if (xo && !yo) {
		if (Math.abs(dx) < 0.05) {
			return { type: 'line' };
		}
		if (Math.abs(dx) <= aw - 1) {
			return { type: 'vert', at: 'b' };
		}
		if (Math.abs(dx) <= bw - 1) {
			return { type: 'vert', at: 'a' };
		}
		return { type: 'vhv', mid: midY };
	}
	if (yo && !xo) {
		if (Math.abs(dy) < 0.05) {
			return { type: 'line' };
		}
		if (Math.abs(dy) <= ah - 1) {
			return { type: 'horz', at: 'b' };
		}
		if (Math.abs(dy) <= bh - 1) {
			return { type: 'horz', at: 'a' };
		}
		return { type: 'hvh', mid: midX };
	}
	return Math.abs(dy) >= Math.abs(dx) ? { type: 'vhv', mid: midY } : { type: 'hvh', mid: midX };
}
export const half = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
export function baseEdgeGeom(e) {
	const a = byId(e.from),
		b = byId(e.to);
	if (
		['auto', 'manhattan', 'fixed', 'loop'].includes(e.route) ||
		e.from === e.to ||
		e.labelStyle ||
		e.labels?.length ||
		e.fromAnchor ||
		e.toAnchor ||
		!a ||
		!b ||
		coreRoutes.lane(e, store.edges) ||
		e.route === 'u'
	) {
		const aa = endpointObject(e.from),
			bb = endpointObject(e.to);
		if (!aa || !bb || aa.hidden || bb.hidden) return null;
		if (
			!['auto', 'manhattan', 'fixed', 'loop'].includes(e.route) &&
			e.from !== e.to &&
			!e.fromAnchor &&
			!e.toAnchor &&
			!aa.frame &&
			!bb.frame &&
			!coreRoutes.lane(e, store.edges) &&
			e.route !== 'u'
		)
			return coreRoutes.legacyGeometry(e, { ...aa, ...layout(aa) }, { ...bb, ...layout(bb) }, store.arrowsStyle);
		const objects = store.nodes
			.map((n) => ({ ...n, ...layout(n) }))
			.concat(
				(typeof store.groups === 'undefined' ? [] : store.groups)
					.filter((g) => g.frame !== 'none')
					.map((g) => frameRect(g.id))
					.filter(Boolean),
			);
		const prior = store.edges
			.slice(0, store.edges.indexOf(e))
			.map((o) => {
				const x = objects.find((n) => n.id === o.from),
					y = objects.find((n) => n.id === o.to);
				return x && y ? coreRoutes.geometry(o, x, y, store.edges, store.arrowsStyle, objects)?.pts : null;
			})
			.filter(Boolean);
		return coreRoutes.geometry(
			e,
			{ ...aa, ...(aa.frame ? {} : layout(aa)) },
			{ ...bb, ...(bb.frame ? {} : layout(bb)) },
			store.edges,
			store.arrowsStyle,
			objects,
			prior,
		);
	}
	if (!a || !b || a.hidden || b.hidden) {
		return null;
	}
	const r = resolveRoute(e, a, b);
	const la = layout(a),
		lb = layout(b);
	if (r.type === 'vert') {
		const x = r.at === 'b' ? b.x : a.x,
			down = b.y < a.y;
		const p1 = [x, a.y + (down ? -la.h / 2 : la.h / 2)],
			p2 = [x, b.y + (down ? lb.h / 2 : -lb.h / 2)];
		return { r, pts: [p1, p2], label: half(p1, p2) };
	}
	if (r.type === 'horz') {
		const y = r.at === 'b' ? b.y : a.y,
			right = b.x > a.x;
		const p1 = [a.x + (right ? la.w / 2 : -la.w / 2), y],
			p2 = [b.x + (right ? -lb.w / 2 : lb.w / 2), y];
		return { r, pts: [p1, p2], label: half(p1, p2) };
	}
	if (r.type === 'hvh' || r.type === 'vhv') {
		const h = r.type === 'hvh';
		if (r.mid === null || r.mid === undefined) {
			const c = h ? [b.x, a.y] : [a.x, b.y];
			const p1 = border(a, c[0], c[1]),
				p2 = border(b, c[0], c[1]);
			return { r, pts: [p1, c, p2], label: half(p1, c) };
		}
		const c1 = h ? [r.mid, a.y] : [a.x, r.mid],
			c2 = h ? [r.mid, b.y] : [b.x, r.mid];
		const p1 = border(a, c1[0], c1[1]),
			p2 = border(b, c2[0], c2[1]);
		return { r, pts: [p1, c1, c2, p2], label: half(c1, c2) };
	}
	if (r.type === 'bend') {
		const th = Math.atan2(b.y - a.y, b.x - a.x),
			d = ((r.bend || 0) * Math.PI) / 180;
		const out = th + d,
			inn = th + Math.PI - d;
		const p1 = border(a, a.x + Math.cos(out) * 1e3, a.y + Math.sin(out) * 1e3);
		const p2 = border(b, b.x + Math.cos(inn) * 1e3, b.y + Math.sin(inn) * 1e3);
		const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.3915;
		const c1 = [p1[0] + Math.cos(out) * L, p1[1] + Math.sin(out) * L];
		const c2 = [p2[0] + Math.cos(inn) * L, p2[1] + Math.sin(inn) * L];
		const m = [0, 1].map((k) => 0.125 * p1[k] + 0.375 * c1[k] + 0.375 * c2[k] + 0.125 * p2[k]);
		return { r, curve: [p1, c1, c2, p2], label: m };
	}
	const p1 = border(a, b.x, b.y),
		p2 = border(b, a.x, a.y);
	return { r, pts: [p1, p2], label: half(p1, p2) };
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
