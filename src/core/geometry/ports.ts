import type { Figure } from '../model/figure';
import { geometryOf } from './figure-geometry';
import { items } from '../model/tree-queries';

// Ports are fractions in the model and millimetres in the existing router/TikZ shifts.
export function resolvePorts(fig: Figure) {
	const geo = geometryOf(fig);
	for (const i of items(fig))
		if (i.kind === 'Connector') {
			for (const end of ['source', 'target'] as const) {
				const { id, port } = i[end],
					obj = geo.endpoint(id);
				if (!obj || port.side === 'auto') continue;
				// A migrated absolute offset stays absolute until the port is explicitly edited.
				const key = end === 'source' ? 'fromOffset' : 'toOffset';
				if (
					port.position === 0.5 &&
					i.connector[key] !== undefined &&
					!i.connector[end === 'source' ? 'fromPort' : 'toPort']
				)
					continue;
				i.connector[key] = (port.position - 0.5) * (/north|south/.test(port.side) ? obj.w : obj.h);
			}
		}
}
