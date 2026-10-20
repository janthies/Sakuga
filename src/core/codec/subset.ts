// The part of a figure a copy puts on the clipboard: the selected boxes, arrows and groups, with what they need to paste.
import { lineSource } from './line';
import { descendants } from '../model/tree-queries';
import { lineItems } from '../model/tree';
import { edgeLine } from './edge-line';
import { groupOptions } from './group';
import { nodeSource } from './serialize';
import { styleLine } from './style-line';
import { geometryOf } from '../geometry/figure-geometry';
import type { Figure } from '../model/figure';
import type { ObjectRef } from '../model/refs';
import { settle } from '../styles/resolve';
import { edges, groups, isHidden, isLocked, nodes, styleDefs } from '../model/queries';

export function serializeSubset(fig: Figure, refs: ObjectRef[]): string {
	settle(fig);
	const all = nodes(fig),
		node = (id: string) => all.find((n) => n.id === id);
	const ids = new Set<string>();
	for (const r of refs)
		if (r.k === 'node') {
			const n = node(r.id);
			if (n && !isLocked(fig, n) && !isHidden(fig, n)) ids.add(n.id);
		}
	for (const id of [...ids])
		for (const child of descendants(fig, id)) if ('node' in child && child.node) ids.add(child.id);
	const picked = new Set(refs.flatMap((r) => (r.k === 'edge' ? [r.index] : [])));
	const list = edges(fig);
	const selected = list.filter((e, i) => picked.has(i) || (ids.has(e.from) && ids.has(e.to)));
	// a copied group takes its members and child groups along
	const copied = new Set<string>();
	const includeGroup = (id: string) => {
		const g = groups(fig).find((g) => g.id === id);
		if (!g || copied.has(id)) return;
		copied.add(id);
		for (const child of groups(fig).filter((g) => g.parent === id)) includeGroup(child.id);
		for (const n of all.filter((n) => n.group === id && !isHidden(fig, n) && !isLocked(fig, n))) ids.add(n.id);
	};
	for (const r of refs) if (r.k === 'group') includeGroup(r.id);
	for (const e of selected) {
		includeGroup(e.from);
		includeGroup(e.to);
	}
	for (const e of selected) {
		if (node(e.from)) ids.add(e.from);
		if (node(e.to)) ids.add(e.to);
	}
	for (const id of ids) {
		const a = node(id)?.attachment;
		if (a && node(a.parent)) ids.add(a.parent);
	}
	if (!ids.size) return '';
	const used = new Set([...[...ids].map((id) => node(id)!.cat), ...selected.map((e) => e.styleKey)].filter(Boolean));
	const geo = geometryOf(fig);
	return [
		...styleDefs(fig)
			.filter((s) => used.has(s.key))
			.map(styleLine),
		...groups(fig)
			.filter((g) => copied.has(g.id))
			.map(
				(g) =>
					`% sakuga group ${g.id} {${g.name}} ${g.frame} ${g.color}${g.parent ? ` in=${g.parent}` : ''}${groupOptions(g)}`,
			),
		...all.filter((n) => ids.has(n.id)).map((n) => nodeSource(fig, n)),
		...lineItems(fig)
			.filter((l) => ids.has(l.id) || copied.has(l.group || ''))
			.map((l) => lineSource(fig, l)),
		...selected
			.filter((e) => (ids.has(e.from) || copied.has(e.from)) && (ids.has(e.to) || copied.has(e.to)))
			.map((e) => edgeLine(fig, e, geo)),
	].join('\n');
}
