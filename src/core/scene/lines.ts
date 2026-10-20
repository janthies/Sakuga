import { lineLabel } from '../geometry/line-geometry';
import type { Env } from './env';
import { prim, styleColor, weight, dash, opacityOf, display } from './style';
import { textPrim } from './nodes';
import { PT } from '../text';
import type { Prim } from './types';

export function linePrims(env: Env): Prim[] {
	return (env.fig.lines || [])
		.filter((l) => !l.hidden)
		.map((l) => {
			const key = 'line:' + l.id,
				alpha = (l.style?.opacity ?? 1) * opacityOf(env.fig.layers, l.layer);
			const kids: Prim[] = [
				prim(
					'line',
					key + ':stroke',
					{
						x1: l.start[0],
						y1: -l.start[1],
						x2: l.end[0],
						y2: -l.end[1],
						stroke: styleColor(l.style?.color, '#808080'),
						'stroke-width': weight(l.style),
						'stroke-dasharray': dash(l.style),
						'pointer-events': 'stroke',
					},
					{ hit: l.locked ? { k: 'locked' } : { k: 'line', id: l.id } },
				),
			];
			for (const [j, label] of (l.labels || []).entries()) {
				if (label.style?.hidden) continue;
				const st = label.style || {},
					{
						p: [x, y],
						pt,
					} = lineLabel(l, label.text, st, env.fig.font);
				label.text.split('\\\\').forEach((s, k, all) =>
					kids.push(
						textPrim(
							key + ':label' + j + ':' + k,
							x,
							y + ((all.length - 1) / 2 - k) * pt * PT * 1.25,
							display(s),
							pt,
							'Sakuga Sans',
							styleColor(st.color || l.style?.color, '#595959'),
							'middle',
							{
								'font-weight': st.bold ? 'bold' : 'normal',
								'font-style': st.italic ? 'italic' : 'normal',
								'pointer-events': 'auto',
							},
						),
					),
				);
			}
			for (const [j, label] of (l.labels || []).entries())
				for (const p of kids.filter((p) => p.key.startsWith(key + ':label' + j + ':')))
					p.hit = { k: 'text', id: label.id || l.id + '-label-' + j, parent: l.id };
			return prim('g', key, { 'fill-opacity': alpha, 'stroke-opacity': alpha }, { children: kids });
		});
}
