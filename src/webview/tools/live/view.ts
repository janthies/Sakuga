// @ts-nocheck
import { store } from '../../store/store';
import { svg } from '../../platform/dom';
import { contentBox } from '../../render/boxes';

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
