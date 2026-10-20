// Group frames and regions with their titles, behind the boxes.
import { PALETTE, darkerColor } from '../model/colour';
import type { Group } from '../model/figure';
import { PT } from '../text';
import { hierarchy, members, type Env } from './env';
import { display, prim, styleColor } from './style';
import { textPrim } from './nodes';
import type { Prim } from './types';

export function framePrims(env: Env): Prim[] {
	const { nodes, groups, layers } = env.fig;
	const out: Prim[] = [];
	const draw = (items: ReturnType<typeof hierarchy>) => {
		for (const item of items) {
			const g = groups.find((g) => g.id === item.id);
			if (!g) continue;
			const ids = members(nodes, groups, g.id).filter((id) => !env.byId(id)!.hidden);
			if (g.frame !== 'none' && ids.length) out.push(framePrim(env, g, ids, layers));
			draw(item.children);
		}
	};
	draw(hierarchy(nodes, groups));
	return out;
}

function framePrim(env: Env, g: Group, ids: string[], layers: { id: string; opacity?: number }[]): Prim {
	const alpha = layers.find((l) => l.id === env.byId(ids[0])!.layer)?.opacity ?? 1;
	const rect = env.geo.frame(g.id)!;
	const x0 = rect.x - rect.w / 2,
		y1 = rect.y + rect.h / 2;
	const p = /^#[0-9a-f]{6}$/i.test(g.color) ? { hex: g.color.slice(1) } : PALETTE[g.color] || PALETTE.grey;
	const strength = (g.fillStrength ?? 30) / 100,
		outline = g.outline || (g.frame === 'region' || g.frame === 'none' ? (g.lineWidth ? 'solid' : 'none') : g.frame);
	const fill = p
		? `rgb(${[0, 2, 4].map((i) => Math.round(parseInt(p.hex.slice(i, i + 2), 16) * strength + 255 * (1 - strength))).join(',')})`
		: '#eee';
	const kids: Prim[] = [
		prim(
			'rect',
			`g:${g.id}:frame`,
			{
				x: x0,
				y: -y1,
				width: rect.w,
				height: rect.h,
				rx: (g.frame === 'region' ? 1.5 : 2.5) * PT,
				fill: (g.fill || (g.frame === 'region' ? 'tint' : 'none')) === 'none' ? 'none' : fill,
				stroke:
					outline === 'none' ? 'none' : styleColor(g.frameColor || (g.outline ? darkerColor(g.color) : ''), '#737373'),
				'stroke-width': (g.lineWidth || (g.frame === 'dotted' ? 1.5 : 0.7)) * PT,
				'stroke-linecap': outline === 'dotted' ? 'round' : 'butt',
				'stroke-dasharray':
					outline === 'dashed' ? `${9 * PT} ${3 * PT}` : outline === 'dotted' ? `0 ${4.5 * PT}` : 'none',
				class: 'group-frame',
				'pointer-events': g.frame === 'region' ? 'all' : 'stroke',
			},
			{ hit: { k: 'group', id: g.id }, ref: { k: 'group', id: g.id } },
		),
	];
	const pos = g.titlePosition || 'legacy';
	if (g.name && (pos !== 'legacy' || g.frame === 'region')) kids.push(...title(env, g, pos));
	return prim(
		'g',
		`g:${g.id}`,
		{ 'fill-opacity': alpha, 'stroke-opacity': alpha },
		{ ref: { k: 'group', id: g.id }, children: kids },
	);
}

function title(env: Env, g: Group, pos: string): Prim[] {
	const geom = env.geo.frameTitle(g)!,
		st = g.labelStyle || {},
		{
			p: [x, y],
			pt,
			align,
		} = geom,
		w = env.textMm(display(g.name), pt) + 3 * PT,
		h = pt * PT + 3 * PT;
	const out: Prim[] = [];
	if (st.background === true)
		out.push(
			prim('rect', `g:${g.id}:bg`, {
				x: x - (align === 'middle' ? w / 2 : align === 'end' ? w : 0),
				y: -(y + h / 2),
				width: w,
				height: h,
				fill: 'white',
			}),
		);
	out.push(
		textPrim(
			`g:${g.id}:title`,
			x,
			y,
			display(g.name),
			pt,
			'Sakuga Sans',
			styleColor(
				st.color ||
					g.titleColor ||
					(pos === 'legacy' ? '' : darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'))),
				'#737373',
			),
			align,
			{ 'font-weight': (st.bold ?? g.titleBold) ? 'bold' : 'normal', 'font-style': st.italic ? 'italic' : 'normal' },
		),
		prim(
			'rect',
			`g:${g.id}:label`,
			{
				x: x - (align === 'middle' ? w / 2 : align === 'end' ? w : 0),
				y: -(y + h / 2),
				width: w,
				height: h,
				fill: 'transparent',
				stroke: 'none',
				class: 'attached-label',
			},
			{ hit: { k: 'label', ref: { group: g.id } } },
		),
	);
	return out;
}
