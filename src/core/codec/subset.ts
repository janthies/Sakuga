import { edgeLine } from './edge-line';
import { edges } from '../model/queries';
import { geometryOf } from '../geometry/figure-geometry';
import { lineLabel } from '../geometry/line-geometry';
import { fontSize } from '../model/queries';
import type { Figure } from '../model/figure';
import type { ObjectRef } from '../model/refs';
import { descendants, itemById } from '../model/tree-queries';
import { syncTree, payload } from '../model/tree';
import { serialize } from './serialize';

/** Copy selected roots, their complete subtrees, and internal arrows. Never climb to an ancestor. */
export function serializeSubset(fig: Figure, refs: ObjectRef[]): string {
	const copy: Figure = JSON.parse(JSON.stringify(fig));
	syncTree(copy);
	const ids = new Set<string>();
	for (const r of refs)
		if ('id' in r && itemById(copy, r.id)) {
			ids.add(r.id);
			for (const c of descendants(copy, r.id)) ids.add(c.id);
		}
	for (const i of copy.items || [])
		if (i.kind === 'Connector' && ids.has(i.source.id) && ids.has(i.target.id)) {
			ids.add(i.id);
			for (const c of descendants(copy, i.id)) ids.add(c.id);
		}
	if (!ids.size) return '';
	for (const i of copy.items || [])
		if (ids.has(i.id) && i.kind === 'Text' && !i.node && !ids.has(i.parent)) {
			const owner = itemById(fig, i.parent),
				geo = geometryOf(fig);
			const b =
				owner?.kind === 'Connector'
					? geo.label(owner.connector, i.placement, i.text)
					: owner?.kind === 'Line'
						? lineLabel(owner.line, i.text, i.placement, fontSize(fig), fig.theme?.kinds?.Shape?.outerGap)
						: undefined;
			const st = i.placement || {};
			i.node = {
				id: i.id,
				kind: 'label',
				title: i.text,
				code: i.code || '',
				x: b?.p[0] || 0,
				y: b?.p[1] || 0,
				width: Math.max(1, (b?.w || 26) - 0.7),
				minh: 0,
				cat: i.cat || '',
				layer: 'layer1',
				group: '',
				hidden: i.hidden,
				locked: i.locked,
				extra: [],
				style: {
					compact: true,
					font: st.font,
					textColor: st.color,
					text: st.bold ? (st.italic ? 'bold-italic' : 'bold') : st.italic ? 'italic' : 'normal',
				},
			};
			copy.lines.push({ t: 'node', n: i.node });
		}

	copy.lines = copy.lines.filter((l) =>
		l.t === 'node'
			? ids.has(l.n.id)
			: l.t === 'group'
				? ids.has(l.g.id)
				: l.t === 'line'
					? ids.has(l.line.id)
					: l.t === 'edge'
						? ids.has(l.e.id || '')
						: l.t === 'style',
	);
	copy.items = copy.items?.filter((i) => ids.has(i.id));
	for (const i of copy.items || [])
		if (!ids.has(i.parent)) {
			i.parent = 'layer1';
			const p = payload(i);
			p.treeParent = 'layer1';
			delete p.slot;
			delete i.slot;
			delete p.attachment;
			if (i.kind === 'Frame') i.frame.parent = '';
			if ('node' in i && i.node) {
				i.node.group = '';
				i.node.layer = 'layer1';
			}
		}
	const explicit = refs.flatMap((r) => (r.k === 'edge' ? [edges(fig)[r.index]].filter(Boolean) : []));
	return [
		serialize(copy).replace(/% sakuga legend begin[^\n]*\n[\s\S]*?% sakuga legend end/g, ''),
		...explicit.filter((e) => !ids.has(e.id!)).map((e) => edgeLine(fig, e)),
	].join('\n');
}
