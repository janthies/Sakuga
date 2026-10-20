import { categoryOption, readCategoryOption } from './look';
import { itemOverrides } from '../styles/cascade';
import type { Figure } from '../model/figure';
import type { FigLine } from '../model/item';
import { layerOf, subtreeState } from '../model/tree-queries';
import { fontSize, layers } from '../model/queries';
import { num } from '../util/num';
import { labelMetrics, labelOptions } from './label';
import { pathLabels } from './path-labels';
import { readOptions, emitOptions } from './options';
import { opacityOptions } from './opt-stroke';

export function readLine(o: string[], path: string): FigLine | null {
	if (!o.includes('sg line')) return null;
	const m = /^\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*--(?:[\s\S]*?)\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(path);
	if (!m) return null;
	const value = (key: string) => o.find((v) => v.startsWith(key + '='))?.slice(key.length + 1);
	return {
		id: value('sg id') || '',
		cat: readCategoryOption(o),
		start: [+m[1], +m[2]],
		end: [+m[3], +m[4]],
		layer: value('sg layer'),
		group: value('sg in'),
		hidden: o.includes('sg hidden'),
		locked: o.includes('sg locked'),
		labels: pathLabels(path),
		...readOptions(
			o.filter((v) => v !== 'sg line' && !/^sg (id|in|layer)=/.test(v) && !['sg hidden', 'sg locked'].includes(v)),
		),
	};
}
export function lineSource(fig: Figure, l: FigLine): string {
	const layer = layerOf(fig, l.id),
		alpha = layers(fig).find((v) => v.id === layer)?.opacity;
	const o = [
		'sg line',
		...categoryOption(l.cat || '', 'Line'),
		'sg id=' + l.id,
		...emitOptions(itemOverrides(l), { forceDefaults: true }),
		...opacityOptions(l.style?.opacity, alpha),
		...(l.group ? ['sg in=' + l.group] : []),
		...(layer ? ['sg layer=' + layer] : []),
		...(l.hidden ? ['sg hidden'] : []),
		...(l.locked ? ['sg locked'] : []),
		...l.extra,
	];
	const labels = (l.labels || [])
		.map(
			(v) =>
				` node[sg label${labelMetrics(v.text, v.style, fontSize(fig))}${labelOptions(v.style, { font: fontSize(fig) })}] {${v.text}}`,
		)
		.join('');
	const result = `\\draw[${o.join(', ')}] (${num(l.start[0])},${num(l.start[1])}) -- (${num(l.end[0])},${num(l.end[1])})${labels};`;
	return subtreeState(fig, l.id, 'hidden') ? '% sakuga hidden ' + result : result;
}
