import { syncTree } from '../model/tree';
import { projectLook } from './cascade';
// Resolving, merging and overriding named styles.
import { FigEdge, FigNode, Figure, ObjectStyle, StyleKind } from '../model/figure';
import { edges, findStyle, nodeStyleKind, nodes } from '../model/queries';
import { styleable, travelGroups } from '../schema';

const objectKey = (o: FigNode | FigEdge) => o.cat || ('from' in o ? o.styleKey : undefined);

export const objectKind = (o: FigNode | FigEdge): StyleKind | null => ('from' in o ? 'arrow' : nodeStyleKind(o));

export const styleOf = (fig: Figure, o: FigNode | FigEdge) => {
	const k = objectKind(o);
	return findStyle(fig, objectKey(o));
};

export const isSet = (v: unknown) => v !== undefined && v !== null && v !== '';

export const styleableOf = (kind: StyleKind, st: Record<string, any> = {}) =>
	Object.fromEntries(
		styleable(kind)
			.filter((k) => isSet(st[k]))
			.map((k) => [k, st[k]]),
	);

// The object's own values on top of its style; a group is taken whole from the object if it names any of it.
export function mergeStyle(kind: StyleKind, base: Record<string, any>, st: Record<string, any>): ObjectStyle {
	const out: any = { ...st },
		groups = travelGroups(kind),
		grouped = new Set(groups.flat());
	for (const k of styleable(kind)) {
		if (!grouped.has(k) && out[k] === undefined && isSet(base[k])) {
			out[k] = base[k];
		}
	}
	for (const g of groups) {
		if (g.every((k) => out[k] === undefined)) {
			for (const k of g) {
				if (isSet(base[k])) {
					out[k] = base[k];
				}
			}
		}
	}
	return out;
}

// What an object changes against its style (plus every property a style cannot hold).
export function overrideOf(kind: StyleKind, st: Record<string, any>, base: Record<string, any>): ObjectStyle {
	const out: any = {},
		groups = travelGroups(kind),
		grouped = new Set(groups.flat());
	for (const k of Object.keys(st)) {
		if (!styleable(kind).includes(k)) {
			out[k] = st[k];
		}
	}
	for (const k of styleable(kind)) {
		if (!grouped.has(k) && st[k] !== undefined && st[k] !== base[k]) {
			out[k] = st[k];
		}
	}
	for (const g of groups) {
		if (g.some((k) => st[k] !== base[k])) {
			for (const k of g) {
				if (st[k] !== undefined) {
					out[k] = st[k];
				}
			}
		}
	}
	return out;
}

export function overrideKeys(fig: Figure, o: FigNode | FigEdge): string[] {
	return Object.keys(o.look?.own || o.style || {});
}

// Make every styled object carry style + overrides (idempotent).
export function settle(fig: Figure) {
	syncTree(fig);
	projectLook(fig);
}

// Boxes that share the same overrides against the same style: candidates for a new style.
export function sharedOverrides(fig: Figure): { cat: string; props: Record<string, any>; ids: string[] }[] {
	const groupsOf = new Map<string, { cat: string; props: Record<string, any>; ids: string[] }>();
	for (const n of nodes(fig)) {
		if (n.kind) {
			continue;
		}
		const def = findStyle(fig, n.cat, 'box');
		const props = def
			? styleableOf('box', overrideOf('box', n.style || {}, def.props))
			: styleableOf('box', n.style || {});
		if (!Object.keys(props).length) {
			continue;
		}
		const sig = JSON.stringify([n.cat, Object.entries(props).sort()]);
		const g = groupsOf.get(sig) ?? { cat: n.cat, props, ids: [] };
		g.ids.push(n.id);
		groupsOf.set(sig, g);
	}
	return [...groupsOf.values()].filter((g) => g.ids.length >= 2);
}
