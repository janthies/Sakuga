// The legend the TikZ output draws: one swatch per used category, three per column, below the boxes.
import { PT, sizes } from '../text';
import { nodesBox, type Env } from './env';
import { icon } from './shapes';
import { STROKE, display, prim } from './style';
import { catFill, textPrim } from './nodes';
import type { Prim } from './types';

const smallerPt = (pt: number) => ({ 8: 6, 9: 8, 10: 9, 10.95: 10, 12: 10.95 })[pt as 8] || 9;

export function legendPrims(env: Env): Prim[] {
	const used = new Set(env.fig.nodes.map((n) => n.cat));
	const list = env.fig.categories.filter((c) => !!c.legend);
	if (!list.length) return [];
	const b = nodesBox(env);
	const out: Prim[] = [];
	list.forEach((c, i) => {
		const x = b.x0 + Math.floor(i / 3) * 34,
			y = b.y0 - 7 - (i % 3) * 6,
			key = `legend:${c.key}`;
		const kids: Prim[] = c.icon
			? []
			: [
					// 0.2 mm is the hairline the swatch outline had at the default zoom
					prim('rect', `${key}:swatch`, {
						x,
						y: -y,
						width: 3.6,
						height: 3.6,
						rx: PT,
						ry: PT,
						fill: catFill(env, c.key),
						stroke: STROKE,
						'stroke-width': 0.2,
						'pointer-events': 'none',
					}),
				];
		if (c.icon) kids.push(icon(env, `${key}:icon`, c.icon, x, y - 1.8));
		kids.push(
			textPrim(
				`${key}:name`,
				x + 4.6,
				y - 1.8,
				display(c.name),
				smallerPt(sizes[env.fig.font]),
				'Sakuga Sans',
				'#000',
				'start',
			),
		);
		out.push(prim('g', key, {}, { children: kids }));
	});
	return out;
}
