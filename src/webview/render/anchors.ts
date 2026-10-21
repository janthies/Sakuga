import * as coreRoutes from '../../core/layout/route';
import { store } from '../store/store';
import { geo } from '../store/geometry';
import { byId, layout, nodeAt } from '../store/model';
import type { EndpointTarget, Pt } from '../store/types';

export const frameRect = (id: string) => geo().frame(id);
export function endpointObject(id: string) {
	return byId(id) || frameRect(id);
}
export function endpointTarget(p: Pt, disableSnap = false): EndpointTarget | null {
	const n = [...store.nodes]
		.reverse()
		.find(
			(n) =>
				!n.kind &&
				!n.hidden &&
				!n.locked &&
				Math.abs(p.x - n.x) <= layout(n).w / 2 + 2 &&
				Math.abs(p.y - n.y) <= layout(n).h / 2 + 2,
		);
	if (n && n.kind !== 'icon') {
		const { w, h } = layout(n),
			choices: [string, number][] = [
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
	return null;
}
