// Boxes, icons and labels as primitives: outline, decorations, icon and title lines.
import { cssFill } from '../model/colour';
import type { FigNode } from '../model/figure';
import { PT, codeSize, sizes } from '../text';
import { boxShape, decorations } from './box-shape';
import { paintOrder, type Env } from './env';
import { icon } from './shapes';
import { CODE, STROKE, dash, display, opacityOf, prim, styleColor, weight } from './style';
import type { Prim } from './types';

export const textPrim = (
	key: string,
	x: number,
	y: number,
	s: string,
	pt: number,
	family: string,
	fill: string,
	anchor = 'middle',
	extra: Prim['attrs'] = {},
): Prim =>
	prim(
		'text',
		key,
		{
			x,
			y: -y,
			'text-anchor': anchor,
			'dominant-baseline': 'central',
			'font-size': pt * PT,
			'font-family': family,
			fill,
			'pointer-events': 'none',
			...extra,
		},
		{ text: s },
	);

const fillOf = (env: Env, cat: string) => cssFill(env.fig.categories.find((c) => c.key === cat)?.color);
export const catFill = fillOf;

export function nodePrims(env: Env): Prim[] {
	const out: Prim[] = [];
	for (const n of paintOrder(env.fig.nodes)) {
		if (!n.hidden) out.push(nodePrim(env, n));
	}
	return out;
}

function nodePrim(env: Env, n: FigNode): Prim {
	const key = `n:${n.id}`,
		ref = { k: 'node', id: n.id } as const;
	const alpha = (n.style?.opacity ?? 1) * opacityOf(env.fig.layers, n.layer);
	const { w, h, lines } = env.size(n);
	const kids: Prim[] = [];
	const hit = n.locked ? { hit: { k: 'locked' } as const } : { hit: { k: 'node', id: n.id } as const };
	const klass = n.locked ? 'locked-node' : 'node';
	const r = n.kind === 'label' || n.style?.shape === 'rectangle' ? 0 : n.style?.shape === 'pill' ? h / 2 : 1.4 * PT;
	const area = { x: n.x - w / 2, y: -(n.y + h / 2), width: w, height: h, fill: 'transparent' };
	if (n.kind === 'icon') {
		kids.push(icon(env, `${key}:icon`, n.icon as string, n.x - w / 2, n.y, w, h));
		kids.push(prim('rect', `${key}:area`, { ...area, class: klass }, hit));
		if (env.opts.editing !== n.id) {
			kids.push(
				prim(
					'text',
					`${key}:title`,
					{
						x: n.x + w / 2 + 1,
						y: -n.y,
						'text-anchor': 'start',
						'dominant-baseline': 'central',
						'font-size': env.fontPt(n) * PT,
						'font-family': 'Sakuga Sans',
						fill: '#000',
						'pointer-events': n.locked ? 'none' : 'auto',
					},
					{ text: display(n.title), ...(n.locked ? {} : { hit: { k: 'node', id: n.id } as const }) },
				),
			);
		}
	} else {
		if (n.kind === 'label')
			kids.push(
				prim('rect', `${key}:area`, { ...area, ...(n.locked ? { class: 'locked-node' } : {}) }, n.locked ? {} : hit),
			);
		const box = boxShape(
			`${key}:box`,
			n,
			w,
			h,
			r,
			{
				fill: styleColor(n.style?.fill, n.kind === 'label' ? 'none' : fillOf(env, n.cat)),
				stroke:
					n.style?.border === 'none' || (n.kind === 'label' && !n.style?.border)
						? 'none'
						: styleColor(n.style?.color, STROKE),
				'stroke-dasharray': dash(n.style),
				'stroke-width': weight(n.style),
				class: klass,
			},
			n.locked ? {} : hit,
		);
		kids.push(box, ...decorations(`${key}:box`, n, w, h, box));
	}
	if (env.opts.editing !== n.id && n.kind !== 'icon') kids.push(...titleLines(env, n, key, w, h, lines));
	return prim('g', key, { 'fill-opacity': alpha, 'stroke-opacity': alpha }, { ref, children: kids });
}

function titleLines(env: Env, n: FigNode, key: string, w: number, h: number, lines: string[]): Prim[] {
	const out: Prim[] = [];
	const fpt = env.fontPt(n);
	const pitch = ({ 8: 9.5, 9: 11, 10: 12, 10.95: 13.6, 12: 14 } as Record<number, number>)[fpt] * PT,
		codePitch = pitch - PT;
	const total = (lines.length - 1) * pitch + (n.code ? codePitch : 0);
	const pos = n.iconPosition || 'left',
		name = env.geo.icon(n) ?? '';
	const shiftX = name ? (pos === 'left' ? 2 : pos === 'right' ? -2 : 0) : 0;
	const shiftY = name && !['left', 'right'].includes(pos) ? (['sw', 'se'].includes(pos) ? 2 : -2) : 0;
	if (name) {
		const x = ['right', 'ne', 'se'].includes(pos) ? n.x + w / 2 - 4 : pos === 'above' ? n.x - 1.5 : n.x - w / 2 + 1;
		const iy = ['above', 'nw', 'ne'].includes(pos)
			? n.y + h / 2 - 2.5
			: ['sw', 'se'].includes(pos)
				? n.y - h / 2 + 2.5
				: n.y;
		out.push(icon(env, `${key}:glyph`, name, x, iy));
	}
	const tp = n.titlePosition || 'center';
	const anchor = tp.includes('west') ? 'start' : tp.includes('east') ? 'end' : 'middle';
	const tx = n.x + shiftX + (tp.includes('west') ? -n.width / 2 : tp.includes('east') ? n.width / 2 : 0);
	let y =
		(tp.includes('north')
			? n.y + h / 2 - 3.5 * PT - (fpt * PT) / 2
			: tp.includes('south')
				? n.y - h / 2 + 3.5 * PT + (fpt * PT) / 2 + total
				: n.y + total / 2) + shiftY;
	lines.forEach((l, i) => {
		out.push(
			textPrim(
				`${key}:line${i}`,
				tx + (n.kind === 'label' && n.style?.step ? 2.2 : 0),
				y,
				l,
				fpt,
				'Sakuga Sans',
				styleColor(n.style?.textColor, '#000'),
				anchor,
				{
					'font-weight': n.style?.text?.startsWith('bold') ? 'bold' : 'normal',
					'font-style': n.style?.text?.includes('italic') ? 'italic' : 'normal',
				},
			),
		);
		y -= pitch;
	});
	if (n.code) {
		out.push(
			textPrim(
				`${key}:code`,
				tx,
				y + pitch - codePitch,
				display(n.code),
				sizes[codeSize(n, env.fig.font)],
				'Sakuga Mono',
				CODE,
				anchor,
			),
		);
	}
	return out;
}

// The numbered badge on a step label.
export function stepBadges(env: Env): Prim[] {
	const out: Prim[] = [];
	for (const n of env.fig.nodes.filter((n) => !n.hidden && n.kind === 'label' && n.style?.step)) {
		const { w } = env.size(n);
		const x = n.x - w / 2 + 1.8,
			c = styleColor(n.style?.textColor, '#595959');
		out.push(
			prim(
				'g',
				`n:${n.id}:step`,
				{},
				{
					children: [
						prim('circle', `n:${n.id}:step:dot`, { cx: x, cy: -n.y, r: 1.8, fill: c }),
						textPrim(`n:${n.id}:step:no`, x, n.y, String(n.style!.step), 8, 'Sakuga Sans', '#fff', 'middle', {
							'font-weight': 'bold',
							'font-style': 'normal',
						}),
					],
				},
			),
		);
	}
	return out;
}
