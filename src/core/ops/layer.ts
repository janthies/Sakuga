// Operations on layers.
import { Figure } from '../model/figure';
import { insert, materializeLayers } from '../model/lines';
import { edges, groupMembers, groups, layers, nodeLayer, nodes, opacity } from '../model/queries';
import { slugKey } from './style-helpers';
import type { LayerOp, Run } from './types';

export function applyLayer(fig: Figure, op: LayerOp, run: Run): void {
	switch (op.op) {
		case 'mergeLayers':
			if (layers(fig).some((l) => l.id === op.target)) {
				for (const n of nodes(fig)) {
					if (op.ids.includes(nodeLayer(fig, n).id)) {
						n.layer = op.target;
					}
				}
				fig.lines = fig.lines.filter(
					(l) => !(l.t === 'layer' && op.ids.includes(l.layer.id) && l.layer.id !== op.target),
				);
			}
			break;
		case 'duplicateLayer': {
			materializeLayers(fig);
			const source = layers(fig).find((l) => l.id === op.id);
			if (!source || layers(fig).some((l) => l.id === op.newId)) {
				break;
			}
			const ns = nodes(fig).filter((n) => n.layer === op.id),
				map = new Map<string, string>();
			const used = [...nodes(fig).map((n) => n.id), ...groups(fig).map((g) => g.id)];
			const fresh = (id: string) => {
				const key = slugKey(id + '-copy', used);
				used.push(key);
				map.set(id, key);
				return key;
			};
			const gs = groups(fig).filter((g) => ns.some((n) => groupMembers(fig, g.id).includes(n)));
			gs.forEach((g) => fresh(g.id));
			ns.forEach((n) => fresh(n.id));
			const es = edges(fig).filter((e) => map.has(e.from) && map.has(e.to));
			const at = fig.lines.findIndex((l) => l.t === 'layer' && l.layer.id === op.id);
			fig.lines.splice(at + 1, 0, { t: 'layer', layer: { ...source, id: op.newId, name: source.name + ' copy' } });
			gs.forEach((g) => insert(fig, { t: 'group', g: { ...g, id: map.get(g.id)!, parent: map.get(g.parent) || '' } }));
			ns.forEach((n) =>
				insert(fig, {
					t: 'node',
					n: {
						...n,
						attachment: n.attachment
							? { ...n.attachment, parent: map.get(n.attachment.parent) || n.attachment.parent }
							: undefined,
						id: map.get(n.id)!,
						layer: op.newId,
						group: map.get(n.group) || '',
						style: { ...n.style },
						extra: [...n.extra],
					},
				}),
			);
			es.forEach((e) =>
				insert(fig, {
					t: 'edge',
					e: {
						...e,
						labelStyle: e.labelStyle && { ...e.labelStyle },
						labels: e.labels?.map((l) => ({ ...l, style: { ...l.style } })),
						from: map.get(e.from)!,
						to: map.get(e.to)!,
						style: { ...e.style },
						extra: [...e.extra],
					},
				}),
			);
			break;
		}
		case 'addLayer':
			materializeLayers(fig);
			if (!layers(fig).some((l) => l.id === op.id)) {
				insert(fig, {
					t: 'layer',
					layer: { id: op.id, name: op.name.replace(/[{}\r\n]/g, ''), hidden: false, locked: false },
				});
			}
			break;
		case 'layerProps': {
			materializeLayers(fig);
			const l = layers(fig).find((l) => l.id === op.id);
			if (l) {
				if (op.name !== undefined) {
					l.name = op.name.replace(/[{}\r\n]/g, '');
				}
				if (op.hidden !== undefined) {
					l.hidden = op.hidden;
				}
				if (op.locked !== undefined) {
					l.locked = op.locked;
				}
				if (op.opacity !== undefined) {
					l.opacity = opacity(op.opacity);
				}
			}
			break;
		}
		case 'deleteLayer': {
			materializeLayers(fig);
			const ls = layers(fig),
				i = ls.findIndex((l) => l.id === op.id);
			if (i < 0 || ls.length === 1) {
				break;
			}
			for (const n of nodes(fig)) {
				if (n.layer === op.id) {
					n.layer = ls[i > 0 ? i - 1 : 1].id;
				}
			}
			fig.lines = fig.lines.filter((l) => !(l.t === 'layer' && l.layer.id === op.id));
			break;
		}
		case 'reorderLayers': {
			materializeLayers(fig);
			const ls = layers(fig);
			const order = [...new Set(op.order)].flatMap((id) => ls.filter((l) => l.id === id));
			order.push(...ls.filter((l) => !order.includes(l)));
			let i = 0;
			for (const l of fig.lines) {
				if (l.t === 'layer') {
					l.layer = order[i++];
				}
			}
			break;
		}
		case 'setLayer': {
			if (!layers(fig).some((l) => l.id === op.layer)) {
				break;
			}
			const moving = new Set(
				op.ids.flatMap((id) => (groups(fig).some((g) => g.id === id) ? groupMembers(fig, id).map((n) => n.id) : [id])),
			);
			for (const n of nodes(fig)) {
				if (!moving.has(n.id)) {
					continue;
				}
				n.layer = op.layer;
				if (!op.ids.some((id) => groups(fig).some((g) => g.id === id) && groupMembers(fig, id).includes(n))) {
					n.group = '';
				}
			}
			for (const g of groups(fig)) {
				if (op.ids.includes(g.id) && g.parent && !op.ids.includes(g.parent)) {
					g.parent = '';
				}
			}
			break;
		}
		case 'hide':
			for (const n of nodes(fig)) {
				if (op.ids.includes(n.id)) {
					n.hidden = op.hidden;
				}
			}
			break;
		case 'lock':
			for (const n of nodes(fig)) {
				if (op.ids.includes(n.id)) {
					n.locked = op.locked;
				}
			}
			break;
	}
}
