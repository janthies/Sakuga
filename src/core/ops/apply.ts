// Applying an operation to a figure: dispatch to the family handlers, then settle styles, widths and attachments.
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
	const node = (id: string) => nodes(fig).find((n) => n.id === id);
	switch (op.op) {
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
		case 'setLayer':
		case 'hide':
		case 'lock':
			applyLayer(fig, op, apply);
			break;
		case 'attach':
		case 'move':
		case 'addNode':
		case 'addEdge':
		case 'node':
		case 'deleteNode':
		case 'deleteEdge':
		case 'reorder':
			applyNode(fig, op, apply);
			break;
		case 'arrow':
			applyArrow(fig, op, apply);
			break;
		case 'addGroup':
		case 'groupProps':
		case 'deleteGroup':
		case 'setGroup':
			applyGroup(fig, op, apply);
			break;
		case 'batch': {
			// Move parents first so a selection moves once, regardless of selection order.
			const depth = (id: string): number => {
				const seen = new Set<string>();
				let n = node(id);
				while (n?.attachment && !seen.has(n.id)) {
					seen.add(n.id);
					n = node(n.attachment.parent);
				}
				return seen.size;
			};
			const moves = op.ops.filter((o) => o.op === 'move').sort((a, b) => depth(a.id) - depth(b.id));
			for (const o of op.ops) {
				apply(fig, o.op === 'move' ? moves.shift()! : o);
			}
			break;
		}
	}
	settle(fig);
	for (const n of nodes(fig)) normalizeWidth(fig, n);
	resolveAttachments(fig);
}
