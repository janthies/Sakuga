// @ts-nocheck
import * as coreRoutes from '../../core/layout/route';
import { store } from '../store/store';
import { geo } from '../store/geometry';
import { byId, layout, nodeAt } from '../store/model';

export const frameRect = (id) => geo().frame(id);
export function endpointObject(id) {
	return byId(id) || frameRect(id);
}
export function endpointTarget(p, disableSnap = false) {
	const n = nodeAt(p, 2);
	if (n && n.kind !== 'icon') {
		const { w, h } = layout(n),
			choices = [
				['west', Math.abs(p.x - (n.x - w / 2))],
				['east', Math.abs(p.x - (n.x + w / 2))],
				['north', Math.abs(p.y - (n.y + h / 2))],
				['south', Math.abs(p.y - (n.y - h / 2))],
			];
		const anchor = choices.sort((a, b) => a[1] - b[1])[0][0];
		return {
			id: n.id,
			anchor,
			...coreRoutes.snapPort({ ...n, w, h }, anchor, p, disableSnap),
		};
	}
	if (typeof store.groups === 'undefined') return null;
	let best = null;
	for (const g of store.groups.filter((g) => g.frame !== 'none')) {
		const b = frameRect(g.id);
		if (!b) continue;
		const choices = [
			['west', Math.abs(p.x - (b.x - b.w / 2)), Math.abs(p.y - b.y) <= b.h / 2 + 2],
			['east', Math.abs(p.x - (b.x + b.w / 2)), Math.abs(p.y - b.y) <= b.h / 2 + 2],
			['north', Math.abs(p.y - (b.y + b.h / 2)), Math.abs(p.x - b.x) <= b.w / 2 + 2],
			['south', Math.abs(p.y - (b.y - b.h / 2)), Math.abs(p.x - b.x) <= b.w / 2 + 2],
		];
		for (const [anchor, d, inside] of choices)
			if (inside && d < 2 && (!best || d < best.d)) best = { id: g.id, anchor, d };
	}
	return best;
}
