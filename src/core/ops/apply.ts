import { applyLook } from './look';
// Applying an operation to a figure: dispatch to the family handlers, then settle styles, widths and attachments.
import { migratePorts } from '../geometry/migrate-ports';
import { resolvePorts } from '../geometry/ports';
import { applyTree, deleteItem, moveItem, reparent } from './tree';
import { syncTree } from '../model/tree';
import { itemById, ancestors, layerOf } from '../model/tree-queries';
import { normalizeWidth, resolveAttachments } from '../geometry/boxes';
import { Figure } from '../model/figure';
import { nodes } from '../model/queries';
import { Op } from './types';
import { settle } from '../styles/resolve';
import { applyFigure } from './figure';
import { applyLabel } from './label';
import { applyStyle } from './style';
import { applyLayer } from './layer';
import { applyNode } from './node';
import { applyArrow } from './arrow';
import { applyGroup } from './group';

export function apply(fig: Figure, op: Op): void {
	syncTree(fig);
	const oldGroups = new Map(fig.lines.flatMap((l) => (l.t === 'group' ? [[l.g, l.g.parent] as const] : [])));
	const relations = new Map(
		fig.lines.flatMap((l) =>
			l.t === 'node' ? [[l.n, JSON.stringify([l.n.attachment?.parent, l.n.group, l.n.layer])] as const] : [],
		),
	);
	const node = (id: string) => nodes(fig).find((n) => n.id === id);
	switch (op.op) {
		case 'setOverride':
		case 'resetOverride':
		case 'applyToCategory':
		case 'applyToTheme':
		case 'setCategory':
		case 'themeEdit':
		case 'categoryAdd':
		case 'categoryEdit':
		case 'categoryDelete':
			applyLook(fig, op);
			break;
		case 'addText':
		case 'reparent':
		case 'detach':
		case 'ungroup':
		case 'deleteItem':
		case 'addLine':
		case 'line':
		case 'text':
		case 'endpoint':
			applyTree(fig, op);
			break;
		case 'move':
			moveItem(fig, op.id, op.x, op.y);
			break;
		case 'deleteNode':
		case 'deleteGroup':
			deleteItem(fig, op.id);
			break;
		case 'setGroup':
			for (const id of op.ids) reparent(fig, id, op.group || layerOf(fig, id));
			break;
		case 'setLayer':
			for (const id of op.ids) reparent(fig, id, op.layer);
			break;
		case 'figure':
		case 'sheet':
		case 'font':
		case 'arrows':
		case 'legend':
			applyFigure(fig, op, apply);
			break;
		case 'label':
		case 'detachLabel':
		case 'attachLabel':
			applyLabel(fig, op, apply);
			break;
		case 'style':
		case 'styleAdd':
		case 'styleEdit':
		case 'styleUpdate':
		case 'styleDelete':
		case 'resetStyle':
		case 'addCategory':
		case 'category':
		case 'deleteCategory':
			applyStyle(fig, op, apply);
			break;
		case 'mergeLayers':
		case 'duplicateLayer':
		case 'addLayer':
		case 'layerProps':
		case 'deleteLayer':
		case 'reorderLayers':
		case 'hide':
		case 'lock':
			applyLayer(fig, op, apply);
			break;
		case 'attach':
		case 'addNode':
		case 'addEdge':
		case 'node':
		case 'deleteEdge':
		case 'reorder':
			applyNode(fig, op, apply);
			break;
		case 'arrow':
			if (op.fromAnchor !== undefined || op.from !== undefined || op.fromOffset !== undefined) {
				const e = fig.lines.flatMap((l) => (l.t === 'edge' ? [l.e] : []))[op.index];
				if (e) delete e.fromPort;
			}
			if (op.toAnchor !== undefined || op.to !== undefined || op.toOffset !== undefined) {
				const e = fig.lines.flatMap((l) => (l.t === 'edge' ? [l.e] : []))[op.index];
				if (e) delete e.toPort;
			}
			applyArrow(fig, op, apply);
			break;
		case 'addGroup':
		case 'groupProps':
			applyGroup(fig, op, apply);
			break;
		case 'batch': {
			// Move parents first so a selection moves once, regardless of selection order.
			const depth = (id: string) => ancestors(fig, id).length;
			const moves = op.ops.filter((o) => o.op === 'move').sort((a, b) => depth(a.id) - depth(b.id));
			for (const o of op.ops) {
				apply(fig, o.op === 'move' ? moves.shift()! : o);
			}
			break;
		}
	}
	for (const [n, before] of relations)
		if (
			JSON.stringify([n.attachment?.parent, n.group, n.layer]) !== before &&
			!['addText', 'reparent', 'detach', 'ungroup', 'setLayer', 'setGroup', 'batch'].includes(op.op)
		)
			delete n.treeParent;
	for (const [g, parent] of oldGroups) if (g.parent !== parent && op.op === 'groupProps') delete g.treeParent;
	syncTree(fig);
	settle(fig);
	for (const n of nodes(fig)) normalizeWidth(fig, n);
	resolveAttachments(fig);
	if (op.op === 'arrow') migratePorts(fig);
	resolvePorts(fig);
	syncTree(fig);
}
