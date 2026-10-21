import type { Figure } from '../model/figure';
import type { Item, TextItem } from '../model/item';
import { childrenOf } from '../model/tree-queries';
import { insert } from '../model/lines';

// The first Text under a shape/frame is emitted inline as its title. Other texts
// are regular attached nodes. Path labels are always inline Text children.
export function inlineText(fig: Figure, i: TextItem, parent: Item | undefined): boolean {
	if (!parent) return false;
	const path = parent.kind === 'Line' || parent.kind === 'Connector';
	if (!path) return false;
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
	}
	if (i.node) fig.lines = fig.lines.filter((l) => !(l.t === 'node' && l.n === i.node));
	i.node = undefined;
	return true;
}
