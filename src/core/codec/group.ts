// Group options: reading the tail of a group line and writing it back, from the frame properties of the schema.
import { readValue, writeValue } from './values';
import { Group } from '../model/figure';
import { defaultOf, groupKeys, groupLineDefs } from '../schema';

export function readGroup(tail: string): Partial<Group> {
	const g: any = {};
	for (const m of (tail || '').matchAll(new RegExp(`(${groupKeys().join('|')})=([^ ]+)`, 'g'))) {
		g[m[1]] = readValue(m[1], m[2], true);
	}
	return g;
}

// A property is written when the group sets it to something other than what its frame look implies.
export function groupOptions(g: Group): string {
	return groupLineDefs()
		.filter((d) => {
			const v = (g as any)[d.key];
			return v !== undefined && v !== '' && v !== defaultOf(d, g) && !(d.length && v === 0);
		})
		.map((d) => ` ${d.key}=${writeValue(d, (g as any)[d.key])}`)
		.join('');
}
