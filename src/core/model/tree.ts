// The legacy node/group/edge payloads remain adapters for geometry and the current UI.
// parent is the structural authority; group, layer and attachment are projections.
import type { FigEdge, Figure, FigNode } from './figure';
import type { Item, Port, TreeState } from './item';
import { CHILD_RULES } from './item';
import { ancestors, childrenOf, itemById, layerOf, orderedSiblings } from './tree-queries';

const layerIds = (fig: Figure) => fig.lines.flatMap((l) => (l.t === 'layer' ? [l.layer.id] : []));
export const lineItems = (fig: Figure) => orderedSiblings(fig.lines.flatMap((l) => (l.t === 'line' ? [l.line] : [])));
export function payload(i: Item): TreeState {
	return i.kind === 'Frame' ? i.frame : i.kind === 'Connector' ? i.connector : i.kind === 'Line' ? i.line : i.node || i;
}
function port(e: FigEdge, end: 'from' | 'to'): Port {
	const saved = e[end === 'from' ? 'fromPort' : 'toPort'];
	if (saved) return saved;
	const side = e[end === 'from' ? 'fromAnchor' : 'toAnchor'];
	return {
		side: (['north', 'south', 'east', 'west'].includes(side || '') ? side : 'auto') as Port['side'],
		position: 0.5,
	};
}
export function syncTree(fig: Figure): void {
	const old = fig.items || [],
		all: Item[] = [],
		ls = layerIds(fig),
		fallback = ls[0] || 'layer1';
	const used = new Set(
		fig.lines.flatMap((l) =>
			l.t === 'node'
				? [l.n.id]
				: l.t === 'group'
					? [l.g.id]
					: l.t === 'line'
						? [l.line.id]
						: l.t === 'edge' && l.e.id
							? [l.e.id]
							: [],
		),
	);
	const fresh = (base: string) => {
		let id = base,
			n = 2;
		while (used.has(id)) id = base + '-' + n++;
		used.add(id);
		return id;
	};
	const base = (p: TreeState, id: string, parent: string) => ({
		id,
		parent: p.treeParent ?? parent,
		order: p.order ?? all.length,
		hidden: !!p.hidden,
		locked: !!p.locked,
	});
	const text = (
		owner: Item,
		value: string,
		code = '',
		placement?: import('./figure').LabelStyle,
		slot = 0,
		preferred?: string,
	) => {
		const prior = old.find(
			(i) =>
				i.kind === 'Text' &&
				!i.node &&
				i.parent === owner.id &&
				i.role === (owner.kind === 'Shape' || owner.kind === 'Frame' ? 'title' : 'label') &&
				i.order === slot,
		);
		all.push({
			...base(
				{},
				preferred ||
					prior?.id ||
					fresh(owner.id + (owner.kind === 'Shape' || owner.kind === 'Frame' ? '-title' : '-label-' + slot)),
				owner.id,
			),
			kind: 'Text',
			text: value,
			code,
			order: slot,
			role: owner.kind === 'Shape' || owner.kind === 'Frame' ? 'title' : 'label',
			placement,
			hidden: prior?.hidden ?? placement?.hidden ?? false,
			locked: prior?.locked ?? placement?.locked ?? false,
		});
	};
	for (const l of fig.lines) {
		if (l.t === 'node') {
			const n = l.n,
				b = base(n, n.id, n.attachment?.parent || n.group || n.layer || fallback);
			const i: Item =
				n.kind === 'label'
					? {
							...b,
							kind: 'Text',
							text: n.title,
							code: n.code,
							node: n,
							attachment: n.attachment,
							placement: n.labelPlacement,
						}
					: { ...b, kind: n.kind === 'icon' ? 'Icon' : 'Shape', node: n };
			all.push(i);
			if (i.kind === 'Shape') text(i, n.title, n.code, undefined, 0, n.titleId);
		} else if (l.t === 'group') {
			const g = l.g;
			const member = fig.lines.find((x) => x.t === 'node' && x.n.group === g.id);
			const i: Item = {
				...base(g, g.id, g.parent || (member?.t === 'node' && member.n.layer) || fallback),
				kind: 'Frame',
				frame: g,
			};
			all.push(i);
			text(i, g.name, '', g.labelStyle, 0, g.titleId);
		} else if (l.t === 'line') {
			const p = l.line,
				i: Item = { ...base(p, p.id, p.group || p.layer || fallback), kind: 'Line', line: p };
			all.push(i);
			p.labels?.forEach((v, k) => text(i, v.text, '', v.style, k, v.id));
		} else if (l.t === 'edge') {
			const e = l.e;
			e.id ||= fresh('connector');
			const prior = old.find((i) => i.id === e.id && i.kind === 'Connector');
			const i: Item = {
				...base(e, e.id, fallback),
				kind: 'Connector',
				connector: e,
				source: { id: e.from, port: port(e, 'from') },
				target: { id: e.to, port: port(e, 'to') },
			};
			if (prior?.kind === 'Connector') {
				if (prior.source.id === e.from && prior.source.port.side === i.source.port.side)
					i.source.port = prior.source.port;
				if (prior.target.id === e.to && prior.target.port.side === i.target.port.side)
					i.target.port = prior.target.port;
			}
			all.push(i);
			if (e.label) text(i, e.label, '', e.labelStyle, 0, e.labelId);
			e.labels?.forEach((v, k) => text(i, v.text, '', v.style, k + 1, v.id));
		}
	}
	fig.items = all;
	// Repair invalid legacy relations and cycles deterministically, without losing items.
	for (const i of all) {
		const p = itemById(fig, i.parent);
		if (
			i.parent === i.id ||
			ancestors(fig, i.id).some((a) => a.parent === i.id) ||
			(p && !CHILD_RULES[p.kind].includes(i.kind)) ||
			(!p && !ls.includes(i.parent) && i.parent !== fallback)
		)
			i.parent = fallback;
	}
	for (const i of all.filter((i) => i.kind === 'Connector')) {
		if (i.kind !== 'Connector') continue;
		const frames = (id: string) =>
			[itemById(fig, id), ...ancestors(fig, id)].filter((p): p is Item => !!p && p.kind === 'Frame');
		const a = frames(i.source.id),
			b = frames(i.target.id);
		i.parent = a.find((p) => b.some((q) => q.id === p.id))?.id || layerOf(fig, i.source.id) || fallback;
	}
	projectTree(fig);
}
export function projectTree(fig: Figure): void {
	for (const i of fig.items || []) {
		const p = payload(i);
		p.treeParent = i.parent;
		p.order = i.order;
		if (i.kind === 'Connector') {
			i.connector.fromPort = i.source.port;
			i.connector.toPort = i.target.port;
		}
		if (i.kind === 'Text' && !i.node) {
			const owner = itemById(fig, i.parent);
			if (owner?.kind === 'Shape') {
				owner.node.titleId = i.id;
				owner.node.titleHidden = i.hidden || undefined;
			}
			if (owner?.kind === 'Frame') owner.frame.titleId = i.id;
			if (owner?.kind === 'Line' && owner.line.labels?.[i.order]) owner.line.labels[i.order].id = i.id;
			if (owner?.kind === 'Connector') {
				if (i.order === 0) owner.connector.labelId = i.id;
				else if (owner.connector.labels?.[i.order - 1]) owner.connector.labels[i.order - 1].id = i.id;
			}
		}
		if (i.kind === 'Text' && !i.node && (i.hidden || !!i.placement?.hidden)) {
			const owner = itemById(fig, i.parent);
			if (owner?.kind === 'Shape') owner.node.titleHidden = i.hidden;
			if (owner?.kind === 'Frame') owner.frame.labelStyle = { ...owner.frame.labelStyle, hidden: i.hidden };
			if (owner?.kind === 'Line' && owner.line.labels?.[i.order])
				owner.line.labels[i.order].style = { ...owner.line.labels[i.order].style, hidden: i.hidden };
			if (owner?.kind === 'Connector') {
				if (i.order === 0) owner.connector.labelStyle = { ...owner.connector.labelStyle, hidden: i.hidden };
				else if (owner.connector.labels?.[i.order - 1])
					owner.connector.labels[i.order - 1].style = {
						...owner.connector.labels[i.order - 1].style,
						hidden: i.hidden,
					};
			}
		}
		if (i.kind === 'Shape' || i.kind === 'Icon' || (i.kind === 'Text' && i.node)) {
			const n = i.node as FigNode;
			n.layer = layerOf(fig, i.id);
			n.group = ancestors(fig, i.id).find((p) => p.kind === 'Frame')?.id || '';
			const parent = itemById(fig, i.parent);
			if (parent?.kind !== 'Shape') delete n.attachment;
		} else if (i.kind === 'Frame') i.frame.parent = itemById(fig, i.parent)?.kind === 'Frame' ? i.parent : '';
		else if (i.kind === 'Line') {
			i.line.layer = layerOf(fig, i.id);
			i.line.group = ancestors(fig, i.id).find((p) => p.kind === 'Frame')?.id || '';
		}
	}
}
export function setParent(fig: Figure, id: string, parent: string, index?: number): void {
	const i = itemById(fig, id),
		p = itemById(fig, parent);
	if (!i) return;
	if (i.kind === 'Connector') throw new Error('Connector placement is automatic');
	if (!p && ![...layerIds(fig), 'layer1'].includes(parent)) throw new Error('Unknown parent: ' + parent);
	if (p && !CHILD_RULES[p.kind].includes(i.kind)) throw new Error(p.kind + ' cannot contain ' + i.kind);
	if (parent === id || ancestors(fig, parent).some((a) => a.id === id)) throw new Error('Parent would create a cycle');
	i.parent = parent;
	const siblings = childrenOf(fig, parent).filter((c) => c !== i);
	siblings.splice(Math.max(0, Math.min(index ?? siblings.length, siblings.length)), 0, i);
	siblings.forEach((c, k) => {
		c.order = k;
		payload(c).order = k;
	});
	projectTree(fig);
}
