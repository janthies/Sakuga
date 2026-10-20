// Helpers of the style operations.
import { FigEdge, FigNode, Figure, ObjectStyle, StyleDef } from '../model/figure';
import { edges, fontSize, nodeStyleKind, nodes } from '../model/queries';
import { isSet, mergeStyle, objectKind, overrideOf, styleOf } from '../styles/resolve';
import { styleable, travelGroups } from '../schema';

export function slugKey(name: string, taken: string[]): string {
	const base =
		name
			.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
			.toLowerCase()
			.replace(/ä/g, 'ae')
			.replace(/ö/g, 'oe')
			.replace(/ü/g, 'ue')
			.replace(/ß/g, 'ss')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'cat';
	let key = base;
	for (let i = 2; taken.includes(key); i++) {
		key = `${base}-${i}`;
	}
	return key;
}

export const usersOf = (fig: Figure, def: StyleDef): (FigNode | FigEdge)[] =>
	def.kind === 'arrow'
		? edges(fig).filter((e) => e.styleKey === def.key)
		: nodes(fig).filter((n) => n.cat === def.key && nodeStyleKind(n) === def.kind);

// Change a style definition while the users keep their overrides.
export function restyle(fig: Figure, def: StyleDef, mutate: (users: (FigNode | FigEdge)[]) => void) {
	const users = usersOf(fig, def),
		before = users.map((u) => overrideOf(def.kind, u.style || {}, def.props));
	mutate(users);
	users.forEach((u, i) => {
		u.style = mergeStyle(def.kind, def.props, before[i]);
	});
}

// A property change on an object. On a styled object an empty value means "back to the style",
// except where the style itself differs from the house look and the object asks for the house look.
export function patchStyle(fig: Figure, o: FigNode | FigEdge, patch: ObjectStyle): ObjectStyle {
	const st: any = { ...o.style, ...patch },
		kind = objectKind(o),
		def = styleOf(fig, o);
	if (kind === 'box' || kind === 'label') {
		if ('weight' in patch && !('lineWidth' in patch)) {
			delete st.lineWidth;
		}
		if (patch.lineWidth !== undefined && patch.lineWidth !== null && patch.weight === undefined) {
			delete st.weight;
		}
	}
	if (!def || !kind) {
		for (const k of Object.keys(st)) {
			if (st[k] === null) {
				delete st[k];
			}
		}
		return st;
	}
	const base = def.props;
	for (const k of styleable(kind)) {
		if (!(k in patch) || isSet((patch as any)[k])) {
			continue;
		}
		if (k === 'border' && base.border && base.border !== 'solid') {
			st.border = 'solid';
		} else if (k === 'shape' && base.shape && base.shape !== 'rounded') {
			st.shape = 'rounded';
		} else if (k === 'weight' && (base.lineWidth !== undefined || (base.weight && base.weight !== 'thin'))) {
			st.weight = 'thin';
			delete st.lineWidth;
		} else {
			delete st[k];
		}
	}
	for (const g of travelGroups(kind)) {
		if (!g.some((k) => k in patch)) {
			continue;
		}
		if (g.every((k) => !isSet(st[k])) && g.some((k) => isSet(base[k]))) {
			if (g[0] === 'font') {
				st.font = fontSize(fig);
			} else if (g[0] === 'weight') {
				st.weight = 'thin';
			}
		}
	}
	return st;
}
