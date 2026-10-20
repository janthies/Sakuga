// @ts-nocheck
import { store } from '../../store/store';
import { descendant, fine, isBox, layout, paintOrder } from '../../store/model';
import { ANCHORS } from '../../store/constants';
import { frameTitleGeom, labelPoint, projectLabel } from '../../render/labelgeom';
import { baseEdgeGeom } from '../../render/geometry';
import { frameRect } from '../../render/anchors';

// The box under the pointer that a dragged box would attach to, and the ninth of it (anchor) the pointer is in.
export function dropAnchor(p, ids) {
	const parent = paintOrder()
		.reverse()
		.find(
			(n) =>
				isBox(n) &&
				!n.hidden &&
				!n.locked &&
				!ids.includes(n.id) &&
				!ids.some((id) => descendant(n.id, id)) &&
				Math.abs(p.x - n.x) <= layout(n).w / 2 &&
				Math.abs(p.y - n.y) <= layout(n).h / 2,
		);
	if (!parent) {
		return null;
	}
	const { w, h } = layout(parent),
		col = Math.max(0, Math.min(2, Math.floor(((p.x - parent.x + w / 2) / w) * 3))),
		row = Math.max(0, Math.min(2, Math.floor(((parent.y + h / 2 - p.y) / h) * 3)));
	return { parent, anchor: ANCHORS[row * 3 + col] };
}
// A label box dropped on an arrow or on a frame's top edge becomes the label of that arrow or frame.
export function labelDrop(p, n) {
	if (n.kind !== 'label') return null;
	for (let i = store.edges.length - 1; i >= 0; i--) {
		const st = projectLabel(store.edges[i], p),
			a = labelPoint(baseEdgeGeom({ ...store.edges[i], labelStyle: st }), st);
		if (Math.hypot(a[0] - p.x, a[1] - p.y) < 3) return { index: i, style: st };
	}
	for (const g of typeof store.groups === 'undefined' ? [] : store.groups) {
		const b = frameRect(g.id);
		if (b && Math.abs(p.x - b.x) < b.w / 2 + 3 && Math.abs(p.y - b.y - b.h / 2) < 3) {
			const G = frameTitleGeom(g);
			return { group: g.id, style: { dx: fine(p.x - G.p[0]), dy: fine(p.y - G.p[1]) } };
		}
	}
	return null;
}
