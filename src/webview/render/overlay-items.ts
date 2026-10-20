import { store } from '../store/store';
import { byId, px, py } from '../store/model';
import { geo } from '../store/geometry';
import { lineLabel } from '../../core/geometry/line-geometry';
import type { Out } from './out';

export function treeSelection(o: Out) {
	for (const id of new Set([...store.selN, ...(store.selG ? [store.selG] : [])])) {
		if (byId(id)) continue;
		const item = store.items.find((i) => i.id === id);
		const line = store.lines.find((l) => l.id === id);
		if (line) {
			o.add('line', {
				x1: px(line.start[0]),
				y1: py(line.start[1]),
				x2: px(line.end[0]),
				y2: py(line.end[1]),
				stroke: 'var(--sel)',
				'stroke-width': 3,
				'stroke-opacity': 0.5,
				'pointer-events': 'none',
			});
			continue;
		}
		const parent = item && store.items.find((i) => i.id === item.parent);
		const label =
			item?.kind === 'Text' && parent?.kind === 'Line'
				? lineLabel(
						store.lines.find((l) => l.id === parent.id)!,
						item.text,
						item.placement,
						store.figureFont,
					)
				: undefined;
		const r =
			item?.kind === 'Frame'
				? geo().frame(id)
				: label
					? { x: label.p[0], y: label.p[1], w: label.w, h: label.h }
					: undefined;
		if (r)
			o.add('rect', {
				x: px(r.x - r.w / 2),
				y: py(r.y + r.h / 2),
				width: r.w * store.view.s,
				height: r.h * store.view.s,
				fill: 'none',
				stroke: 'var(--sel)',
				'stroke-width': 1.5,
				'pointer-events': 'none',
			});
	}
}
