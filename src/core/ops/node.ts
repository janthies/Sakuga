// Operations on boxes and the arrows between them.
import { ANCHORS, DEFAULT_WIDTH } from '../model/constants';
import { Figure } from '../model/figure';
import { insert } from '../model/lines';
import { edges, findStyle, layers, nodeStyleKind, nodes } from '../model/queries';
import { STYLEABLE } from '../styles/tables';
import type { NodeOp, Run } from './types';

export function applyNode(fig: Figure, op: NodeOp, run: Run): void {
	const node = (id: string) => nodes(fig).find((n) => n.id === id);
	switch (op.op) {
		case 'attach': {
			const n = node(op.id),
				a = op.attachment;
			if (!n) {
				break;
			}
			if (!a) {
				delete n.attachment;
				break;
			}
			let p = node(a.parent);
			const seen = new Set([n.id]);
			while (p && !seen.has(p.id)) {
				seen.add(p.id);
				p = p.attachment ? node(p.attachment.parent) : undefined;
			}
			if (
				!p &&
				node(a.parent) &&
				!node(a.parent)!.kind &&
				ANCHORS.includes(a.anchor) &&
				ANCHORS.includes(a.ownAnchor) &&
				Number.isFinite(a.dx) &&
				Number.isFinite(a.dy)
			) {
				n.attachment = { ...a };
			}
			break;
		}
		case 'move': {
			const n = node(op.id);
			if (n) {
				if (n.attachment) {
					n.attachment.dx += op.x - n.x;
					n.attachment.dy += op.y - n.y;
				}
				n.x = op.x;
				n.y = op.y;
			}
			break;
		}
		case 'addNode':
			insert(fig, {
				t: 'node',
				n: {
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
			insert(fig, {
				t: 'edge',
				e: {
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
					from: op.from,
					to: op.to,
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
					n.titlePosition = op.titlePosition;
				}
				if (op.icon !== undefined) {
					n.icon = op.icon;
				}
				if (op.iconPosition !== undefined) {
					n.iconPosition = op.iconPosition;
				}
				if (op.title !== undefined) {
					n.title = op.title;
				}
				if (op.code !== undefined) {
					n.code = op.code;
				}
				if (
					op.cat !== undefined &&
					op.cat !== n.cat &&
					(!op.cat || !findStyle(fig, op.cat) || findStyle(fig, op.cat)!.kind === nodeStyleKind(n))
				) {
					const kind = nodeStyleKind(n);
					if (kind && n.style) {
						for (const k of STYLEABLE[kind]) {
							delete (n.style as any)[k];
						}
					}
					n.cat = op.cat;
				}
				if (op.width !== undefined && op.width > 0) {
					n.width = op.width;
					delete n.wantWidth;
				}
				if (op.wantWidth !== undefined && op.wantWidth > 0) n.wantWidth = op.wantWidth;
				if (op.codeFont !== undefined) n.codeFont = op.codeFont || undefined;
				if (op.minh !== undefined && op.minh >= 0) {
					n.minh = op.minh;
				}
			}
			break;
		}
		case 'deleteNode':
			for (const child of nodes(fig)) {
				if (child.attachment?.parent === op.id) {
					delete child.attachment;
				}
			}
			fig.lines = fig.lines.filter(
				(l) => !(l.t === 'node' && l.n.id === op.id) && !(l.t === 'edge' && (l.e.from === op.id || l.e.to === op.id)),
			);
			break;
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
				fig.lines[i] = { t: 'node', n: byId.get(order[k])! };
			});
			break;
		}
	}
}
