// The size of a box as TeX sets it: wrapped lines, padding, shape expansion.
import type { NodeLike, Size } from '../model/node';
import { PT, lines, sizes } from './measure';

export function layout(n: NodeLike, font = 'small'): Size {
	if (n.kind === 'icon') return { w: n.width, h: n.minh || n.width, lines: [] };
	const ls = lines(n, font),
		pt = sizes[n.style?.font || font] || 10,
		baseline = ({ 6: 7, 8: 9.5, 9: 11, 10: 12, 10.95: 13.6, 12: 14 } as Record<number, number>)[pt];
	if (n.kind === 'label' && n.style?.compact)
		return {
			w: n.width + 2 * PT,
			h: Math.max(ls.length * pt * PT * 1.25, n.style?.step ? 3.6 : 0) + 2 * PT,
			lines: ls,
		};
	let w = n.width + 2.2675,
		h = Math.max(
			Math.max(6.16, (pt + 7.45 + (ls.length - 1) * baseline + (n.code ? baseline - 1 : 0)) * PT) +
				(n.icon && n.icon !== 'none' && !['left', 'right'].includes(n.iconPosition || 'left') ? 4 : 0),
			n.minh || 0,
		);
	if (n.style?.shape === 'circle') w = h = Math.hypot(w - 0.158, h - 0.158) + 0.158;
	if (n.style?.shape === 'ellipse') {
		w = (w - 0.158) * Math.SQRT2 + 0.158;
		h = (h - 0.158) * Math.SQRT2 + 0.158;
	}
	if (n.style?.shape === 'diamond') w = h = w + h - 0.183;
	if (n.style?.shape === 'cylinder') {
		const r = ((pt + 7 + (ls.length - 1) * baseline + (n.code ? baseline - 1 : 0)) * PT) / 2,
			c = Math.sqrt(1 - ((r - 3.5 * PT) / r) ** 2);
		w += r * (3 - c);
		h = r * 2 + 0.158;
	}
	return { w, h, lines: ls };
}
