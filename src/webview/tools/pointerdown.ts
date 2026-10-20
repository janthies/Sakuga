// @ts-nocheck
import { store } from '../store/store';
import { svg } from '../platform/dom';
import { endEdit } from './edit';
import { byId, layout, toMm } from '../store/model';
import { arrowLabelGeom, frameTitleGeom, labelTarget } from '../render/labelgeom';
import { edgeGeom } from '../render/edges';
import { selectLayer } from '../store/layers';
import { selBox } from '../render/svg';
import { render } from '../render/scene';

export function initToolsPointerdown() {
	svg.addEventListener('pointerdown', (ev) => {
		if (store.editing) {
			endEdit(true);
		}
		const p = toMm(ev);
		const t = ev.target;
		const ctrl = ev.ctrlKey || ev.metaKey;
		const additive = ctrl || ev.shiftKey;
		if (!t.dataset.label) delete store.selN.label;
		if (!additive && !ev.target.dataset.resize && !ev.target.dataset.scale) {
			store.keyObject = null;
		}
		if (ev.button !== 1 && !store.space) {
			store.selectedLayers.clear();
		}
		if (ev.button === 1 || store.space) {
			store.drag = { pan: true, sx: ev.clientX, sy: ev.clientY, ox: store.view.ox, oy: store.view.oy };
		} else if (t.dataset.label) {
			const ref = JSON.parse(t.dataset.label);
			store.selN.clear();
			store.selE.clear();
			store.selG = null;
			store.selN.label = ref;
			const target = labelTarget(ref);
			const geom = target.g
				? frameTitleGeom(target.g)
				: arrowLabelGeom(target.e, target.style, target.text, target.step);
			store.drag = { label: ref, orig: { ...target.style }, start: p, point: geom.p };
		} else if (t.classList.contains('locked-node')) {
			return;
		} else if (t.dataset.segment !== undefined) {
			const [index, j] = t.dataset.segment.split(':').map(Number),
				e = store.edges[index],
				pts = edgeGeom(e).pts.map((p) => p.slice());
			store.drag = { segment: index, j, pts, start: p, alt: ev.altKey };
		} else if (t.dataset.endpoint) {
			const [index, end] = t.dataset.endpoint.split(':');
			store.drag = { endpoint: +index, end, x: p.x, y: p.y };
		} else if (t.dataset.mid !== undefined) {
			const i = +t.dataset.mid,
				e = store.edges[i];
			store.drag = { mid: i, orig: { route: e.route, mid: e.mid, bend: e.bend }, r: edgeGeom(e).r };
		} else if (t.dataset.group) {
			selectLayer(t.dataset.group, additive);
			store.selN = new Set([...store.selN].filter((id) => !byId(id).hidden && !byId(id).locked));
			const orig = new Map(
				[...store.selN]
					.filter((id) => !byId(id).hidden && !byId(id).locked)
					.map((id) => [
						id,
						{ x: byId(id).x, y: byId(id).y, attachment: byId(id).attachment && { ...byId(id).attachment } },
					]),
			);
			if (!ctrl && orig.size) {
				store.drag = { move: true, x: p.x, y: p.y, orig, dx: 0, dy: 0, copy: ev.altKey };
			}
		} else if (t.dataset.scale) {
			const ids = [...store.selN].filter((id) => byId(id) && !byId(id).locked && !byId(id).hidden);
			store.drag = {
				scale: t.dataset.scale,
				x: p.x,
				y: p.y,
				b: selBox(ids),
				orig: new Map(
					ids.map((id) => {
						const n = byId(id);
						return [id, { x: n.x, y: n.y, width: n.width, minh: n.minh }];
					}),
				),
			};
		} else if (t.dataset.resize) {
			const [id, dir] = t.dataset.resize.split(':');
			const n = byId(id);
			store.drag = { resize: dir, id, x: p.x, y: p.y, w0: n.width, h0: layout(n).h, x0: n.x, y0: n.y };
		} else if (t.dataset.handle) {
			store.drag = {
				connect: t.dataset.handle,
				x: p.x,
				y: p.y,
				startX: p.x,
				startY: p.y,
				startAnchor: (() => {
					const n = byId(t.dataset.handle),
						d = [p.x - n.x, p.y - n.y];
					return Math.abs(d[0]) > Math.abs(d[1]) ? (d[0] > 0 ? 'east' : 'west') : d[1] > 0 ? 'north' : 'south';
				})(),
			};
		} else if (t.dataset.node) {
			const id = t.dataset.node;
			store.selG = null;
			if (additive) {
				if (store.selN.has(id) && !ev.shiftKey) {
					store.selN.delete(id);
					store.keyObject = null;
				} else {
					store.selN.add(id);
					store.keyObject = id;
				}
			} else if (!store.selN.has(id)) {
				store.selN = new Set([id]);
				store.selE = new Set();
			}
			if (!ctrl) {
				store.lastCat = byId(id).cat;
				const orig = new Map(
					[...store.selN]
						.filter((id) => !byId(id).locked && !byId(id).hidden)
						.map((k) => [
							k,
							{ x: byId(k).x, y: byId(k).y, attachment: byId(k).attachment && { ...byId(k).attachment } },
						]),
				);
				store.drag = { move: true, x: p.x, y: p.y, orig, dx: 0, dy: 0, copy: ev.altKey };
			}
		} else if (t.dataset.edge !== undefined) {
			store.selG = null;
			const i = +t.dataset.edge;
			if (!ctrl) {
				const G = edgeGeom(store.edges[i]);
				if (G && !G.curve && G.pts.every((p, j) => !j || p[0] === G.pts[j - 1][0] || p[1] === G.pts[j - 1][1])) {
					let best = Infinity,
						j = 0;
					for (let k = 0; k < G.pts.length - 1; k++) {
						const a = G.pts[k],
							b = G.pts[k + 1],
							x = Math.max(Math.min(a[0], b[0]), Math.min(Math.max(a[0], b[0]), p.x)),
							y = Math.max(Math.min(a[1], b[1]), Math.min(Math.max(a[1], b[1]), p.y)),
							d = Math.hypot(p.x - x, p.y - y);
						if (d < best) {
							best = d;
							j = k;
						}
					}
					store.drag = { segment: i, j, pts: G.pts.map((p) => p.slice()), start: p, alt: ev.altKey };
				}
			}
			if (ctrl) {
				if (store.selE.has(i)) {
					store.selE.delete(i);
				} else {
					store.selE.add(i);
				}
			} else {
				store.selN = new Set();
				store.selE = new Set([i]);
			}
		} else {
			store.selG = null;
			if (!ctrl) {
				store.selN = new Set();
				store.selE = new Set();
			}
			store.drag = {
				band: true,
				x0: p.x,
				y0: p.y,
				x1: p.x,
				y1: p.y,
				baseN: new Set(store.selN),
				baseE: new Set(store.selE),
			};
		}
		if (store.drag) {
			svg.setPointerCapture(ev.pointerId);
		}
		render();
	});
}
