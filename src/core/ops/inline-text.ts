import type { Figure } from '../model/figure';
import type { Item, TextItem } from '../model/item';
import { childrenOf } from '../model/tree-queries';
import { insert } from '../model/lines';

// The first Text under a shape/frame is emitted inline as its title. Other texts
// are regular attached nodes. Path labels are always inline Text children.
export function inlineText(fig: Figure, i: TextItem, parent: Item | undefined): boolean {
	if (!parent) return false;
	const siblings = childrenOf(fig, parent.id).filter((c) => c.kind === 'Text' && c.id !== i.id);
	const first = siblings[0];
	const path = parent.kind === 'Line' || parent.kind === 'Connector';
	if (!path && !(parent.kind === 'Shape' && (!first || i.order < first.order))) return false;
	const text = i.text,
		code = i.code || '',
		st = i.placement;
	if (path) {
		const entry = { id: i.id, text, style: st };
		if (parent.kind === 'Line') {
			const labels = parent.line.labels || [];
			labels.splice(i.order, 0, entry);
			parent.line.labels = labels;
		}
		if (parent.kind === 'Connector') {
			const labels = [
				...(parent.connector.label
					? [{ id: parent.connector.labelId, text: parent.connector.label, style: parent.connector.labelStyle }]
					: []),
				...(parent.connector.labels || []),
			];
			labels.splice(i.order, 0, entry);
			const primary = labels.shift()!;
			Object.assign(parent.connector, { labelId: primary.id, label: primary.text, labelStyle: primary.style, labels });
		}
	} else {
		if (first?.kind === 'Text' && !first.node) {
			// Promote the former title to a normal Text child without losing it.
			const n = {
				id: first.id,
				kind: 'label',
				title: first.text,
				code: first.code || '',
				x: parent.kind === 'Shape' ? parent.node.x : 0,
				y: parent.kind === 'Shape' ? parent.node.y : 0,
				width: 26,
				minh: 0,
				cat: '',
				layer: '',
				group: '',
				treeParent: parent.id,
				order: i.order + 1,
				hidden: first.hidden,
				locked: first.locked,
				extra: [],
			};
			if (parent.kind === 'Shape')
				Object.assign(n, { attachment: { parent: parent.id, anchor: 'center', ownAnchor: 'center', dx: 0, dy: 0 } });
			insert(fig, { t: 'node', n });
			first.node = n;
			first.role = undefined;
		}
		if (parent.kind === 'Shape') {
			parent.node.title = text;
			parent.node.code = code;
			parent.node.titleId = i.id;
		}
	}
	if (i.node) fig.lines = fig.lines.filter((l) => !(l.t === 'node' && l.n === i.node));
	i.node = undefined;
	return true;
}
