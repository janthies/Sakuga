// Bounding-box translation and equal-gap accumulation adapted from Excalidraw's
// packages/element/src/{align,distribute}.ts (MIT). See sketch.LICENSE.txt.
// Sakuga uses centre coordinates in mm, y upwards, and emits existing operations.
(function (root) {
	'use strict';
	const bounds = (ns, layout) => {
		const bs = ns.map((n) => {
			const { w, h } = layout(n);
			return { x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - h / 2, y1: n.y + h / 2 };
		});
		return {
			x0: Math.min(...bs.map((b) => b.x0)),
			x1: Math.max(...bs.map((b) => b.x1)),
			y0: Math.min(...bs.map((b) => b.y0)),
			y1: Math.max(...bs.map((b) => b.y1)),
		};
	};
	function units(nodes, groups, ids, layout) {
		const selected = new Set(ids),
			used = new Set(),
			result = [];
		const inside = (n, id) => {
			let p = n.group;
			const seen = new Set();
			while (p && !seen.has(p)) {
				if (p === id) return true;
				seen.add(p);
				p = groups.find((g) => g.id === p)?.parent;
			}
			return false;
		};
		// Collapse wholly selected groups, outermost first, so members remain rigid.
		const depth = (g) => {
			let d = 0,
				p = g.parent;
			const seen = new Set();
			while (p && !seen.has(p)) {
				seen.add(p);
				d++;
				p = groups.find((g) => g.id === p)?.parent;
			}
			return d;
		};
		const add = (ns) => {
			ns.forEach((n) => used.add(n.id));
			if (ns.every((n) => !n.hidden && !n.locked)) result.push({ ns, b: bounds(ns, layout) });
		};
		for (const g of [...groups].sort((a, b) => depth(a) - depth(b))) {
			const ns = nodes.filter((n) => inside(n, g.id));
			if (ns.length && ns.every((n) => selected.has(n.id) && !used.has(n.id))) add(ns);
		}
		for (const n of nodes) if (selected.has(n.id) && !used.has(n.id)) add([n]);
		return result;
	}
	function arrange(nodes, groups, ids, key, command, layout) {
		const us = units(nodes, groups, ids, layout),
			ops = [];
		if (us.length < 2) return { op: 'batch', ops };
		const move = (u, axis, delta) => {
			if (Math.abs(delta) < 1e-8) return;
			for (const n of u.ns)
				ops.push({ op: 'move', id: n.id, x: n.x + (axis === 'x' ? delta : 0), y: n.y + (axis === 'y' ? delta : 0) });
		};
		const ref = us.find((u) => u.ns.some((n) => n.id === key));
		const b = ref
			? ref.b
			: bounds(
					us.flatMap((u) => u.ns),
					layout,
				);
		if (command.startsWith('distribute')) {
			const axis = command.endsWith('X') ? 'x' : 'y',
				lo = axis + '0',
				hi = axis + '1';
			us.sort((a, b) => a.b[lo] + a.b[hi] - (b.b[lo] + b.b[hi]));
			const extent = us.reduce((s, u) => s + u.b[hi] - u.b[lo], 0);
			const all = bounds(
					us.flatMap((u) => u.ns),
					layout,
				),
				gap = (all[hi] - all[lo] - extent) / (us.length - 1);
			let pos = all[lo];
			// Keep equal edge gaps even when negative (overlap), rather than switching to centres.
			for (const u of us) {
				move(u, axis, pos - u.b[lo]);
				pos += u.b[hi] - u.b[lo] + gap;
			}
		} else {
			const [axis, position] = {
				left: ['x', 0],
				centerX: ['x', 0.5],
				right: ['x', 1],
				bottom: ['y', 0],
				centerY: ['y', 0.5],
				top: ['y', 1],
			}[command];
			const at = (box) => box[axis + '0'] + (box[axis + '1'] - box[axis + '0']) * position;
			for (const u of us) move(u, axis, at(b) - at(u.b));
		}
		return { op: 'batch', ops };
	}
	function sameSize(nodes, ids, key, axis, layout) {
		const ns = nodes.filter((n) => ids.includes(n.id) && !n.hidden && !n.locked),
			prop = axis === 'w' ? 'width' : 'minh';
		const target = ns.find((n) => n.id === key),
			size = target ? layout(target)[axis] : Math.max(...ns.map((n) => layout(n)[axis]));
		const ops = [];
		for (const n of ns) {
			if (n === target) continue;
			// Invert the existing rendered geometry, including padding and shape expansion.
			let lo = 0,
				hi = Math.max(size * 2, n[prop] || 0, 1);
			if (layout({ ...n, [prop]: lo })[axis] > size + 1e-6) continue; // intrinsic text/shape minimum
			for (let i = 0; i < 50; i++) {
				const mid = (lo + hi) / 2;
				if (layout({ ...n, [prop]: mid })[axis] < size) lo = mid;
				else hi = mid;
			}
			ops.push({ op: 'node', id: n.id, [prop]: (lo + hi) / 2 });
		}
		return { op: 'batch', ops };
	}
	function typicalGap(nodes, layout) {
		const boxes = nodes.filter((n) => !n.kind && !n.hidden),
			gaps = [];
		for (const a of boxes)
			for (const axis of ['x', 'y']) {
				const other = axis === 'x' ? 'y' : 'x',
					size = axis === 'x' ? 'w' : 'h',
					cross = axis === 'x' ? 'h' : 'w',
					la = layout(a);
				const candidates = boxes
					.filter(
						(b) => b !== a && b[axis] > a[axis] && Math.abs(b[other] - a[other]) < (la[cross] + layout(b)[cross]) / 2,
					)
					.map((b) => b[axis] - a[axis] - (la[size] + layout(b)[size]) / 2)
					.filter((g) => g >= 0);
				if (candidates.length) gaps.push(Math.min(...candidates));
			}
		gaps.sort((a, b) => a - b);
		const m = Math.floor(gaps.length / 2);
		return gaps.length ? (gaps.length % 2 ? gaps[m] : (gaps[m - 1] + gaps[m]) / 2) : 8;
	}
	function nextBox(nodes, edges, source, id, below, layout) {
		const incoming = [...edges].reverse().find((e) => e.to === source.id),
			prev = incoming && nodes.find((n) => n.id === incoming.from);
		let dx = 1,
			dy = 0;
		if (below) {
			dx = 0;
			dy = -1;
		} else if (prev) {
			const x = source.x - prev.x,
				y = source.y - prev.y;
			if (Math.abs(y) > Math.abs(x)) {
				dx = 0;
				dy = Math.sign(y) || -1;
			} else {
				dx = Math.sign(x) || 1;
			}
		}
		const gap = typicalGap(nodes, layout),
			n = {
				...source,
				id,
				width: source.wantWidth ?? source.width,
				wantWidth: undefined,
				title: '',
				code: '',
				group: '',
				attachment: undefined,
				extra: [...source.extra],
				style: { ...source.style },
			},
			a = layout(source),
			b = layout(n);
		n.x = source.x + dx * ((a.w + b.w) / 2 + gap);
		n.y = source.y + dy * ((a.h + b.h) / 2 + gap);
		// Advance past every overlapping object; each pass strictly advances along the ray.
		for (let i = 0; i <= nodes.length; i++) {
			const hit = nodes.find(
				(o) =>
					!o.hidden &&
					Math.abs(n.x - o.x) < (b.w + layout(o).w) / 2 - 1e-7 &&
					Math.abs(n.y - o.y) < (b.h + layout(o).h) / 2 - 1e-7,
			);
			if (!hit) break;
			const h = layout(hit);
			if (dx) n.x = hit.x + dx * ((h.w + b.w) / 2 + gap);
			else n.y = hit.y + dy * ((h.h + b.h) / 2 + gap);
		}
		const { codeFont, titlePosition, style, extra, layer, x, y, cat, icon, iconPosition, width, minh } = n;
		return {
			node: n,
			edge: {
				from: source.id,
				to: id,
				kind: 'arr',
				route: 'auto',
				mid: null,
				bend: 0,
				head: 'end',
				label: '',
				extra: [],
			},
			batch: {
				op: 'batch',
				ops: [
					{
						op: 'addNode',
						id,
						title: '',
						codeFont,
						titlePosition,
						style,
						extra,
						layer,
						x,
						y,
						cat,
						icon,
						iconPosition,
						width,
						minh,
						from: source.id,
					},
				],
			},
		};
	}

	// XY-cut / gap normalization / justification, ported from the measured tidy prototype.
	function tidy(nodes, groups, edges, selected, layout) {
		const PT = 25.4 / 72.27,
			TOL = 1.5,
			SPAN = 0.85,
			EXTRA = 2.2675;
		const PTS = { tiny: 6, scriptsize: 8, footnotesize: 9, small: 10, normalsize: 10.95, large: 12 };
		const SEL = new Set(selected),
			SELECT = selected.join(','),
			GROUPS = groups,
			EDGES = edges;
		const plain = (n) => !n.kind && (!n.style?.shape || ['rectangle', 'pill'].includes(n.style.shape));
		const NODES = nodes.filter((n) => !n.hidden && (!(n.kind === 'label' || n.kind === 'icon') || SEL.has(n.id)));
		const median = (a) => {
			a = a.slice().sort((x, y) => x - y);
			return a.length ? a[a.length >> 1] : NaN;
		};
		const log = [];
		const wantWidth = (n) => n.width;
		const size = (n, width) => {
			const s = layout({ ...n, width, wantWidth: width });
			return { ...s, fixed: !plain(n) };
		};
		// ---- tree of blocks (nodes and frames); y points down inside the planner ----
		const padOf = (g) =>
			g.frame === 'none' ? 0 : g.padding || (g.frame === 'dashed' ? 2.8 : g.frame === 'dotted' ? 1.8 : 3);
		function members(gid) {
			const items = [];
			for (const n of NODES) if (n.group === gid && !n.locked) items.push({ type: 'node', n });
			for (const g of GROUPS)
				if (g.parent === gid) {
					const sub = members(g.id);
					if (!sub.length) continue;
					if (g.frame === 'none') items.push(...sub);
					else items.push({ type: 'group', g, items: sub });
				}
			return items;
		}
		const titleExtra = (g) => {
			const p = g.titlePosition || 'legacy';
			if (!g.name) return [0, 0];
			const e = (PTS[g.titleFont || 'scriptsize'] + 3) * PT;
			return p.startsWith('above') ? [e, 0] : p === 'below-left' ? [0, e] : [0, 0];
		};
		const topPad = (g) => padOf(g) + ((g.titlePosition || '').startsWith('inside') ? 5 : 0);
		const ids = (it) => (it.type === 'node' ? [it.n.id] : [it.g.id, ...it.items.flatMap(ids)]);
		function orig(it) {
			if (it.type === 'node') {
				const s = size(it.n, it.n.wantWidth ?? it.n.width);
				return { x0: it.n.x - s.w / 2, x1: it.n.x + s.w / 2, y0: -it.n.y - s.h / 2, y1: -it.n.y + s.h / 2 };
			}
			const rs = it.items.map(orig),
				[a, b] = titleExtra(it.g),
				p = padOf(it.g);
			return {
				x0: Math.min(...rs.map((r) => r.x0)) - p,
				x1: Math.max(...rs.map((r) => r.x1)) + p,
				y0: Math.min(...rs.map((r) => r.y0)) - topPad(it.g) - a,
				y1: Math.max(...rs.map((r) => r.y1)) + p + b,
			};
		}
		// ---- XY cut: bands = blocks connected by vertical overlap, columns = connected by horizontal overlap ----
		function cut(items, O, a0, a1) {
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
		const rects = (items) => new Map(items.map((it) => [it, orig(it)]));
		const union = (items, O) => ({
			x0: Math.min(...items.map((i) => O.get(i).x0)),
			x1: Math.max(...items.map((i) => O.get(i).x1)),
			y0: Math.min(...items.map((i) => O.get(i).y0)),
			y1: Math.max(...items.map((i) => O.get(i).y1)),
		});
		// dominant gaps of the figure (median of the existing positive gaps, never below a visible arrow length)
		const gv = [],
			gh = [];
		(function stats(items) {
			if (items.length < 2) {
				items.forEach((it) => it.type === 'group' && stats(it.items));
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
			items.forEach((it) => it.type === 'group' && stats(it.items));
		})(members(''));
		const keep = (a) => a.filter((g) => g > 0.2 && g < 15);
		const GMIN = 4;
		const GV = Math.max(GMIN, median(keep(gv)) || GMIN),
			GH = Math.max(GMIN, median(keep(gh)) || GMIN);

		function rootItems() {
			if (!SELECT) return members('');
			const sel = new Set(SELECT.split(','));
			const inGroup = (n, gid) => {
				for (let p = n.group; p; p = GROUPS.find((g) => g.id === p)?.parent) if (p === gid) return true;
				return false;
			};
			const out = [],
				used = new Set();
			const all = (function collect(items) {
				return items.flatMap((it) => (it.type === 'node' ? [it] : [it, ...collect(it.items)]));
			})(members(''));
			for (const it of all.filter((i) => i.type === 'group')) {
				const nodes = NODES.filter((n) => inGroup(n, it.g.id));
				if (nodes.length && nodes.every((n) => sel.has(n.id) && !used.has(n.id))) {
					out.push(it);
					nodes.forEach((n) => used.add(n.id));
				}
			}
			for (const it of all.filter((i) => i.type === 'node'))
				if (sel.has(it.n.id) && !used.has(it.n.id)) {
					out.push(it);
					used.add(it.n.id);
				}
			return out;
		}

		// ---- planner: returns {w, h, place:[{id,x,y,w,h,width,minh}]} relative to the top-left corner ----
		function natural(it, forcedW) {
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
			const inner = planContainer(it.items, forcedW ? forcedW - 2 * p : 0);
			return {
				w: inner.w + 2 * p,
				h: inner.h + top + p + a + b,
				place: inner.place.map((q) => ({ ...q, x: q.x + p, y: q.y + top + a })),
			};
		}
		const hasLabel = (A, B) =>
			EDGES.some(
				(e) =>
					(e.label || e.labels?.length) &&
					((A.includes(e.from) && B.includes(e.to)) || (B.includes(e.from) && A.includes(e.to))),
			);
		const resizable = (it) => it.type === 'group' || plain(it.n);
		// one row of blocks (columns side by side); every column may itself be a stack
		function planRow(items, forcedW) {
			const O = rects(items),
				cols = cut(items, O, 'x0', 'x1');
			if (cols.length === 1) {
				if (items.length === 1) {
					const b = natural(items[0], forcedW);
					return { ...b, parts: [{ o: O.get(items[0]), x: 0, w: b.w }] };
				}
				const u = union(items, O),
					place = []; // overlapping blocks: keep as drawn
				for (const it of items) {
					const b = natural(it, 0),
						o = O.get(it);
					for (const q of b.place) place.push({ ...q, x: q.x + o.x0 - u.x0, y: q.y + o.y0 - u.y0 });
				}
				log.push('rigid: ' + items.map((i) => ids(i)[0]).join(','));
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
				place = [],
				parts = [];
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
		function planContainer(items, forcedW) {
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
			const place = [],
				cell = [];
			let y = 0;
			rows.forEach((r, ri) => {
				const p = r.just ? planRow(r.items, W) : r.p0;
				let off = 0;
				if (!r.just) {
					// snap a block of this row to a near-aligned block above, else keep the edge it hugged
					let found = null;
					for (const pa of [...p.parts].sort((a, b) => b.w - a.w)) {
						for (const kind of ['x0', 'cx', 'x1']) {
							const m = (k) => (k === 'x0' ? pa.o.x0 : k === 'x1' ? pa.o.x1 : (pa.o.x0 + pa.o.x1) / 2),
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
		if (!root.length) return { op: 'batch', ops: [] };
		const top = planContainer(root, 0),
			o0 = root.map(orig);
		const L = Math.min(...o0.map((r) => r.x0)),
			R = Math.max(...o0.map((r) => r.x1)),
			T = Math.min(...o0.map((r) => r.y0)),
			B = Math.max(...o0.map((r) => r.y1));
		// Anchor the left/top edges: any growth is pushed right/down into neighbouring space.
		const X0 = L,
			Y0 = T,
			ops = [],
			byId = new Map(nodes.map((n) => [n.id, n])),
			tidied = new Set(top.place.map((q) => q.id));
		const r2 = (v) => Math.round(v * 100) / 100;
		for (const q of top.place) {
			const n = byId.get(q.id),
				x = X0 + q.x + q.w / 2,
				y = -(Y0 + q.y + q.h / 2);
			if (Math.abs(x - n.x) > 0.005 || Math.abs(y - n.y) > 0.005)
				ops.push({ op: 'move', id: n.id, x: r2(x), y: r2(y) });
			const o = { op: 'node', id: n.id };
			if (q.width !== undefined && Math.abs(q.width - n.width) > 0.005) o.width = r2(q.width);
			if (q.minh !== undefined && Math.abs(q.minh - (n.minh || 0)) > 0.005) o.minh = r2(q.minh);
			if (Object.keys(o).length > 2) ops.push(o);
		}
		// Grow the surrounding frames as well as the selection, and preserve clearance to
		// unselected siblings (including free labels/icons). A selected descendant counts
		// as growth of each containing frame. Side-by-side columns retain their own rows.
		const moved = nodes.map((n) => {
			const m = ops.find((o) => o.op === 'move' && o.id === n.id),
				z = ops.find((o) => o.op === 'node' && o.id === n.id);
			return { ...n, ...z, ...m };
		});
		const obstacles = [];
		const nodeRect = (n) => {
			const s = layout(n);
			return { x0: n.x - s.w / 2, x1: n.x + s.w / 2, y0: -n.y - s.h / 2, y1: -n.y + s.h / 2 };
		};
		obstacles.push({ old: { x0: L, x1: R, y0: T, y1: B }, now: { x0: L, x1: L + top.w, y0: T, y1: T + top.h } });
		const Routes = typeof module === 'object' && module.exports ? require('./routes.js') : globalThis.SakugaRoutes;
		const groupRect = (g, ns) => {
			const b = Routes.bounds(
				g.id,
				ns.map((n) => ({ ...n, ...layout(n) })),
				groups,
				new Set(),
				edges,
			);
			return b && { x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: -b.y - b.h / 2, y1: -b.y + b.h / 2 };
		};
		const contains = (g, id) => {
			let n = byId.get(id),
				p = n?.group;
			const seen = new Set();
			while (p && !seen.has(p)) {
				if (p === g.id) return true;
				seen.add(p);
				p = groups.find((g) => g.id === p)?.parent;
			}
			return false;
		};
		for (const g of groups)
			if ([...tidied].some((id) => contains(g, id))) {
				const old = groupRect(g, nodes),
					now = groupRect(g, moved);
				if (old && now) obstacles.push({ old, now, g });
			}
		for (const n of nodes) {
			if (tidied.has(n.id) || n.hidden || n.locked) continue;
			const b = nodeRect(n);
			let dx = 0,
				dy = 0;
			for (const ob of obstacles) {
				if (ob.g && contains(ob.g, n.id)) continue;
				const xOverlap = b.x0 < ob.now.x1 && b.x1 > ob.now.x0,
					yOverlap = b.y0 < ob.now.y1 && b.y1 > ob.now.y0;
				if (b.y0 >= ob.old.y1 - 0.1 && xOverlap) dy = Math.max(dy, ob.now.y1 - ob.old.y1);
				if (b.x0 >= ob.old.x1 - 0.1 && yOverlap) dx = Math.max(dx, ob.now.x1 - ob.old.x1);
			}
			if (dx > 0.005 || dy > 0.005) ops.push({ op: 'move', id: n.id, x: r2(n.x + dx), y: r2(n.y - dy) });
		}
		// Push complete unselected frames rigidly, then propagate pushes through chains
		// of neighbours. This keeps their original positive clearance, including labels.
		const shifts = new Map(
			ops
				.filter((o) => o.op === 'move' && !tidied.has(o.id))
				.map((o) => [o.id, [o.x - byId.get(o.id).x, byId.get(o.id).y - o.y]]),
		);
		for (let pass = 0; pass < nodes.length; pass++) {
			let changed = false;
			for (const g of groups) {
				const ns = nodes.filter((n) => contains(g, n.id));
				if (!ns.length || ns.some((n) => tidied.has(n.id) || n.locked || n.hidden)) continue;
				const dx = Math.max(0, ...ns.map((n) => shifts.get(n.id)?.[0] || 0)),
					dy = Math.max(0, ...ns.map((n) => shifts.get(n.id)?.[1] || 0));
				for (const n of ns)
					if (dx > (shifts.get(n.id)?.[0] || 0) + 0.005 || dy > (shifts.get(n.id)?.[1] || 0) + 0.005) {
						shifts.set(n.id, [dx, dy]);
						changed = true;
					}
			}
			for (const a of nodes) {
				const d = shifts.get(a.id);
				if (!d) continue;
				const A = nodeRect(a);
				for (const n of nodes) {
					if (n === a || tidied.has(n.id) || n.hidden || n.locked) continue;
					const b = nodeRect(n),
						v = shifts.get(n.id) || [0, 0];
					let [dx, dy] = v;
					if (d[0] > 0 && b.x0 >= A.x1 - 0.1 && b.y0 < A.y1 && b.y1 > A.y0) dx = Math.max(dx, d[0]);
					if (d[1] > 0 && b.y0 >= A.y1 - 0.1 && b.x0 < A.x1 && b.x1 > A.x0) dy = Math.max(dy, d[1]);
					if (dx > v[0] + 0.005 || dy > v[1] + 0.005) {
						shifts.set(n.id, [dx, dy]);
						changed = true;
					}
				}
			}
			if (!changed) break;
		}
		for (const [id, [dx, dy]] of shifts) {
			const n = byId.get(id),
				o = ops.find((o) => o.op === 'move' && o.id === id);
			const move = { op: 'move', id, x: r2(n.x + dx), y: r2(n.y - dy) };
			if (o) Object.assign(o, move);
			else ops.push(move);
		}
		const objects = (ns) => [
			...ns.map((n) => ({ ...n, ...layout(n) })),
			...groups
				.map((g) =>
					Routes.bounds(
						g.id,
						ns.map((n) => ({ ...n, ...layout(n) })),
						groups,
						new Set(),
						edges,
					),
				)
				.filter(Boolean),
		];
		const after = nodes.map((n) => ({
			...n,
			...ops.find((o) => o.op === 'node' && o.id === n.id),
			...ops.find((o) => o.op === 'move' && o.id === n.id),
		}));
		ops.push(...Routes.reanchor(edges, objects(nodes), objects(after)));
		return { op: 'batch', ops };
	}

	const api = { bounds, units, arrange, sameSize, typicalGap, nextBox, tidy };
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SakugaSketch = api;
})(typeof globalThis === 'object' ? globalThis : this);
