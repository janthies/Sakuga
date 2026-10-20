// @ts-nocheck
import * as coreRoutes from '../../core/layout/route';
import { store } from '../store/store';
import { svg } from '../platform/dom';
import { byId, descendant, fine, layout, nodeAt, resolveAttached, snap, toMm } from '../store/model';
import { render } from '../render/scene';
import { frameTitleGeom, labelTarget, projectLabel } from '../render/labelgeom';
import { edgeInside, fixedUpdate, guides, nodeInside } from './guides';
import { dropAnchor } from './edit';
import { endpointObject, endpointTarget } from '../render/anchors';

export function initToolsPointermove() {
	svg.addEventListener('pointermove', (ev) => {
		const p = toMm(ev);
		if (!store.drag) {
			const h = nodeAt(p, 6);
			const id = h ? h.id : null;
			if (id !== store.hover) {
				store.hover = id;
				render();
			}
			return;
		}
		if (store.drag.pan) {
			store.moved = true;
			store.view.ox = store.drag.ox + ev.clientX - store.drag.sx;
			store.view.oy = store.drag.oy + ev.clientY - store.drag.sy;
		} else if (store.drag.label) {
			const target = labelTarget(store.drag.label),
				p2 = { x: store.drag.point[0] + p.x - store.drag.start.x, y: store.drag.point[1] + p.y - store.drag.start.y };
			let st;
			if (target.g) {
				const base = frameTitleGeom({ ...target.g, labelStyle: {} });
				st = { ...store.drag.orig, dx: fine(p2.x - base.p[0]), dy: fine(p2.y - base.p[1]) };
				for (const pos of ['above-left', 'above-center', 'inside-top-left', 'inside-top-right', 'below-left']) {
					const q = frameTitleGeom({ ...target.g, titlePosition: pos, labelStyle: {} });
					if (Math.hypot(p2.x - q.p[0], p2.y - q.p[1]) < 2) {
						target.g.titlePosition = pos;
						st.dx = 0;
						st.dy = 0;
						break;
					}
				}
			} else st = { ...store.drag.orig, ...projectLabel(target.e, p2, target.text, target.step) };
			if (target.g || store.drag.label.slot === undefined) (target.g || target.e).labelStyle = st;
			else target.e.labels[store.drag.label.slot].style = st;
			store.drag.changed = true;
		} else if (store.drag.move) {
			const free = ev.ctrlKey || ev.metaKey;
			let dx = free ? fine(p.x - store.drag.x) : snap(p.x - store.drag.x),
				dy = free ? fine(p.y - store.drag.y) : snap(p.y - store.drag.y);
			let lockX = false,
				lockY = false;
			if (ev.shiftKey) {
				if (Math.abs(dx) > Math.abs(dy)) {
					dy = 0;
					lockY = true;
				} else {
					dx = 0;
					lockX = true;
				}
			}
			store.drag.guides = [];
			if (!free) {
				const g = guides(store.drag.orig, dx, dy, lockX, lockY);
				dx += g.dx;
				dy += g.dy;
				store.drag.guides = g.lines;
			}
			store.drag.dx = dx;
			store.drag.dy = dy;
			store.drag.target = ev.altKey || store.drag.copy ? null : dropAnchor(p, [...store.drag.orig.keys()]);
			for (const [id, o] of store.drag.orig) {
				const n = byId(id);
				if (n) {
					n.x = store.drag.copy ? o.x : o.x + dx;
					n.y = store.drag.copy ? o.y : o.y + dy;
					if (o.attachment && !store.drag.copy) {
						const parentSelected = [...store.drag.orig.keys()].some((id) => descendant(n.id, id));
						n.attachment = {
							...o.attachment,
							dx: o.attachment.dx + (parentSelected ? 0 : dx),
							dy: o.attachment.dy + (parentSelected ? 0 : dy),
						};
					}
				}
			}
			resolveAttached();
		} else if (store.drag.segment !== undefined) {
			if (!store.drag.changed && Math.hypot(p.x - store.drag.start.x, p.y - store.drag.start.y) < 0.4) return;
			const e = store.edges[store.drag.segment],
				j = store.drag.j;
			let pts = store.drag.pts.map((p) => p.slice());
			const last = pts.length - 2,
				h = Math.abs(pts[j][1] - pts[j + 1][1]) < 0.001;
			if (store.drag.alt) {
				const a = pts[j],
					b = pts[j + 1],
					axis = h ? 0 : 1,
					other = 1 - axis,
					c = a.map((v, k) => v + (b[k] - v) / 3),
					d = a.map((v, k) => v + (2 * (b[k] - v)) / 3),
					cc = c.slice(),
					dd = d.slice();
				cc[other] = dd[other] = h ? p.y : p.x;
				pts.splice(j + 1, 0, c, cc, dd, d);
			} else if (j === 0 || j === last) {
				const end = j === 0 ? 'from' : 'to',
					n = endpointObject(e[end]),
					box = { ...n, ...(n.frame ? {} : layout(n)) },
					side =
						e[end + 'Anchor'] ||
						(h
							? j === 0
								? pts[1][0] > pts[0][0]
									? 'east'
									: 'west'
								: pts.at(-2)[0] > pts.at(-1)[0]
									? 'east'
									: 'west'
							: j === 0
								? pts[1][1] > pts[0][1]
									? 'north'
									: 'south'
								: pts.at(-2)[1] > pts.at(-1)[1]
									? 'north'
									: 'south'),
					off = coreRoutes.snapPort(box, side, p, ev.altKey).offset,
					point = coreRoutes.port(box, side, off),
					axis = h ? 1 : 0;
				if (pts.length === 2) {
					const end = pts[1],
						mid = h ? (point[0] + end[0]) / 2 : (point[1] + end[1]) / 2;
					pts = h ? [point, [mid, point[1]], [mid, end[1]], end] : [point, [point[0], mid], [end[0], mid], end];
				} else {
					pts[j === 0 ? 0 : pts.length - 1] = point;
					pts[j === 0 ? 1 : pts.length - 2][axis] = point[axis];
				}
			} else {
				const axis = h ? 1 : 0;
				pts[j][axis] = pts[j + 1][axis] = fine(h ? p.y : p.x);
			}
			Object.assign(e, fixedUpdate(e, pts));
			store.drag.changed = true;
		} else if (store.drag.endpoint !== undefined) {
			store.drag.x = p.x;
			store.drag.y = p.y;
			store.drag.target = endpointTarget(p, ev.altKey);
		} else if (store.drag.mid !== undefined) {
			// dragging the middle of an arrow: move the middle segment, or bend the line
			const e = store.edges[store.drag.mid],
				a = endpointObject(e.from),
				b = endpointObject(e.to),
				t = store.drag.r.type;
			if (e.from === e.to) {
				const side = e.loopSide || 'north',
					h = /north|south/.test(side),
					sign = /north|east/.test(side) ? 1 : -1,
					n = { ...a, ...layout(a) },
					border = (h ? a.y : a.x) + (sign * (h ? n.h : n.w)) / 2;
				e.loopSize = Math.max(1, Math.abs((h ? p.y : p.x) - border) / 0.75);
				store.drag.changed = true;
				render();
				return;
			}
			if (t === 'hvh') {
				e.route = 'hvh';
				e.mid = snap(p.x);
			} else if (t === 'vhv') {
				e.route = 'vhv';
				e.mid = snap(p.y);
			} else {
				const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
				const nx = -(b.y - a.y) / len,
					ny = (b.x - a.x) / len;
				const off = (p.x - (a.x + b.x) / 2) * nx + (p.y - (a.y + b.y) / 2) * ny;
				const sn = Math.max(-0.95, Math.min(0.95, off / (0.294 * len)));
				e.route = 'bend';
				e.bend = Math.round((Math.asin(sn) * 180) / Math.PI);
			}
			store.drag.changed = true;
		} else if (store.drag.scale) {
			const d = store.drag.scale,
				b = store.drag.b,
				W = b.x1 - b.x0,
				H = b.y1 - b.y0;
			const dx = p.x - store.drag.x,
				dy = p.y - store.drag.y;
			let sx = 1,
				sy = 1,
				ax = b.x0,
				ay = b.y0;
			if (d.includes('e')) {
				sx = (W + dx) / W;
				ax = b.x0;
			}
			if (d.includes('w')) {
				sx = (W - dx) / W;
				ax = b.x1;
			}
			if (d.includes('n')) {
				sy = (H + dy) / H;
				ay = b.y0;
			}
			if (d.includes('s')) {
				sy = (H - dy) / H;
				ay = b.y1;
			}
			if (ev.shiftKey && d.length === 2) {
				sx = sy = Math.max(sx, sy);
			}
			sx = Math.max(0.1, sx);
			sy = Math.max(0.1, sy);
			for (const [id, o] of store.drag.orig) {
				const n = byId(id);
				n.x = ax + (o.x - ax) * sx;
				n.y = ay + (o.y - ay) * sy;
				n.width = Math.max(6, o.width * sx);
				if (o.minh) {
					n.minh = o.minh * sy;
				}
			}
			store.drag.changed = true;
		} else if (store.drag.resize) {
			const n = byId(store.drag.id);
			const dx = snap(p.x - store.drag.x),
				dy = snap(p.y - store.drag.y),
				d = store.drag.resize;
			let w = store.drag.w0,
				h = store.drag.h0,
				x = store.drag.x0,
				y = store.drag.y0;
			if (d.includes('e')) {
				w = Math.max(6, store.drag.w0 + dx);
				x = store.drag.x0 + (w - store.drag.w0) / 2;
			}
			if (d.includes('w')) {
				w = Math.max(6, store.drag.w0 - dx);
				x = store.drag.x0 - (w - store.drag.w0) / 2;
			}
			if (d.includes('n')) {
				h = Math.max(4, store.drag.h0 + dy);
				y = store.drag.y0 + (h - store.drag.h0) / 2;
			}
			if (d.includes('s')) {
				h = Math.max(4, store.drag.h0 - dy);
				y = store.drag.y0 - (h - store.drag.h0) / 2;
			}
			n.width = w;
			n.x = x;
			n.y = y;
			if (d.includes('n') || d.includes('s')) {
				n.minh = h;
			}
			store.drag.changed = true;
		} else if (store.drag.band) {
			store.drag.x1 = p.x;
			store.drag.y1 = p.y;
			const x0 = Math.min(store.drag.x0, store.drag.x1),
				x1 = Math.max(store.drag.x0, store.drag.x1);
			const y0 = Math.min(store.drag.y0, store.drag.y1),
				y1 = Math.max(store.drag.y0, store.drag.y1);
			store.selN = new Set([
				...store.drag.baseN,
				...store.nodes.filter((n) => nodeInside(n, x0, x1, y0, y1)).map((n) => n.id),
			]);
			store.selE = new Set([
				...store.drag.baseE,
				...store.edges.map((e, i) => (edgeInside(e, x0, x1, y0, y1) ? i : -1)).filter((i) => i >= 0),
			]);
		} else if (store.drag.connect) {
			store.drag.x = p.x;
			store.drag.y = p.y;
		}
		render();
	});
}
