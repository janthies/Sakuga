// Small structural metadata for identities/order and states of inline Text children.
// Geometry and content stay in ordinary TikZ nodes and paths.
import type { Figure } from '../model/figure';
import { payload, projectTree, syncTree } from '../model/tree';
import { itemById } from '../model/tree-queries';
import { fromHex, toHex } from '../util/hex';

export function treeState(fig: Figure): string {
	return (
		'% sakuga tree ' +
		toHex(
			JSON.stringify(
				(fig.items || [])
					.slice()
					.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
					.map((i) => ({
						id: i.id,
						kind: i.kind,
						parent: i.parent,
						order: i.order,
						hidden: i.hidden,
						locked: i.locked,
						...(i.kind === 'Connector' ? { source: i.source, target: i.target } : {}),
					})),
			),
		)
	);
}
export function readTreeState(fig: Figure, value: string) {
	const records: any[] = JSON.parse(fromHex(value));
	for (const r of records) {
		let i = itemById(fig, r.id);
		if (!i && r.kind === 'Text') {
			i = fig.items?.find((v) => v.kind === 'Text' && !v.node && v.parent === r.parent && v.order === r.order);
			if (i) i.id = r.id;
		}
		if (!i) continue;
		// Native attachments and sg in remain authoritative when the TikZ is edited.
		// Root frame layers have no legacy group-header field, so they live here.
		if (i.kind === 'Frame' && !i.frame.parent && fig.lines.some((l) => l.t === 'layer' && l.layer.id === r.parent))
			i.parent = r.parent;
		i.order = r.order;
		i.hidden = !!r.hidden;
		i.locked = !!r.locked;
		Object.assign(payload(i), { treeParent: i.parent, order: i.order, hidden: i.hidden, locked: i.locked });
		if (i.kind === 'Connector') {
			if (r.source?.id === i.source.id && r.source.port.side === i.source.port.side) i.source = r.source;
			if (r.target?.id === i.target.id && r.target.port.side === i.target.port.side) i.target = r.target;
			i.connector.fromPort = i.source.port;
			i.connector.toPort = i.target.port;
		}
	}
	projectTree(fig);
	syncTree(fig);
}
