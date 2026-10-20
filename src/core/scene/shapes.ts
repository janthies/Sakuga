// Arrow paths, arrow tips and icons as primitives. Model coordinates (y up, mm) in, scene coordinates (y down) out.
import { PT } from '../text';
import type { Env } from './env';
import { LINE, n4, prim } from './style';
import type { Prim } from './types';

const X = (x: number) => n4(x);
const Y = (y: number) => n4(-y);
const at = (p: number[]) => `${X(p[0])} ${Y(p[1])}`;

export function edgePath(G: any): string {
	if (G.curve) {
		const [p1, c1, c2, p2] = G.curve;
		return `M ${at(p1)} C ${at(c1)} ${at(c2)} ${at(p2)}`;
	}
	const pts: number[][] = G.pts,
		parts = [`M ${at(pts[0])}`];
	for (let i = 1; i < pts.length - 1; i++) {
		const a = pts[i - 1],
			b = pts[i],
			c = pts[i + 1],
			l1 = Math.hypot(a[0] - b[0], a[1] - b[1]),
			l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
		if (!l1 || !l2) {
			parts.push(`L ${at(b)}`);
			continue;
		}
		const r = 2 * PT,
			pre = b.map((v, k) => v + ((a[k] - v) * r) / l1),
			post = b.map((v, k) => v + ((c[k] - v) * r) / l2);
		const c1 = pre.map((v, k) => v + 0.5522847 * (b[k] - v)),
			c2 = post.map((v, k) => v + 0.5522847 * (b[k] - v));
		parts.push(`L ${at(pre)} C ${at(c1)} ${at(c2)} ${at(post)}`);
	}
	parts.push(`L ${at(pts[pts.length - 1])}`);
	return parts.join(' ');
}

// An arrow tip at (x2, y2) pointing away from (x1, y1); returns where the line ends, inside the tip, as in TikZ.
export function tip(
	key: string,
	[x2, y2]: number[],
	[x1, y1]: number[],
	color: string,
	kind = 'Latex',
	style: any = {},
): { prims: Prim[]; end: number[] } {
	const len = Math.hypot(x2 - x1, y2 - y1) || 1;
	const ux = (x2 - x1) / len,
		uy = (y2 - y1) / len;
	const L = style.tipLength ?? 1.5,
		W = style.tipWidth ?? 1.2,
		c = 0.35;
	const bx = x2 - ux * L,
		by = y2 - uy * L;
	let p: Prim;
	if (kind === 'circle') {
		const d =
			Array.from({ length: 25 }, (_, i) => {
				const th = (i / 24) * 2 * Math.PI;
				return `${i ? 'L' : 'M'} ${X(x2 - (ux * L) / 2 + (ux * Math.cos(th) * L) / 2 - (uy * Math.sin(th) * W) / 2)} ${Y(y2 - (uy * L) / 2 + (uy * Math.cos(th) * L) / 2 + (ux * Math.sin(th) * W) / 2)}`;
			}).join(' ') + ' Z';
		p = prim('path', key, { d, fill: color });
	} else if (kind === 'bar') {
		p = prim('path', key, {
			d: `M ${X(x2 - (uy * W) / 2)} ${Y(y2 + (ux * W) / 2)} L ${X(x2 + (uy * W) / 2)} ${Y(y2 - (ux * W) / 2)}`,
			stroke: color,
			'stroke-width': LINE,
		});
	} else if (kind === 'triangle' || kind === 'barb' || kind === 'Stealth') {
		p = prim('path', key, {
			d: `M ${X(bx - (uy * W) / 2)} ${Y(by + (ux * W) / 2)} L ${X(x2)} ${Y(y2)} L ${X(bx + (uy * W) / 2)} ${Y(by - (ux * W) / 2)}${kind === 'barb' ? '' : ' Z'}`,
			fill: kind === 'Stealth' ? color : '#fff',
			stroke: color,
			'stroke-width': LINE,
		});
	} else {
		const d = [
			`M ${X(x2)} ${Y(y2)}`,
			`Q ${X(bx + ux * L * c - uy * W * 0.15)} ${Y(by + uy * L * c + ux * W * 0.15)} ${X(bx - (uy * W) / 2)} ${Y(by + (ux * W) / 2)}`,
			`L ${X(bx + (uy * W) / 2)} ${Y(by - (ux * W) / 2)}`,
			`Q ${X(bx + ux * L * c + uy * W * 0.15)} ${Y(by + uy * L * c - ux * W * 0.15)} ${X(x2)} ${Y(y2)} Z`,
		].join(' ');
		p = prim('path', key, { d, fill: color });
	}
	const shorten = kind === 'bar' ? 0 : L * 0.8;
	return { prims: [p], end: [x2 - ux * shorten, y2 - uy * shorten] };
}

// A 24-unit icon scaled into a w x h mm box whose left edge is at x and whose middle is at y.
// The pen is 0.6 pt wide on the page; the box is drawn at one scale for both axes' mean, so the pen stays round.
export function icon(env: Env, key: string, name: string, x: number, y: number, w = 3, h = 3): Prim {
	const data = env.ctx.icons.find((i) => i.name === name);
	const pen = (0.6 * PT * 24) / ((w + h) / 2);
	const children: Prim[] = [];
	for (const d of data?.paths || []) children.push(prim('path', `${key}:${children.length}`, { d }));
	for (const c of data?.circles || []) children.push(prim('circle', `${key}:${children.length}`, { ...c }));
	for (const r of data?.rects || []) children.push(prim('rect', `${key}:${children.length}`, { ...r }));
	return prim(
		'g',
		key,
		{
			transform: `translate(${X(x)},${n4(-y - h / 2)}) scale(${n4(w / 24)},${n4(h / 24)})`,
			fill: 'none',
			stroke: '#666',
			'stroke-width': pen,
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			'pointer-events': 'none',
		},
		{ children },
	);
}
