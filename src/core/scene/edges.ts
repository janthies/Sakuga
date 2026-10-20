// Arrows with their tips, hit paths and attached labels.
import { PT } from '../text';
import type { FigEdge } from '../model/figure';
import type { Env } from './env';
import { edgePath, tip } from './shapes';
import { ARROW, ARROW_DASHED, dash, display, n4, opacityOf, prim, styleColor, weight } from './style';
import { textPrim } from './nodes';
import type { Prim } from './types';

export function edgePrims(env: Env): Prim[] {
	const out: Prim[] = [];
	env.fig.edges.forEach((e, i) => {
		const p = edgePrim(env, e, i);
		if (p) out.push(p);
	});
	return out;
}

function edgePrim(env: Env, e: FigEdge, i: number): Prim | null {
	const G = env.edgeGeom(e);
	if (!G) return null;
	const key = `e:${i}`,
		ref = { k: 'edge', index: i } as const;
	const alpha = (e.style?.opacity ?? 1) * opacityOf(env.fig.layers, env.byId(e.from)?.layer);
	const color =
		e.style?.border === 'none' ? 'none' : styleColor(e.style?.color, e.kind === 'arr-dashed' ? ARROW_DASHED : ARROW);
	const kids: Prim[] = [];
	if (env.opts.haloEdges?.includes(i)) {
		kids.push(
			prim('path', `${key}:halo`, {
				d: edgePath(G),
				fill: 'none',
				stroke: 'var(--sel)',
				'stroke-width': 5,
				'vector-effect': 'non-scaling-stroke',
				'stroke-opacity': 0.35,
			}),
		);
	}
	// the line stops inside the tip, as in TikZ
	const pts: number[][] = (G.curve || G.pts).map((p: number[]) => [...p]);
	const last = pts.length - 1;
	if ((e.style?.end || (e.head === 'none' ? 'none' : 'Latex')) !== 'none') {
		const t = tip(`${key}:end`, pts[last], pts[last - 1], color, e.style?.end, e.style);
		kids.push(...t.prims);
		pts[last] = t.end;
	}
	if ((e.style?.start || (e.head === 'both' ? 'Latex' : 'none')) !== 'none') {
		const t = tip(`${key}:start`, pts[0], pts[1], color, e.style?.start, e.style);
		kids.push(...t.prims);
		pts[0] = t.end;
	}
	kids.push(
		prim('path', `${key}:line`, {
			d: edgePath(G.curve ? { curve: pts } : { pts }),
			fill: 'none',
			stroke: color,
			'stroke-width': weight(e.style),
			'stroke-linejoin': 'round',
			'stroke-dasharray': e.style?.border
				? dash(e.style)
				: e.kind === 'arr-dashed'
					? `${n4(1.4 * PT)} ${n4(1.4 * PT)}`
					: 'none',
		}),
	);
	if (G.blocked)
		kids.push(
			prim('path', `${key}:blocked`, {
				d: edgePath(G),
				fill: 'none',
				stroke: '#d33',
				'stroke-width': 2,
				'vector-effect': 'non-scaling-stroke',
				'stroke-dasharray': '5 4',
				'pointer-events': 'none',
			}),
		);
	kids.push(
		prim(
			'path',
			`${key}:hit`,
			{
				d: edgePath(G),
				fill: 'none',
				stroke: 'transparent',
				'stroke-width': 10,
				'vector-effect': 'non-scaling-stroke',
				class: 'hit',
			},
			{ hit: { k: 'edge', index: i } },
		),
	);
	kids.push(...labels(env, e, i, key, color));
	return prim('g', key, { 'fill-opacity': alpha, 'stroke-opacity': alpha }, { ref, children: kids });
}

function labels(env: Env, e: FigEdge, i: number, key: string, _color: string): Prim[] {
	const out: Prim[] = [];
	const all: [number | undefined, string, any, number][] = [
		[undefined, e.label, e.labelStyle || {}, e.style?.step ? 4.4 : 0],
		...(e.labels || []).map((l, j) => [j, l.text, l.style || {}, 0] as [number, string, any, number]),
	];
	for (const [slot, content, st, badge] of all) {
		if (st.hidden || (!content && !badge)) continue;
		const geom = env.labelGeom(e, st, content, slot === undefined ? e.style?.step : 0),
			{
				p: [x, y],
				w,
				h,
				pt,
			} = geom,
			lines = content ? content.split('\\\\').map(display) : [],
			lk = `${key}:l${slot ?? 'm'}`;
		const c = styleColor(st.color || e.style?.color, '#595959');
		if (st.background !== false)
			out.push(
				prim('rect', `${lk}:bg`, {
					x: x - w / 2,
					y: -(y + h / 2),
					width: w,
					height: h,
					fill: '#fff',
					'pointer-events': 'none',
				}),
			);
		lines.forEach((line: string, k: number) => {
			out.push(
				textPrim(
					`${lk}:t${k}`,
					x + badge / 2,
					y + ((lines.length - 1) / 2 - k) * pt * PT * 1.25,
					line,
					pt,
					'Sakuga Sans',
					c,
					'middle',
					{
						'font-weight': st.bold ? 'bold' : 'normal',
						'font-style': st.italic ? 'italic' : 'normal',
					},
				),
			);
		});
		if (badge) {
			const bx = x - w / 2 + 1.8;
			out.push(
				prim('circle', `${lk}:badge`, { cx: bx, cy: -y, r: 1.8, fill: c, 'pointer-events': 'none' }),
				textPrim(`${lk}:no`, bx, y, String(e.style!.step), 8, 'Sakuga Sans', '#fff', 'middle', {
					'font-weight': 'bold',
					'font-style': 'normal',
				}),
			);
		}
		out.push(
			prim(
				'rect',
				`${lk}:hit`,
				{ x: x - w / 2, y: -(y + h / 2), width: w, height: h, fill: 'transparent', class: 'attached-label' },
				{ hit: { k: 'label', ref: { index: i, ...(slot === undefined ? {} : { slot }) } } },
			),
		);
	}
	return out;
}
