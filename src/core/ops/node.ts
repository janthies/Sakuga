import { reparent, detach } from './tree';
import { payload } from '../model/tree';
import { childrenOf } from '../model/tree-queries';
import { legacySlot } from '../model/slots';
// Operations on boxes and the arrows between them.
import { itemById } from '../model/tree-queries';
import { ANCHORS, DEFAULT_WIDTH } from '../model/constants';
import { Figure } from '../model/figure';
import { insert } from '../model/lines';
import { edges, findStyle, layers, nodeStyleKind, nodes } from '../model/queries';
import { styleable } from '../schema';
import type { NodeOp, Run } from './types';

export function applyNode(fig: Figure, op: NodeOp, run: Run): void {
	const node = (id: string) => nodes(fig).find((n) => n.id === id);
	switch (op.op) {
		case 'attach': {
			if (op.attachment) {
				reparent(fig, op.id, op.attachment.parent);
				const i = itemById(fig, op.id);
				if (i) {
					i.slot = legacySlot(op.attachment.anchor, op.attachment.ownAnchor, op.attachment.dx, op.attachment.dy);
					payload(i).slot = i.slot;
				}
			} else detach(fig, op.id);
			break;
		}
		case 'addNode':
			insert(fig, {
				t: 'node',
				n: {
					categoryMarker: op.categoryMarker,
					treeParent: op.parent,
					slot: op.slot,
					wantWidth: op.wantWidth,
					codeFont: op.codeFont,
					titlePosition: op.titlePosition,
					attachment: op.attachment && { ...op.attachment },
					style: op.style,
					id: op.id,
					cat: op.cat,
					x: op.x,
					y: op.y,
					title: op.title,
					icon: op.icon,
					iconPosition: op.iconPosition,
					kind: op.kind,
					code: op.code ?? '',
					width: op.width ?? DEFAULT_WIDTH,
					minh: op.minh ?? 0,
					layer: layers(fig).find((l) => l.id === op.layer)?.id ?? layers(fig)[0].id,
					group: '',
					hidden: false,
					locked: false,
					extra: op.extra ?? [],
				},
			});
			if (op.from) {
				insert(fig, {
					t: 'edge',
					e: {
						from: op.from,
						to: op.id,
						kind: 'arr',
						route: 'auto',
						mid: null,
						bend: 0,
						head: 'end',
						label: '',
						extra: [],
					},
				});
			}
			break;
		case 'addEdge':
			for (const id of [op.source?.id || op.from, op.target?.id || op.to]) {
				const i = itemById(fig, id);
				if (!i || !['Shape', 'Frame', 'Line'].includes(i.kind)) throw new Error('Invalid connector endpoint: ' + id);
			}
			insert(fig, {
				t: 'edge',
				e: {
					id: op.id,
					fromPort: op.source?.port,
					toPort: op.target?.port,
					...(op.styleKey ? { styleKey: op.styleKey } : {}),
					labelStyle: op.labelStyle && { ...op.labelStyle },
					labels: op.labels?.map((l) => ({ ...l, style: { ...l.style } })),
					...Object.fromEntries(
						[
							'fromOffset',
							'toOffset',
							'loopSide',
							'loopSize',
							'loopOut',
							'loopIn',
							'looseness',
							'loopMax',
							'chain',
							'waypoints',
						]
							.filter((k) => (op as any)[k] !== undefined)
							.map((k) => [k, (op as any)[k]]),
					),
					fromAnchor: op.fromAnchor,
					toAnchor: op.toAnchor,
					lane: op.lane,
					style: op.style,
					from: op.source?.id || op.from,
					to: op.target?.id || op.to,
					...(op.source ? { fromAnchor: op.source.port.side === 'auto' ? undefined : op.source.port.side } : {}),
					...(op.target ? { toAnchor: op.target.port.side === 'auto' ? undefined : op.target.port.side } : {}),
					kind: op.kind ?? 'arr',
					route: op.route ?? 'auto',
					mid: op.mid ?? null,
					bend: op.bend ?? 0,
					head: op.head ?? 'end',
					label: op.label ?? '',
					extra: op.extra ?? [],
				},
			});
			break;
		case 'node': {
			const n = node(op.id);
			if (n) {
				if (op.titlePosition !== undefined && ANCHORS.includes(op.titlePosition)) {
					const label = childrenOf(fig, n.id).find((i) => i.kind === 'Text');
					if (label) {
						label.slot = legacySlot(op.titlePosition);
						payload(label).slot = label.slot;
					}
				}
				if (op.icon !== undefined) {
					n.icon = op.icon;
				}
				if (op.iconPosition !== undefined) {
					n.iconPosition = op.iconPosition;
				}
				if (op.title !== undefined) {
					const label = childrenOf(fig, n.id).find((i) => i.kind === 'Text' && i.slot === 'centre');
					if (!n.kind && label?.kind === 'Text' && label.node) label.node.title = op.title;
					else n.title = op.title;
				}
				if (op.code !== undefined) {
					const label = childrenOf(fig, n.id).find((i) => i.kind === 'Text' && i.slot === 'centre');
					if (!n.kind && label?.kind === 'Text' && label.node) label.node.code = op.code;
					else n.code = op.code;
				}
				if (op.cat !== undefined) n.cat = op.cat;
				if (op.width !== undefined && op.width > 0) {
					n.width = op.width;
					delete n.wantWidth;
				}
				if (op.wantWidth !== undefined && op.wantWidth > 0) n.wantWidth = op.wantWidth;
				if (op.codeFont !== undefined) {
					const label = childrenOf(fig, n.id).find((i) => i.kind === 'Text' && i.slot === 'centre');
					if (!n.kind && label?.kind === 'Text' && label.node) label.node.codeFont = op.codeFont || undefined;
					else n.codeFont = op.codeFont || undefined;
				}
				if (op.minh !== undefined && op.minh >= 0) {
					n.minh = op.minh;
				}
			}
			break;
		}
		case 'deleteEdge': {
			const e = edges(fig)[op.index];
			fig.lines = fig.lines.filter((l) => !(l.t === 'edge' && l.e === e));
			break;
		}
		case 'reorder': {
			// node lines take the new order (bottom to top); everything else stays where it is
			const at = fig.lines.map((l, i) => (l.t === 'node' ? i : -1)).filter((i) => i >= 0);
			const byId = new Map(nodes(fig).map((n) => [n.id, n]));
			const order = [
				...new Set(op.order.filter((id) => byId.has(id))),
				...nodes(fig)
					.map((n) => n.id)
					.filter((id) => !op.order.includes(id)),
			];
			at.forEach((i, k) => {
				const n = byId.get(order[k])!;
				n.order = k;
				fig.lines[i] = { t: 'node', n };
			});
			break;
		}
	}
}
