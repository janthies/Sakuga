// @ts-nocheck
import * as coreRoutes from '../../core/layout/route';
import { store } from '../store/store';
import { svg } from '../platform/dom';
import { byId, catOf, nodeAt, post, snap, toMm } from '../store/model';
import { edgeGeom } from '../render/edges';
import { fixedUpdate } from './guides';
import { render } from '../render/scene';
import { startEdgeEdit, startEdit } from './edit';
import { newId } from '../store/layers';
import { contentBox } from '../render/boxes';

// Fit the content (boxes, arrows, frames, legend) into the canvas.
export function fit() {
	const r = svg.getBoundingClientRect(),
		C = contentBox(),
		pad = 40;
	const w = Math.max(1, C.x1 - C.x0),
		h = Math.max(1, C.y1 - C.y0);
	store.view.s = Math.max(1, Math.min(14, (r.width - 2 * pad) / w, (r.height - 2 * pad) / h));
	store.view.ox = r.width / 2 - ((C.x0 + C.x1) / 2) * store.view.s;
	store.view.oy = r.height / 2 + ((C.y0 + C.y1) / 2) * store.view.s;
}

export function initToolsCanvas() {
	svg.addEventListener('dblclick', (ev) => {
		const p = toMm(ev);
		const t = ev.target;
		if (t.dataset.corner !== undefined) {
			const [index, j] = t.dataset.corner.split(':').map(Number),
				e = store.edges[index],
				pts = coreRoutes.removeCorner(edgeGeom(e).pts, j);
			post({ op: 'arrow', index, ...fixedUpdate(e, pts) });
			return;
		}
		if (t.dataset.label) {
			store.selN.label = JSON.parse(t.dataset.label);
			render();
			return;
		}
		if (t.dataset.group || t.classList.contains('locked-node')) {
			return;
		}
		if (t.dataset.edge !== undefined || t.dataset.mid !== undefined) {
			startEdgeEdit(+(t.dataset.edge ?? t.dataset.mid));
			return;
		}
		const n = t.dataset.node ? byId(t.dataset.node) : nodeAt(p);
		if (n) {
			startEdit(n.id);
		} else {
			const id = newId();
			store.pendingEdit = id;
			post({
				op: 'addNode',
				id,
				x: snap(p.x),
				y: snap(p.y),
				title: 'Box',
				cat: catOf(store.lastCat) ? store.lastCat : '',
			});
		}
	});
	svg.addEventListener(
		'wheel',
		(ev) => {
			ev.preventDefault();
			store.moved = true;
			if (ev.ctrlKey) {
				const r = svg.getBoundingClientRect();
				const mx = ev.clientX - r.left,
					my = ev.clientY - r.top;
				const s = Math.min(30, Math.max(1, store.view.s * Math.exp(-ev.deltaY * 0.002)));
				store.view.ox = mx - ((mx - store.view.ox) * s) / store.view.s;
				store.view.oy = my - ((my - store.view.oy) * s) / store.view.s;
				store.view.s = s;
			} else {
				store.view.ox -= ev.deltaX;
				store.view.oy -= ev.deltaY;
			}
			render();
		},
		{ passive: false },
	);
	new ResizeObserver(() => {
		if (!store.fitted) {
			return;
		}
		if (!store.moved) {
			fit();
		}
		render();
	}).observe(document.getElementById('desk'));
}
