// The authoritative cascade. `style` and frame fields are projections for existing geometry/UI clients.
import type { Figure, Category } from '../model/figure';
import type { Item, ItemKind, TreeState } from '../model/item';
import type { ResolvedValue } from '../model/look';
import { payload } from '../model/tree';
import { itemById } from '../model/tree-queries';
import { categories } from '../model/queries';
import { darkerColor, cssFill } from '../model/colour';
import { themeValues } from '../schema/theme';
import { defsOf, defaultOf } from '../schema';

export function categoryKey(fig: Figure, i: Item): string {
	const p = payload(i);
	if (p.cat) return p.cat;
	return i.kind === 'Text' && itemById(fig, i.parent) ? categoryKey(fig, itemById(fig, i.parent)!) : '';
}
export function categoryValues(fig: Figure, c: Category, kind: ItemKind): Record<string, any> {
	const color = fig.theme?.palette?.[c.color] || c.color;
	const dark = darkerColor(color);
	return {
		...(kind === 'Shape'
			? {
					...c.props,
					fill: color,
					...(c.props?.weight && c.props.lineWidth === undefined
						? { lineWidth: ({ thin: 0.45, medium: 0.8, thick: 1.2 } as Record<string, number>)[c.props.weight] }
						: {}),
				}
			: {}),
		...(kind === 'Frame' ? { color, fill: 'tint', frameColor: dark, titleColor: dark } : {}),
		...(kind === 'Connector' || kind === 'Line' ? { color: dark } : {}),
		...(kind === 'Text' || kind === 'Icon' ? { textColor: dark } : {}),
		...(c.outline ? { [kind === 'Frame' ? 'outline' : 'border']: c.outline } : {}),
		...(c.emphasis ? { text: c.emphasis } : {}),
		...c.kinds?.[kind],
	};
}
export function currentValues(i: Item): Record<string, any> {
	if (i.kind === 'Frame') {
		const { look, ...g }: any = i.frame;
		return Object.fromEntries(
			defsOf('frame')
				.filter((d) => g[d.key] !== undefined)
				.map((d) => [d.key, g[d.key]]),
		);
	}
	if (i.kind === 'Text' && !i.node) return i.look?.resolved || {};
	return (payload(i) as any).style || {};
}
// Notice edits made by the old inspector to the projection, including deletions (reset).
export function ownValues(i: Item): Record<string, any> {
	const p = payload(i),
		current = currentValues(i);
	if (!p.look) return Object.fromEntries(Object.entries(current).filter(([, v]) => v !== undefined && v !== null));
	const own = { ...p.look.own };
	for (const k of new Set([...Object.keys(current), ...Object.keys(p.look.resolved)])) {
		if (current[k] !== p.look.resolved[k]) {
			if (current[k] === undefined || current[k] === null) delete own[k];
			else own[k] = current[k];
		}
	}
	return own;
}
export function resolveLook(fig: Figure, item: Item | string): Record<string, ResolvedValue> {
	const i = typeof item === 'string' ? itemById(fig, item) : item;
	if (!i) return {};
	const out: Record<string, ResolvedValue> = {};
	const add = (values: Record<string, any>, source: ResolvedValue['source']) => {
		for (const [key, value] of Object.entries(values)) out[key] = { value, source };
	};
	add(themeValues(fig, i.kind), 'theme');
	if (i.kind === 'Connector') {
		if (i.connector.kind === 'arr-dashed') add({ border: 'dashed', color: '#a6a6a6' }, 'theme');
		if (i.connector.head === 'both') add({ start: 'Latex' }, 'theme');
		if (i.connector.head === 'none') add({ end: 'none' }, 'theme');
	}
	const key = categoryKey(fig, i),
		c = categories(fig).find((c) => c.key === key);
	const category = c ? categoryValues(fig, c, i.kind) : {};
	if (c) add(category, { category: key });
	const own = ownValues(i);
	add(own, 'item');
	if (i.kind === 'Frame')
		for (const d of defsOf('frame')) {
			if (
				typeof d.default === 'function' &&
				own[d.key] === undefined &&
				category[d.key] === undefined &&
				fig.theme?.kinds?.Frame?.[d.key] === undefined
			) {
				out[d.key] = {
					value: defaultOf(d, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.value]))),
					source: 'theme',
				};
			}
		}
	if (own.weight && own.lineWidth === undefined)
		out.lineWidth = {
			value: ({ thin: 0.45, medium: 0.8, thick: 1.2 } as Record<string, number>)[own.weight],
			source: 'item',
		};
	return out;
}
export function projectLook(fig: Figure): void {
	for (const i of fig.items || []) {
		const p = payload(i),
			own = ownValues(i);
		const resolved = Object.fromEntries(Object.entries(resolveLook(fig, i)).map(([k, v]) => [k, v.value]));
		p.look = { own, resolved };
		if (i.kind === 'Frame') Object.assign(i.frame, resolved);
		else if (i.kind !== 'Text' || i.node) (p as any).style = { ...resolved };
	}
}
export function itemOverrides(p: TreeState & { style?: any }): Record<string, any> {
	return p.look?.own || p.style || {};
}
export const paletteFill = (fig: Figure, color: string) => cssFill(fig.theme?.palette?.[color] || color);
