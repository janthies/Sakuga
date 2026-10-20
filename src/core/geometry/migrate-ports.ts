import type { Figure } from '../model/figure';
import { geometryOf } from './figure-geometry';
import { items } from '../model/tree-queries';
export function migratePorts(fig: Figure) {
	const geo = geometryOf(fig);
	for (const i of items(fig))
		if (i.kind === 'Connector')
			for (const end of ['source', 'target'] as const) {
				const offset = i.connector[end === 'source' ? 'fromOffset' : 'toOffset'];

				const p = i[end].port,
					obj = geo.endpoint(i[end].id);
				if (!obj) continue;
				const span = /north|south/.test(p.side) ? obj.w : obj.h;
				let distance = offset;
				if (distance === undefined && p.side !== 'auto') {
					const g = geo.base(i.connector),
						points = g?.curve || g?.pts;
					const pt = end === 'source' ? points?.[0] : points?.at(-1);
					if (pt) distance = /north|south/.test(p.side) ? pt[0] - obj.x : pt[1] - obj.y;
				}
				if (span && distance !== undefined) p.position = Math.max(0, Math.min(1, 0.5 + distance / span));
			}
}
