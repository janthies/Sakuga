import type { FigLine } from '../model/item';
import type { LabelStyle } from '../model/figure';
import { PT, mm, sizes } from '../text';

export function lineLabel(l: FigLine, text: string, st: LabelStyle = {}, font = 'small', gap = 1) {
	const t = st.pos ?? 0.5,
		dx = l.end[0] - l.start[0],
		dy = l.end[1] - l.start[1],
		len = Math.hypot(dx, dy) || 1;
	const sign = ['below', 'right'].includes(st.side || '') ? -1 : 1;
	const pt = sizes[st.font || font] || 10,
		lines = text.split('\\\\');
	const h = lines.length * pt * PT * 1.25 + 2 * PT,
		w = Math.max(...lines.map((s) => mm(s, pt))) + 2 * PT;
	const offset = (Math.abs(dy / len) * w + Math.abs(dx / len) * h) / 2 + gap;
	const p = [l.start[0] + dx * t - ((sign * dy) / len) * offset, l.start[1] + dy * t + ((sign * dx) / len) * offset];
	return { p, w, h, pt };
}
