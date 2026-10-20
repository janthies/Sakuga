import { emitOptions, readOptions } from './options';
// Small structural metadata for identities/order and states of inline Text children.
// Geometry and content stay in ordinary TikZ nodes and paths.
import type { Figure } from '../model/figure';
import { payload, projectTree, syncTree } from '../model/tree';
import { itemById } from '../model/tree-queries';
import { num } from '../util/num';
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
// Preserve sub-centimillimetre geometry that native coordinate formatting rounds off.
// The native source remains authoritative when its emitted coordinate is edited.
function preciseGeometry(i: import('../model/item').Item) {
	const n = 'node' in i ? i.node : undefined;
	const values: Record<string, number> = n
		? { ...(n.attachment ? {} : { x: n.x, y: n.y }), minh: n.minh }
		: i.kind === 'Line'
			? { x1: i.line.start[0], y1: i.line.start[1], x2: i.line.end[0], y2: i.line.end[1] }
			: {};
	const geometry = Object.fromEntries(Object.entries(values).filter(([, v]) => +num(v) !== v));
	return Object.keys(geometry).length ? { geometry } : {};
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
						attachment: payload(i).attachment,
						...preciseGeometry(i),
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
		if (r.parent && (i.kind === 'Frame' || i.kind === 'Line' || (i.kind === 'Text' && !i.node))) i.parent = r.parent;
		if (r.attachment) {
			const a = payload(i).attachment,
				saved = r.attachment;
			const same =
				a &&
				a.parent === saved.parent &&
				a.anchor === saved.anchor &&
				a.ownAnchor === saved.ownAnchor &&
				Math.abs(a.dx - saved.dx) <= 0.0051 &&
				Math.abs(a.dy - saved.dy) <= 0.0051;
			if (i.kind === 'Frame' || i.kind === 'Line' || same) payload(i).attachment = saved;
		}
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
		const geometry = r.geometry || {};
		const close = (a: number, b: number) => Math.abs(a - b) <= 0.0051;
		const n = 'node' in i ? i.node : undefined;
		if (n) {
			for (const k of ['x', 'y', 'minh'] as const)
				if (geometry[k] !== undefined && (k === 'minh' || !n.attachment) && close(n[k], geometry[k]))
					n[k] = geometry[k];
		} else if (i.kind === 'Line') {
			for (const [key, point, axis] of [
				['x1', i.line.start, 0],
				['y1', i.line.start, 1],
				['x2', i.line.end, 0],
				['y2', i.line.end, 1],
			] as const)
				if (geometry[key] !== undefined && close(point[axis], geometry[key])) point[axis] = geometry[key];
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
