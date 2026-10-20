import type { Figure } from '../model/figure';
import type { FigLine } from '../model/item';
import { edges } from '../model/queries';
import { num } from '../util/num';
export function lineReference(fig: Figure, l: FigLine): string[] {
	if (!edges(fig).some((e) => e.from === l.id || e.to === l.id)) return [];
	const x = (l.start[0] + l.end[0]) / 2,
		y = (l.start[1] + l.end[1]) / 2;
	return [
		'% sakuga icons begin (generated line anchor)',
		`\\node[rectangle,inner sep=0pt,outer sep=0pt,minimum width=${num(Math.abs(l.end[0] - l.start[0]))}mm,minimum height=${num(Math.abs(l.end[1] - l.start[1]))}mm] (${l.id}) at (${num(x)},${num(y)}) {};`,
		'% sakuga icons end',
	];
}
