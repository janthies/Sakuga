// @ts-nocheck
import { store } from '../store/store';
import { svg } from '../platform/dom';
import { attachmentFor, byId, descendant, fine, nodeAt, post, snap, toMm } from '../store/model';
import { fixedUpdate } from './guides';
import { edgeGeom } from '../render/edges';
import { labelTarget } from '../render/labelgeom';
import { endpointTarget } from '../render/anchors';
import { duplicate } from '../commands/clipboard';
import { labelDrop } from './edit';
import { render } from '../render/scene';
import { newId } from '../store/layers';

export function initToolsPointerup() {
	svg.addEventListener('pointerup', (ev) => {
		const d = store.drag;
		store.drag = null;
		if (d?.segment !== undefined && d.changed) {
			post({
				op: 'arrow',
				index: d.segment,
				...fixedUpdate(store.edges[d.segment], edgeGeom(store.edges[d.segment]).pts),
			});
		} else if (d?.label && d.changed) {
			const target = labelTarget(d.label);
			post(
				target.g
					? {
							op: 'batch',
							ops: [
								{ op: 'label', ...d.label, style: target.style },
								{ op: 'groupProps', id: target.g.id, titlePosition: target.g.titlePosition },
							],
						}
					: { op: 'label', ...d.label, style: target.style },
			);
		} else if (d && d.endpoint !== undefined) {
			const target = endpointTarget(toMm(ev), ev.altKey);
			if (target)
				post({
					op: 'arrow',
					index: d.endpoint,
					[d.end]: target.id,
					[d.end + 'Anchor']: target.anchor,
					[d.end + 'Offset']: target.offset ?? 0,
				});
		} else if (d && d.move && (d.dx || d.dy)) {
			if (d.copy) {
				duplicate([...d.orig.keys()], d.dx, d.dy);
			} else {
				const ops = [...d.orig.keys()].map((id) => ({ op: 'move', id, x: byId(id).x, y: byId(id).y }));
				if (!ev.altKey && d.orig.size === 1) {
					const id = [...d.orig.keys()][0],
						n = byId(id),
						drop = labelDrop(toMm(ev), n);
					if (drop) {
						ops.push({ op: 'attachLabel', id, ...drop });
						d.target = null;
					}
				}
				if (d.target && !ev.altKey) {
					for (const id of d.orig.keys()) {
						if (
							byId(id).attachment?.parent === d.target.parent.id ||
							[...d.orig.keys()].some((parent) => descendant(id, parent))
						) {
							continue;
						}
						ops.push({ op: 'attach', id, attachment: attachmentFor(byId(id), d.target.parent, d.target.anchor) });
					}
				}
				post({ op: 'batch', ops });
			}
		} else if (d && d.mid !== undefined && d.changed) {
			const e = store.edges[d.mid];
			post({
				op: 'arrow',
				index: d.mid,
				route: e.route,
				mid: e.mid,
				bend: e.bend,
				...(e.from === e.to ? { loopSize: e.loopSize } : {}),
			});
		} else if (d && d.scale && d.changed) {
			const ops = [];
			for (const id of d.orig.keys()) {
				const n = byId(id);
				ops.push(
					{ op: 'node', id, width: fine(n.width), ...(n.minh ? { minh: fine(n.minh) } : {}) },
					{ op: 'move', id, x: fine(n.x), y: fine(n.y) },
				);
			}
			post({ op: 'batch', ops });
		} else if (d && d.resize && d.changed) {
			const n = byId(d.id);
			const ops = [
				{ op: 'node', id: n.id, width: n.width, ...(/[ns]/.test(d.resize) ? { minh: n.minh } : {}) },
				{ op: 'move', id: n.id, x: n.x, y: n.y },
			];
			post({ op: 'batch', ops });
		} else if (d && d.connect) {
			const from = byId(d.connect);
			const endpoint = endpointTarget(toMm(ev));
			if (endpoint && endpoint.id === from.id) {
				post({ op: 'addEdge', from: from.id, to: from.id, route: 'loop', loopSide: endpoint.anchor });
				render();
				return;
			}
			if (endpoint && endpoint.id !== from.id) {
				const start = endpointTarget({ x: d.startX ?? from.x, y: d.startY ?? from.y });
				post({
					op: 'addEdge',
					from: from.id,
					to: endpoint.id,
					fromAnchor: d.startAnchor || start?.anchor,
					toAnchor: endpoint.anchor,
					fromOffset: start?.offset ?? 0,
					toOffset: endpoint.offset ?? 0,
				});
				render();
				return;
			}
			const target = nodeAt(toMm(ev));
			if (target && target.kind !== 'icon' && target.id !== from.id) {
				post({ op: 'addEdge', from: from.id, to: target.id });
			} else if (!target) {
				const id = newId();
				store.pendingEdit = id;
				post({
					op: 'addNode',
					id,
					x: snap(d.x),
					y: snap(d.y),
					title: 'Box',
					cat: from.cat,
					width: from.width,
					from: from.id,
				});
			}
		}
		render();
	});
}
