// The tidy planner: XY-cut of the figure into bands and columns, justified rows, new positions and sizes.
import type { EdgeLike, GroupLike, Layout, NodeLike } from '../model/node';

export function planTidy(
	nodes: NodeLike[],
	groups: GroupLike[],
	edges: EdgeLike[],
	selected: string[],
	layout: Layout,
) {
	const PT = 25.4 / 72.27,
		TOL = 1.5,
		SPAN = 0.85,
		EXTRA = 2.2675;
	const PTS: Record<string, number> = {
		tiny: 6,
		scriptsize: 8,
		footnotesize: 9,
		small: 10,
		normalsize: 10.95,
		large: 12,
	};
	const SEL = new Set(selected),
		SELECT = selected.join(','),
		GROUPS = groups,
		EDGES = edges;
	const plain = (n: any) => !n.kind && (!n.style?.shape || ['rectangle', 'rounded', 'pill'].includes(n.style.shape));
	const NODES = nodes.filter((n) => !n.hidden && (!(n.kind === 'label' || n.kind === 'icon') || SEL.has(n.id)));
	const median = (a: any) => {
		a = a.slice().sort((x: any, y: any) => x - y);
		return a.length ? a[a.length >> 1] : NaN;
	};
	const log = [];
	const wantWidth = (n: any) => n.width;
	const size = (n: any, width: any) => {
		const s = layout({ ...n, width, wantWidth: width });
		return { ...s, fixed: !plain(n) };
	};
	// ---- tree of blocks (nodes and frames); y points down inside the planner ----
	const padOf = (g: any) =>
		g.frame === 'none' ? 0 : g.padding || (g.frame === 'dashed' ? 2.8 : g.frame === 'dotted' ? 1.8 : 3);
	function members(gid: any): any {
		const items = [];
		for (const n of NODES) if (n.group === gid && !n.locked) items.push({ type: 'node', n });
		for (const g of GROUPS)
			if (g.parent === gid) {
				const sub: any = members(g.id);
				if (!sub.length) continue;
				if (g.frame === 'none') items.push(...sub);
				else items.push({ type: 'group', g, items: sub });
			}
		return items;
	}
	const titleExtra = (g: any) => {
		const p = g.titlePosition || 'legacy';
		if (!g.name) return [0, 0];
		const e = (PTS[g.titleFont || 'scriptsize'] + 3) * PT;
		return p.startsWith('above') ? [e, 0] : p === 'below-left' ? [0, e] : [0, 0];
	};
	const topPad = (g: any) => padOf(g) + ((g.titlePosition || '').startsWith('inside') ? 5 : 0);
	const ids = (it: any) => (it.type === 'node' ? [it.n.id] : [it.g.id, ...it.items.flatMap(ids)]);
	function orig(it: any) {
		if (it.type === 'node') {
			const s = size(it.n, it.n.wantWidth ?? it.n.width);
			return { x0: it.n.x - s.w / 2, x1: it.n.x + s.w / 2, y0: -it.n.y - s.h / 2, y1: -it.n.y + s.h / 2 };
		}
		const rs = it.items.map(orig),
			[a, b] = titleExtra(it.g),
			p = padOf(it.g);
		return {
			x0: Math.min(...rs.map((r: any) => r.x0)) - p,
			x1: Math.max(...rs.map((r: any) => r.x1)) + p,
			y0: Math.min(...rs.map((r: any) => r.y0)) - topPad(it.g) - a,
			y1: Math.max(...rs.map((r: any) => r.y1)) + p + b,
		};
	}
	// ---- XY cut: bands = blocks connected by vertical overlap, columns = connected by horizontal overlap ----
	function cut(items: any, O: any, a0: any, a1: any) {
		const out = [];
		for (const it of [...items].sort((p, q) => O.get(p)[a0] - O.get(q)[a0])) {
			const r = O.get(it),
				last = out[out.length - 1];
			if (last && r[a0] < last.hi - 1.0) {
				last.items.push(it);
				last.hi = Math.max(last.hi, r[a1]);
			} else out.push({ items: [it], lo: r[a0], hi: r[a1] });
		}
		return out;
	}
	const rects = (items: any) => new Map<any, any>(items.map((it: any) => [it, orig(it)]));
	const union = (items: any, O: any) => ({
		x0: Math.min(...items.map((i: any) => O.get(i).x0)),
		x1: Math.max(...items.map((i: any) => O.get(i).x1)),
		y0: Math.min(...items.map((i: any) => O.get(i).y0)),
		y1: Math.max(...items.map((i: any) => O.get(i).y1)),
	});
	// dominant gaps of the figure (median of the existing positive gaps, never below a visible arrow length)
	const gv: any[] = [],
		gh: any[] = [];
	(function stats(items) {
		if (items.length < 2) {
			items.forEach((it: any) => it.type === 'group' && stats(it.items));
			return;
		}
		const O = rects(items),
			bands = cut(items, O, 'y0', 'y1');
		bands.forEach((b, i) => {
			if (i) gv.push(b.lo - bands[i - 1].hi);
		});
		for (const b of bands) {
			const cols = cut(b.items, O, 'x0', 'x1');
			cols.forEach((c, j) => {
				if (j) gh.push(c.lo - cols[j - 1].hi);
			});
		}
		items.forEach((it: any) => it.type === 'group' && stats(it.items));
	})(members(''));
	const keep = (a: any) => a.filter((g: any) => g > 0.2 && g < 15);
	const GMIN = 4;
	const GV = Math.max(GMIN, median(keep(gv)) || GMIN),
		GH = Math.max(GMIN, median(keep(gh)) || GMIN);

	function rootItems() {
		if (!SELECT) return members('');
		const sel = new Set(SELECT.split(','));
		const inGroup = (n: any, gid: any) => {
			for (let p = n.group; p; p = GROUPS.find((g) => g.id === p)?.parent) if (p === gid) return true;
			return false;
		};
		const out = [],
			used = new Set();
		const all = (function collect(items) {
			return items.flatMap((it: any) => (it.type === 'node' ? [it] : [it, ...collect(it.items)]));
		})(members(''));
		for (const it of all.filter((i: any) => i.type === 'group')) {
			const nodes = NODES.filter((n) => inGroup(n, it.g.id));
			if (nodes.length && nodes.every((n) => sel.has(n.id) && !used.has(n.id))) {
				out.push(it);
				nodes.forEach((n) => used.add(n.id));
			}
		}
		for (const it of all.filter((i: any) => i.type === 'node'))
			if (sel.has(it.n.id) && !used.has(it.n.id)) {
				out.push(it);
				used.add(it.n.id);
			}
		return out;
	}

	// ---- planner: returns {w, h, place:[{id,x,y,w,h,width,minh}]} relative to the top-left corner ----
	function natural(it: any, forcedW: any): any {
		if (it.type === 'node') {
			const n = it.n,
				s = size(n, plain(n) ? (forcedW ? forcedW - EXTRA : wantWidth(n)) : n.width);
			return {
				w: s.fixed || !forcedW ? s.w : forcedW,
				h: s.h,
				fixed: s.fixed,
				place: [{ id: n.id, x: 0, y: 0, w: s.w, h: s.h, width: s.fixed ? undefined : s.w - EXTRA }],
			};
		}
		const g = it.g,
			p = padOf(g),
			[a, b] = titleExtra(g),
			top = topPad(g);
		const inner: any = planContainer(it.items, forcedW ? forcedW - 2 * p : 0);
		return {
			w: inner.w + 2 * p,
			h: inner.h + top + p + a + b,
			place: inner.place.map((q: any) => ({ ...q, x: q.x + p, y: q.y + top + a })),
		};
	}
	const hasLabel = (A: any, B: any) =>
		EDGES.some(
			(e) =>
				(e.label || e.labels?.length) &&
				((A.includes(e.from) && B.includes(e.to)) || (B.includes(e.from) && A.includes(e.to))),
		);
	const resizable = (it: any) => it.type === 'group' || plain(it.n);
	// one row of blocks (columns side by side); every column may itself be a stack
	function planRow(items: any, forcedW: any): any {
		const O = rects(items),
			cols = cut(items, O, 'x0', 'x1');
		if (cols.length === 1) {
			if (items.length === 1) {
				const b: any = natural(items[0], forcedW);
				return { ...b, parts: [{ o: O.get(items[0]), x: 0, w: b.w }] };
			}
			const u = union(items, O),
				place = []; // overlapping blocks: keep as drawn
			for (const it of items) {
				const b: any = natural(it, 0),
					o = O.get(it);
				for (const q of b.place) place.push({ ...q, x: q.x + o.x0 - u.x0, y: q.y + o.y0 - u.y0 });
			}
			log.push('rigid: ' + items.map((i: any) => ids(i)[0]).join(','));
			return { w: u.x1 - u.x0, h: u.y1 - u.y0, place, parts: [] };
		}
		const colItems = cols.map((c) => c.items),
			plans = colItems.map((ci) => (ci.length === 1 ? natural(ci[0], 0) : planContainer(ci, 0)));
		const gaps = cols.slice(1).map((c, j) => {
			const g = c.lo - cols[j].hi,
				need = hasLabel(colItems[j].flatMap(ids), colItems[j + 1].flatMap(ids)) ? 8 : 0;
			return Math.max(g <= 3 * GH ? GH : g, need);
		});
		const S = () => plans.reduce((s, b) => s + b.w, 0),
			need = S() + gaps.reduce((s, g) => s + g, 0);
		const W = Math.max(forcedW || 0, need),
			free = W - need;
		const canStretch = colItems.every((ci) => ci.length > 1 || resizable(ci[0]));
		let g2 = gaps;
		if (free > 1e-6) {
			if (canStretch)
				colItems.forEach((ci, j) => {
					const w = plans[j].w + free / cols.length;
					plans[j] = ci.length === 1 ? natural(ci[0], w) : planContainer(ci, w);
				});
			else g2 = gaps.map((g) => g + free / gaps.length);
		}
		const boxesOnly = colItems.every((ci) => ci.length === 1 && ci[0].type === 'node' && plain(ci[0].n));
		const H = Math.max(...plans.map((b) => b.h)),
			place: any[] = [],
			parts: any[] = [];
		let x = 0;
		plans.forEach((b, j) => {
			const o = union(colItems[j], O),
				all = cols.map((c, k) => union(colItems[k], O));
			const topAl = all.every((q) => Math.abs(q.y0 - o.y0) <= TOL),
				botAl = all.every((q) => Math.abs(q.y1 - o.y1) <= TOL);
			let dy = topAl ? 0 : botAl ? H - b.h : (H - b.h) / 2;
			if (boxesOnly) {
				const q = b.place[0];
				q.h = H;
				q.minh = H;
				dy = 0;
			}
			for (const q of b.place) place.push({ ...q, x: q.x + x, y: q.y + dy });
			parts.push({ o, x, w: b.w });
			x += b.w + (g2[j] ?? 0);
		});
		return { w: W, h: H, place, parts };
	}
	// a stack of rows, top to bottom; rows that span most of the width are justified to a common width
	function planContainer(items: any, forcedW: any): any {
		const O = rects(items),
			bands = cut(items, O, 'y0', 'y1');
		if (bands.length === 1) return planRow(items, forcedW);
		const ext = union(items, O),
			ext0 = ext.x1 - ext.x0;
		const rows = bands.map((b) => {
			const u = union(b.items, O);
			return { items: b.items, u, just: u.x1 - u.x0 >= SPAN * ext0, p0: planRow(b.items, 0) };
		});
		let W = forcedW || 0;
		for (const r of rows) W = Math.max(W, r.p0.w);
		const place: any[] = [],
			cell: any[] = [];
		let y = 0;
		rows.forEach((r, ri) => {
			const p = r.just ? planRow(r.items, W) : r.p0;
			let off = 0;
			if (!r.just) {
				// snap a block of this row to a near-aligned block above, else keep the edge it hugged
				let found = null;
				for (const pa of [...p.parts].sort((a, b) => b.w - a.w)) {
					for (const kind of ['x0', 'cx', 'x1']) {
						const m = (k: any) => (k === 'x0' ? pa.o.x0 : k === 'x1' ? pa.o.x1 : (pa.o.x0 + pa.o.x1) / 2),
							mine = m(kind);
						const mineNew = kind === 'x0' ? pa.x : kind === 'x1' ? pa.x + pa.w : pa.x + pa.w / 2;
						const hit = cell.find((c) => {
							const v = kind === 'x0' ? c.o.x0 : kind === 'x1' ? c.o.x1 : (c.o.x0 + c.o.x1) / 2;
							return Math.abs(v - mine) <= TOL;
						});
						if (hit) {
							found = (kind === 'x0' ? hit.x : kind === 'x1' ? hit.x + hit.w : hit.x + hit.w / 2) - mineNew;
							break;
						}
					}
					if (found !== null) break;
				}
				if (found === null) {
					const left = r.u.x0 - ext.x0,
						right = ext.x1 - r.u.x1;
					found =
						Math.abs(left) <= TOL
							? 0
							: Math.abs(right) <= TOL
								? W - p.w
								: Math.abs(left - right) <= 2 * TOL
									? (W - p.w) / 2
									: Math.min(Math.max(left, 0), W - p.w);
				}
				off = found;
			}
			for (const q of p.place) place.push({ ...q, x: q.x + off, y: q.y + y });
			for (const pa of p.parts) cell.push({ o: pa.o, x: pa.x + off, w: pa.w });
			y += p.h;
			const next = rows[ri + 1];
			if (next) y += hasLabel(r.items.flatMap(ids), next.items.flatMap(ids)) ? Math.max(GV, 8) : GV;
		});
		return { w: W, h: y, place, parts: [] };
	}

	const root = rootItems();
	if (!root.length) return null;
	const top = planContainer(root, 0),
		o0 = root.map(orig);
	return { top, o0 };
}
