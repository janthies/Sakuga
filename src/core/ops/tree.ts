import { defaultSlot, slotAt, BOX_SLOTS, LINE_SLOTS } from '../model/slots';
import { lineLabel } from '../geometry/line-geometry';
import { fontSize } from '../model/queries';
import { inlineText } from './inline-text';
import type { Figure, FigNode } from '../model/figure';
import type { Item, TextItem } from '../model/item';
import { childrenOf, descendants, itemById, layerOf } from '../model/tree-queries';
import { payload, projectTree, setParent, syncTree } from '../model/tree';
import { insert } from '../model/lines';
import { geometryOf } from '../geometry/figure-geometry';
import type { TreeOp } from './types';

function removeText(fig: Figure, i: TextItem) {
	const p = itemById(fig, i.parent);
	if (p?.kind === 'Shape') {
		p.node.title = '';
		p.node.code = '';
		delete p.node.titleId;
	}
	if (p?.kind === 'Frame') {
		p.frame.name = '';
		delete p.frame.titleId;
	}
	if (p?.kind === 'Connector') {
		if (i.order === 0) {
			p.connector.label = '';
			delete p.connector.labelId;
			delete p.connector.labelStyle;
		} else p.connector.labels?.splice(i.order - 1, 1);
	}
	if (p?.kind === 'Line') p.line.labels?.splice(i.order, 1);
}
export function deleteItem(fig: Figure, id: string) {
	const i = itemById(fig, id);
	if (!i) return;
	if (i.kind === 'Text' && !i.node) removeText(fig, i);
	const gone = new Set([id, ...descendants(fig, id).map((c) => c.id)]);
	for (const c of fig.items || [])
		if (c.kind === 'Connector' && (gone.has(c.source.id) || gone.has(c.target.id))) gone.add(c.id);
	fig.lines = fig.lines.filter((l) =>
		l.t === 'node'
			? !gone.has(l.n.id)
			: l.t === 'group'
				? !gone.has(l.g.id)
				: l.t === 'line'
					? !gone.has(l.line.id)
					: l.t === 'edge'
						? !gone.has(l.e.id || '')
						: true,
	);
	fig.items = fig.items?.filter((c) => !gone.has(c.id));
}
function textNode(fig: Figure, i: TextItem): FigNode {
	if (i.node) return i.node;
	const p = itemById(fig, i.parent),
		geo = geometryOf(fig);
	let point: number[] = [0, 0];
	if (p?.kind === 'Shape') point = [p.node.x, p.node.y];
	if (p?.kind === 'Frame') point = geo.frameTitle(p.frame)?.p || [0, 0];
	if (p?.kind === 'Connector') point = geo.label(p.connector, i.placement, i.text)?.p || [0, 0];
	if (p?.kind === 'Line')
		point = lineLabel(p.line, i.text, i.placement, fontSize(fig), fig.theme?.kinds?.Shape?.outerGap).p;

	return {
		id: i.id,
		kind: 'label',
		title: i.text,
		code: i.code || '',
		x: point[0],
		y: point[1],
		width: 26,
		minh: 0,
		cat: '',
		layer: layerOf(fig, i.id),
		group: '',
		hidden: i.hidden,
		locked: i.locked,
		extra: [],
		style: { compact: true, font: i.placement?.font, textColor: i.placement?.color },
	};
}
export function reparent(fig: Figure, id: string, parent: string, index?: number, makeTitle = false) {
	syncTree(fig);
	let i = itemById(fig, id);
	if (!i) return;
	// Validate before changing a label's representation.
	const original = i.parent,
		originalOrder = i.order;
	const wasInline = i.kind === 'Text' && !i.node;
	const free = i.kind === 'Text' && wasInline ? textNode(fig, i) : undefined;
	setParent(fig, id, parent, index);
	if (i.kind === 'Text' && wasInline) {
		const newOrder = i.order;
		i.parent = original;
		i.order = originalOrder;
		const n = free!;
		removeText(fig, i);
		i.parent = parent;
		i.order = newOrder;
		n.treeParent = parent;
		n.order = i.order;
		insert(fig, { t: 'node', n });
		i.node = n;
		i.role = undefined;
	}
	const p = itemById(fig, parent);
	if (i.kind === 'Text' && (p?.kind === 'Line' || p?.kind === 'Connector') && inlineText(fig, i, p)) {
		projectTree(fig);
		syncTree(fig);
		return;
	}
	if (p?.kind === 'Shape')
		i.slot = defaultSlot(
			childrenOf(fig, parent)
				.filter((c) => c.id !== id)
				.map((c) => c.slot || ''),
		);
	else delete i.slot;
	payload(i).slot = i.slot;
	delete payload(i).attachment;

	projectTree(fig);
	syncTree(fig);
}
export function detach(fig: Figure, id: string) {
	syncTree(fig);
	const i = itemById(fig, id),
		p = i && itemById(fig, i.parent);
	if (i?.kind === 'Frame') {
		ungroup(fig, id);
		return;
	}
	if (p) reparent(fig, id, p.parent);
}
export function ungroup(fig: Figure, id: string) {
	syncTree(fig);
	const g = itemById(fig, id);
	if (g?.kind !== 'Frame') {
		detach(fig, id);
		return;
	}
	for (const c of childrenOf(fig, id))
		if (c.kind !== 'Connector' && !(c.kind === 'Text' && c.role === 'title')) reparent(fig, c.id, g.parent);
	deleteItem(fig, id);
	syncTree(fig);
}
export function moveItem(fig: Figure, id: string, x: number, y: number) {
	const i = itemById(fig, id);
	if (!i) return;
	const geo = geometryOf(fig),
		n = 'node' in i ? i.node : undefined;
	const origin = n
		? [n.x, n.y]
		: i.kind === 'Line'
			? i.line.start
			: i.kind === 'Frame'
				? (() => {
						const b = geo.frame(id);
						return b ? [b.x, b.y] : [0, 0];
					})()
				: [0, 0];
	const dx = x - origin[0],
		dy = y - origin[1];
	const parent = itemById(fig, i.parent);
	if (parent?.kind === 'Shape') {
		const b = geo.node(parent.id);
		if (b) {
			i.slot = slotAt(b, { x, y });
			payload(i).slot = i.slot;
		}
		return;
	}

	for (const c of [i, ...descendants(fig, id)]) {
		if (c.kind === 'Line') {
			c.line.start = [c.line.start[0] + dx, c.line.start[1] + dy];
			c.line.end = [c.line.end[0] + dx, c.line.end[1] + dy];
		}
		const node = 'node' in c ? c.node : undefined;
		if (node) {
			node.x += dx;
			node.y += dy;
		}
		if (c.kind === 'Connector') {
			c.connector.waypoints = c.connector.waypoints?.map((p) => [p[0] + dx, p[1] + dy]);
			if (c.connector.mid !== null) c.connector.mid += c.connector.route === 'hvh' ? dx : dy;
		}
	}
}
export function applyTree(fig: Figure, op: TreeOp) {
	switch (op.op) {
		case 'slot': {
			const i = itemById(fig, op.id),
				p = i && itemById(fig, i.parent);
			if (!i) break;
			const allowed = p?.kind === 'Shape' ? BOX_SLOTS : p?.kind === 'Line' ? LINE_SLOTS : [];
			if (!(allowed as readonly string[]).includes(op.slot)) throw new Error('Invalid slot');
			i.slot = op.slot;
			payload(i).slot = op.slot;
			if (i.kind === 'Text' && !i.node && p?.kind === 'Line') {
				const [at, side] = op.slot.split('-');
				const st = { ...i.placement, pos: at === 'start' ? 0 : at === 'end' ? 1 : 0.5, side };
				i.placement = st;
				if (p.line.labels?.[i.order]) p.line.labels[i.order].style = st;
			}
			break;
		}
		case 'addText': {
			if (itemById(fig, op.id)) throw new Error('Duplicate item id: ' + op.id);
			const n: FigNode = {
				labelPlacement: op.placement,
				slot: op.slot,
				id: op.id,
				kind: 'label',
				title: op.text,
				code: op.code || '',
				x: op.x || 0,
				y: op.y || 0,
				width: 26,
				minh: 0,
				cat: '',
				layer: '',
				group: '',
				hidden: false,
				locked: false,
				extra: [],
			};
			insert(fig, { t: 'node', n });
			syncTree(fig);
			const i = itemById(fig, op.id);
			if (i?.kind === 'Text') i.placement = op.placement;
			reparent(fig, op.id, op.parent, op.index, true);
			if (op.slot) {
				const item = itemById(fig, op.id);
				if (item) {
					item.slot = op.slot;
					payload(item).slot = op.slot;
				}
			}
			break;
		}
		case 'reparent':
			reparent(fig, op.id, op.newParent, op.index);
			break;
		case 'detach':
			detach(fig, op.id);
			break;
		case 'ungroup':
			ungroup(fig, op.id);
			break;
		case 'deleteItem':
			deleteItem(fig, op.id);
			break;
		case 'addLine':
			insert(fig, {
				t: 'line',
				line: {
					id: op.id,
					start: [...op.start],
					end: [...op.end],
					treeParent: op.parent,
					layer: op.layer,
					style: op.style,
					labels: op.labels,
					extra: [],
				},
			});
			break;
		case 'line': {
			const i = itemById(fig, op.id);
			if (i?.kind === 'Line' && i.slot && (op.start || op.end)) {
				const a = op.start || i.line.start,
					b = op.end || i.line.end;
				i.line.vector = [b[0] - a[0], b[1] - a[1]];
			}
			if (i?.kind === 'Line')
				Object.assign(
					i.line,
					Object.fromEntries(
						Object.entries(op).filter(([k]) => k !== 'op' && k !== 'id' && (!i.slot || !['start', 'end'].includes(k))),
					),
				);
			break;
		}
		case 'text': {
			const i = itemById(fig, op.id);
			if (i?.kind !== 'Text') break;
			if (i.node) {
				if (op.text !== undefined) i.node.title = op.text;
				if (op.code !== undefined) i.node.code = op.code;
			} else {
				const p = itemById(fig, i.parent),
					value = op.text ?? i.text;
				if (p?.kind === 'Shape') {
					p.node.title = value;
					p.node.code = op.code ?? i.code ?? '';
				}
				if (p?.kind === 'Frame') p.frame.name = value;
				if (p?.kind === 'Line' && p.line.labels?.[i.order])
					p.line.labels[i.order] = { text: value, style: op.placement ?? i.placement };
				if (p?.kind === 'Connector') {
					if (i.order === 0) {
						p.connector.label = value;
						p.connector.labelStyle = op.placement ?? i.placement;
					} else if (p.connector.labels?.[i.order - 1])
						p.connector.labels[i.order - 1] = { text: value, style: op.placement ?? i.placement };
				}
			}
			break;
		}
		case 'endpoint': {
			const i = itemById(fig, op.id),
				target = itemById(fig, op.endpoint.id);
			if (i?.kind !== 'Connector' || !target || !['Shape', 'Frame', 'Line'].includes(target.kind))
				throw new Error('Invalid connector endpoint');
			const e = i.connector,
				p = op.endpoint.port;
			if (
				!['auto', 'north', 'south', 'east', 'west'].includes(p.side) ||
				!Number.isFinite(p.position) ||
				p.position < 0 ||
				p.position > 1
			)
				throw new Error('Invalid port position');
			i[op.end] = op.endpoint;
			const end = op.end === 'source' ? 'from' : 'to';
			e[end] = target.id;
			e[end === 'from' ? 'fromPort' : 'toPort'] = p;
			e[end === 'from' ? 'fromAnchor' : 'toAnchor'] = p.side === 'auto' ? undefined : p.side;
			e[end === 'from' ? 'fromOffset' : 'toOffset'] = undefined;
			break;
		}
	}
	syncTree(fig);
}
