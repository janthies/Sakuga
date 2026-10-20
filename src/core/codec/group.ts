// Group options: reading the tail of a group line and writing it back.
import { fromHex, toHex } from '../util/hex';
import { Group } from '../model/figure';
import { cleanLabel } from '../styles/appearance';

export const groupDefaults: Record<string, unknown> = {
	padding: 0,
	titlePosition: 'legacy',
	titleBold: false,
	titleFont: 'scriptsize',
	titleColor: '',
	lineWidth: 0,
	frameColor: '',
	fill: '',
	fillStrength: 30,
	outline: '',
	labelStyle: undefined,
};

export function readGroup(tail: string): Partial<Group> {
	const g: any = {};
	for (const m of (tail || '').matchAll(
		/(padding|titlePosition|titleBold|titleFont|titleColor|lineWidth|frameColor|fill|fillStrength|outline|labelStyle)=([^ ]+)/g,
	)) {
		g[m[1]] =
			m[1] === 'titleBold'
				? m[2] === 'true'
				: ['padding', 'lineWidth', 'fillStrength'].includes(m[1])
					? +m[2]
					: m[1] === 'labelStyle'
						? JSON.parse(fromHex(m[2]))
						: m[2];
	}
	return g;
}

export function groupOptions(g: Group): string {
	const defaults = {
		...groupDefaults,
		padding: g.frame === 'dashed' ? 2.8 : g.frame === 'dotted' ? 1.8 : 3,
		lineWidth: g.frame === 'region' || g.frame === 'none' ? 0 : g.frame === 'dotted' ? 1.5 : 0.7,
	};
	return Object.entries(defaults)
		.filter(
			([k, v]) =>
				(g as any)[k] !== undefined &&
				(g as any)[k] !== '' &&
				(g as any)[k] !== v &&
				!(['padding', 'lineWidth'].includes(k) && (g as any)[k] === 0),
		)
		.map(([k]) => ` ${k}=${k === 'labelStyle' ? toHex(JSON.stringify(cleanLabel(g.labelStyle))) : (g as any)[k]}`)
		.join('');
}
