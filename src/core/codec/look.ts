// Header persistence and generated TikZ styles of the look cascade.
import type { Figure, StyleDef } from '../model/figure';
import type { ItemKind } from '../model/item';
import { PALETTE, fill } from '../model/colour';
import { categories } from '../model/queries';
import { categoryValues } from '../styles/cascade';
import { houseValues, ITEM_KINDS } from '../schema/theme';
import { emitOptions } from './options';
import { readStyleLine, styleLine } from './style-line';

export const kindToken: Record<ItemKind, string> = {
	Shape: 'shape',
	Frame: 'frame',
	Connector: 'conn',
	Text: 'text',
	Icon: 'icon',
	Line: 'line',
};
export function readTheme(fig: Figure, line: string): boolean {
	const m = /^% sakuga theme ([\w]+)\.([\w-]+)=(.*)$/.exec(line);
	if (!m) return false;
	const [, token, prop, raw] = m;
	let value: any;
	try {
		value = JSON.parse(raw);
	} catch {
		value = raw;
	}
	fig.theme ||= {};
	if (token === 'palette') (fig.theme.palette ||= {})[prop] = value;
	else if (token === 'figure' && prop === 'fontSize') fig.theme.fontSize = value;
	else {
		const kind = ITEM_KINDS.find((k) => kindToken[k] === token || k.toLowerCase() === token);
		if (kind) ((fig.theme.kinds ||= {})[kind] ||= {})[prop] = value;
	}
	return true;
}
export function themeHeader(fig: Figure): string[] {
	const out: string[] = [];
	for (const kind of ITEM_KINDS)
		for (const [prop, value] of Object.entries(fig.theme?.kinds?.[kind] || {})) {
			if (value !== houseValues(kind)[prop])
				out.push(`% sakuga theme ${kindToken[kind]}.${prop}=${JSON.stringify(value)}`);
		}
	for (const [key, value] of Object.entries(fig.theme?.palette || {}))
		if (value.replace('#', '').toUpperCase() !== PALETTE[key]?.hex) out.push(`% sakuga theme palette.${key}=${value}`);
	if (fig.theme?.fontSize && fig.theme.fontSize !== 'small')
		out.push(`% sakuga theme figure.fontSize=${fig.theme.fontSize}`);
	return out;
}
export function readCategory(line: string): StyleDef | null {
	const m = /^% sakuga category ([\w-]+) \{(.*?)\}\s*(.*)$/.exec(line);
	if (!m) return null;
	const tail = m[3].replace(/\[([^\]]+)\]/g, '$1');
	const d = readStyleLine('box', m[1], m[2], tail);
	const bare = tail.trim().split(/\s+/)[0];
	if (bare && !bare.includes('=') && !['legend', 'boxes'].includes(bare)) d.props.fill = bare;
	d.outline = /(?:^|\s)outline=(\S+)/.exec(tail)?.[1];
	d.emphasis = /(?:^|\s)emphasis=(\S+)/.exec(tail)?.[1];
	delete d.props.outline;
	delete d.props.emphasis;
	const encoded = /(?:^|\s)kinds=(\S+)/.exec(tail)?.[1];
	if (encoded) d.kinds = JSON.parse(decodeURIComponent(encoded));
	delete d.props.kinds;
	return d;
}
export function categoryHeader(d: StyleDef): string {
	return (
		styleLine(d).replace('% sakuga style box ', '% sakuga category ') +
		(d.outline ? ` outline=${d.outline}` : '') +
		(d.emphasis ? ` emphasis=${d.emphasis}` : '') +
		(d.kinds ? ` kinds=${encodeURIComponent(JSON.stringify(d.kinds))}` : '')
	);
}
export function lookStyles(fig: Figure): string[] {
	return [
		...ITEM_KINDS.flatMap((kind) => {
			const raw = fig.theme?.kinds?.[kind];
			const props = raw && Object.fromEntries(Object.entries(raw).filter(([k, v]) => v !== houseValues(kind)[k]));
			return props && Object.keys(props).length
				? [
						`  sg ${kindToken[kind]}/.append style={${emitOptions(props, { arrow: kind === 'Connector' || kind === 'Line', forceDefaults: true }).join(', ')}},`,
					]
				: [];
		}),
		...categories(fig).flatMap((c) =>
			ITEM_KINDS.map((kind) => {
				const props = categoryValues(fig, c, kind);
				const options =
					kind === 'Frame'
						? [
								`fill=${fill(props.color).split('!')[0]}!${props.fillStrength ?? 30}`,
								`draw=${fill(props.frameColor)}`,
								`text=${fill(props.titleColor)}`,
							]
						: emitOptions(props, { arrow: kind === 'Connector' || kind === 'Line', forceDefaults: true });
				if (kind === 'Icon' && props.textColor)
					options.push(`sg icon stroke/.append style={draw=${fill(props.textColor)}}`);
				return `  cat-${c.key}-${kindToken[kind]}/.style={${options.join(', ')}},`;
			}),
		),
	];
}
export const categoryOption = (key: string, kind: ItemKind) => (key ? [`cat-${key}-${kindToken[kind]}`] : []);
export const readCategoryOption = (o: string[]) =>
	o
		.find((v) => /^cat-.*-(shape|frame|conn|text|icon|line)$/.test(v))
		?.replace(/^cat-/, '')
		.replace(/-(shape|frame|conn|text|icon|line)$/, '');
