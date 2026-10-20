// Orthogonal routing around obstacles: straight, L, Z, then one multi-source A*.
import type { EdgeLike, Obj, Point } from '../model/node';
import { eps, hits, inside, normals, point, port, result, sides } from './route-base';

export function autoRoute(e: EdgeLike, a: Obj, b: Obj, objects: Obj[] = [], prior: Point[][] = []): any {
	const others = objects.filter((n) => !n.hidden && !n.frame && n.kind !== 'label' && n.id !== a.id && n.id !== b.id);
	const frames = objects.filter((n) => n.frame && n.id !== a.id && n.id !== b.id);
	const common = frames.filter((f) => inside(f, [a.x, a.y]) && inside(f, [b.x, b.y]));
	const obstacles = [...others.map((n) => ({ ...n, margin: 2 })), { ...a, margin: 0 }, { ...b, margin: 0 }];
	const free = (p: any, q: any) =>
		!obstacles.some((n) => hits(n, p, q, n.margin)) && common.every((f) => inside(f, p, 1.2) && inside(f, q, 1.2));
	const valid = (pts: any) => pts.slice(1).every((q: any, i: any) => free(pts[i], q));
	const facing = (s: any, n: any, o: any) => {
		const d = normals[s];
		return d[0] * (o.x - n.x) + d[1] * (o.y - n.y) > eps;
	};
	const allowed = (n: any, o: any, anchor: any, offset: any) =>
		sides
			.filter((s) => !anchor || s === anchor)
			.flatMap((s) => {
				const h = /north|south/.test(s),
					len = h ? n.w : n.h,
					c = h ? n.x : n.y,
					other = h ? o.x : o.y,
					limit = Math.max(0, len / 2 - 2.5);
				const vals =
					offset !== undefined
						? [offset]
						: [
								0,
								-len / 4,
								len / 4,
								Math.max(-limit, Math.min(limit, other - c)),
								...others.flatMap((r) =>
									(h ? [r.x - r.w / 2 - 2, r.x + r.w / 2 + 2] : [r.y - r.h / 2 - 2, r.y + r.h / 2 + 2])
										.filter((v) => Math.abs(v - c) <= limit)
										.map((v) => v - c),
								),
							];
				return [...new Set(vals)].map((off) => ({ p: port(n, s, off), s, pen: facing(s, n, o) ? 0 : 14 }));
			});
	const starts = allowed(a, b, e.fromAnchor, e.fromOffset),
		ends = allowed(b, a, e.toAnchor, e.toOffset);
	const finish = (pts: any, sa: any, sb: any, rule: any) => result(pts, { sa, sb, rule });
	// 1: straight through the overlap of facing side intervals.
	for (const h of [true, false]) {
		const axis = h ? 0 : 1,
			delta = h ? b.x - a.x : b.y - a.y;
		if (!delta) continue;
		const sa = h ? (delta > 0 ? 'east' : 'west') : delta > 0 ? 'north' : 'south',
			sb = h ? (delta > 0 ? 'west' : 'east') : delta > 0 ? 'south' : 'north';
		if ((e.fromAnchor && e.fromAnchor !== sa) || (e.toAnchor && e.toAnchor !== sb)) continue;
		const lenA = h ? a.h : a.w,
			lenB = h ? b.h : b.w,
			ca = h ? a.y : a.x,
			cb = h ? b.y : b.x,
			lo = Math.max(ca - lenA / 2 + 2.5, cb - lenB / 2 + 2.5),
			hi = Math.min(ca + lenA / 2 - 2.5, cb + lenB / 2 - 2.5);
		if (hi - lo <= 5) continue;
		let c = ca >= lo && ca <= hi && cb >= lo && cb <= hi ? ca : (lo + hi) / 2;
		if (e.fromOffset !== undefined) c = ca + e.fromOffset;
		if (e.toOffset !== undefined && Math.abs(c - (cb + e.toOffset)) > eps) continue;
		const p = port(a, sa, c - ca),
			q = port(b, sb, c - cb);
		if ((q[axis] - p[axis]) * delta > 0 && valid([p, q])) return finish([p, q], sa, sb, 'aligned');
	}
	const candidates = [];
	for (const s of starts)
		for (const t of ends) {
			if (!facing(s.s, a, b) || !facing(t.s, b, a)) continue;
			const p = s.p,
				q = t.p,
				hs = normals[s.s][0] !== 0,
				ht = normals[t.s][0] !== 0;
			if (hs !== ht && Math.abs(b.x - a.x) > a.w / 2 + b.w / 2 && Math.abs(b.y - a.y) > a.h / 2 + b.h / 2) {
				const c = hs ? [q[0], p[1]] : [p[0], q[1]];
				if (valid([p, c, q])) candidates.push({ pts: [p, c, q], s, t });
			}
		}
	const length = (pts: any) =>
		pts.slice(1).reduce((l: any, p: any, i: any) => l + Math.abs(p[0] - pts[i][0]) + Math.abs(p[1] - pts[i][1]), 0);
	if (candidates.length) {
		candidates.sort((x, y) => length(x.pts) - length(y.pts));
		const c = candidates[0];
		return finish(c.pts, c.s.s, c.t.s, 'L');
	}
	for (const s of starts)
		for (const t of ends) {
			if (!facing(s.s, a, b) || !facing(t.s, b, a)) continue;
			const p = s.p,
				q = t.p,
				hs = normals[s.s][0] !== 0;
			if (hs !== (normals[t.s][0] !== 0) || s.s === t.s) continue;
			const mid = hs ? (p[0] + q[0]) / 2 : (p[1] + q[1]) / 2,
				pts = hs ? [p, [mid, p[1]], [mid, q[1]], q] : [p, [p[0], mid], [q[0], mid], q];
			if (valid(pts)) candidates.push({ pts, s, t });
		}
	if (candidates.length) {
		candidates.sort((x, y) => length(x.pts) - length(y.pts));
		const c = candidates[0];
		return finish(c.pts, c.s.s, c.t.s, 'Z');
	}
	// 4: a single multi-source A*. Each state retains heading, bend budget and source side.
	const xs = new Set<number>(),
		ys = new Set<number>();
	for (const c of [...starts, ...ends]) {
		xs.add(c.p[0]);
		ys.add(c.p[1]);
	}
	for (const n of obstacles) {
		xs.add(n.x - n.w / 2 - n.margin);
		xs.add(n.x + n.w / 2 + n.margin);
		ys.add(n.y - n.h / 2 - n.margin);
		ys.add(n.y + n.h / 2 + n.margin);
	}
	for (const f of frames) {
		xs.add(f.x - f.w / 2 + 1.2);
		xs.add(f.x + f.w / 2 - 1.2);
		ys.add(f.y - f.h / 2 + 1.2);
		ys.add(f.y + f.h / 2 - 1.2);
	}
	xs.add(Math.min(...xs) - 4);
	xs.add(Math.max(...xs) + 4);
	ys.add(Math.min(...ys) - 4);
	ys.add(Math.max(...ys) + 4);
	const grid = (s: any) => {
			const a = [...s].sort((a, b) => a - b),
				out = [...a];
			for (let i = 1; i < a.length; i++) out.push((a[i - 1] + a[i]) / 2);
			return [...new Set(out)].sort((a, b) => a - b);
		},
		X = grid(xs),
		Y = grid(ys),
		ny = Y.length;
	const goals = new Map();
	for (const t of ends) {
		const k = X.indexOf(t.p[0]) * ny + Y.indexOf(t.p[1]);
		if (!goals.has(k)) goals.set(k, []);
		goals.get(k).push(t);
	}
	const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		],
		dirSide = ['east', 'west', 'north', 'south'];
	const h = (p: any) => Math.max(0, Math.abs(p[0] - b.x) - b.w / 2) + Math.max(0, Math.abs(p[1] - b.y) - b.h / 2);
	const heap: any[] = [],
		best = new Map(),
		segCache = new Map();
	const push = (n: any) => {
		const key = (((n.i * ny + n.j) * 4 + n.d) * 4 + n.bends) * 4 + n.source;
		if (best.has(key) && best.get(key) <= n.g) return;
		best.set(key, n.g);
		n.key = key;
		n.f = n.g + h([X[n.i], Y[n.j]]);
		heap.push(n);
		let i = heap.length - 1;
		while (i) {
			const p = (i - 1) >> 1;
			if (heap[p].f <= heap[i].f) break;
			[heap[p], heap[i]] = [heap[i], heap[p]];
			i = p;
		}
	};
	const pop = () => {
		const n = heap[0],
			last = heap.pop();
		if (heap.length) {
			heap[0] = last;
			let i = 0;
			for (;;) {
				let m = i;
				for (const j of [i * 2 + 1, i * 2 + 2]) if (j < heap.length && heap[j].f < heap[m].f) m = j;
				if (m === i) break;
				[heap[m], heap[i]] = [heap[i], heap[m]];
				i = m;
			}
		}
		return n;
	};
	for (const s of starts)
		push({
			i: X.indexOf(s.p[0]),
			j: Y.indexOf(s.p[1]),
			d: dirSide.indexOf(s.s),
			bends: 0,
			source: dirSide.indexOf(s.s),
			g: s.pen,
			s,
		});
	let answer = null;
	while (heap.length) {
		const n = pop();
		if (best.get(n.key) < n.g) continue;
		if (answer && n.f >= answer.cost) break;
		const p = [X[n.i], Y[n.j]],
			targets = goals.get(n.i * ny + n.j) || [];
		for (const t of targets)
			if (n.d === (dirSide.indexOf(t.s) ^ 1)) {
				const cost = n.g + t.pen + (t.s === n.s.s ? 10 : 0);
				if (!answer || cost < answer.cost) answer = { n, t, cost };
			}
		for (let d = 0; d < 4; d++) {
			if (d === (n.d ^ 1)) continue;
			const bends = n.bends + (d !== n.d ? 1 : 0);
			if (bends > 3 || (!n.par && d !== n.d)) continue;
			const i = n.i + dirs[d][0],
				j = n.j + dirs[d][1];
			if (i < 0 || j < 0 || i >= X.length || j >= Y.length) continue;
			const q = [X[i], Y[j]],
				ka = n.i * ny + n.j,
				kb = i * ny + j,
				key = Math.min(ka, kb) + ':' + Math.max(ka, kb);
			let c = segCache.get(key);
			if (c === undefined) {
				c = Infinity;
				if (free(p, q)) {
					const len = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
					c = len;
					const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
					for (const f of frames) if (!inside(f, [a.x, a.y]) && !inside(f, [b.x, b.y]) && inside(f, mid)) c += 2 * len;
					for (const pl of prior)
						for (let k = 1; k < pl.length; k++) {
							const u = pl[k - 1],
								v = pl[k],
								vert = d >= 2,
								ov = Math.abs(u[0] - v[0]) < eps;
							if (vert !== ov) {
								const vp = vert ? p : u,
									vq = vert ? q : v,
									hp = vert ? u : p,
									hq = vert ? v : q;
								if (
									vp[0] >= Math.min(hp[0], hq[0]) &&
									vp[0] <= Math.max(hp[0], hq[0]) &&
									hp[1] >= Math.min(vp[1], vq[1]) &&
									hp[1] <= Math.max(vp[1], vq[1])
								)
									c += 6;
							} else if (Math.abs(p[vert ? 0 : 1] - u[vert ? 0 : 1]) < eps) {
								const ax = vert ? 1 : 0;
								c +=
									3 *
									Math.max(
										0,
										Math.min(Math.max(p[ax], q[ax]), Math.max(u[ax], v[ax])) -
											Math.max(Math.min(p[ax], q[ax]), Math.min(u[ax], v[ax])),
									);
							}
						}
				}
				segCache.set(key, c);
			}
			if (Number.isFinite(c))
				push({ i, j, d, bends, source: n.source, g: n.g + c + (d === n.d ? 0 : 8), s: n.s, par: n });
		}
	}
	if (answer) {
		const pts = [];
		for (let n = answer.n; n; n = n.par) pts.push([X[n.i], Y[n.j]]);
		return finish(pts.reverse(), answer.n.s.s, answer.t.s, 'detour');
	}
	return result([point(a, e.fromAnchor, b), point(b, e.toAnchor, a)], { blocked: true, rule: 'blocked' });
}
