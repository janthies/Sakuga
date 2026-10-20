import { emitOptions, readOptions } from './options';
// Small structural metadata for identities/order and states of inline Text children.
// Geometry and content stay in ordinary TikZ nodes and paths.
import type { Figure } from '../model/figure';
import { payload, projectTree, syncTree } from '../model/tree';
import { itemById } from '../model/tree-queries';
import { fromHex, toHex } from '../util/hex';

function unwritten(i: import('../model/item').Item) {
	if (i.kind === 'Frame' || (i.kind === 'Text' && !i.node)) return {};
	const own = payload(i).look?.own || {};
	const arrow = i.kind === 'Connector' || i.kind === 'Line';
	const rendered = readOptions(
		emitOptions(own, { arrow, forceDefaults: true, effective: payload(i).look?.resolved }),
		arrow,
	).style as Record<string, any>;
	const defaults = Object.fromEntries(Object.entries(own).filter(([k, v]) => v !== undefined && rendered[k] !== v));
	const implicit = Object.fromEntries(
		Object.entries(rendered).filter(([k, v]) => v !== undefined && own[k] === undefined),
	);
	return {
		...(Object.keys(defaults).length ? { defaults } : {}),
		...(Object.keys(implicit).length ? { implicit } : {}),
	};
}
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
						...unwritten(i),
						...(i.kind === 'Text' && !i.node ? { cat: i.cat, overrides: i.look?.own } : {}),
						...(i.kind === 'Frame' ? { cat: i.frame.cat, overrides: i.frame.look?.own } : {}),
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
		if ((i.kind === 'Text' && !i.node) || i.kind === 'Frame') {
			const p = payload(i);
			p.cat = r.cat;
			if (r.overrides) p.look = { own: r.overrides, resolved: i.kind === 'Frame' ? { ...i.frame } : {} };
		}
		if ((r.defaults || r.implicit) && i.kind !== 'Frame' && !(i.kind === 'Text' && !i.node)) {
			const p = payload(i);
			if (p.look) {
				for (const [k, v] of Object.entries(r.implicit || {})) if (p.look.own[k] === v) delete p.look.own[k];
				p.look.own = { ...r.defaults, ...p.look.own };
			}
		}
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
