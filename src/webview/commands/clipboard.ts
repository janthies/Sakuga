// @ts-nocheck
import { parse } from '../../core/codec/parse';
import { serializeSubset } from '../../core/codec/subset';
import { store } from '../store/store';
import { byId, post } from '../store/model';
import { edgeGeom } from '../render/edges';
import { src } from '../platform/dom';
import { render } from '../render/scene';

// Copy: the selected boxes, arrows and groups as TikZ, written by the same serializer as the file.
export function clip() {
	const refs = [
		...[...store.selN].map((id) => ({ k: 'node', id })),
		...[...store.selE].map((index) => ({ k: 'edge', index })),
		...(store.selG ? [{ k: 'group', id: store.selG }] : []),
	];
	return serializeSubset(parse(src.value), refs);
}
// The batch op that copies the boxes `ids` (and the arrows between them) by (dx, dy), and the ids of the copies.
export function duplicateOps(ids, dx, dy) {
	let next = Math.max(0, ...store.nodes.map((n) => +(/^n(\d+)$/.exec(n.id) || [0, 0])[1])) + 1;
	const map = new Map(ids.map((id) => [id, `n${next++}`]));
	const ops = ids.map((id) => {
		const n = byId(id);
		return {
			op: 'addNode',
			wantWidth: n.wantWidth,
			codeFont: n.codeFont,
			titlePosition: n.titlePosition,
			id: map.get(id),
			x: n.x + dx,
			y: n.y + dy,
			title: n.title,
			icon: n.icon,
			iconPosition: n.iconPosition,
			kind: n.kind,
			code: n.code,
			cat: n.cat,
			width: n.width,
			minh: n.minh,
			style: n.style,
			extra: n.extra,
		};
	});
	for (const id of ids) {
		const n = byId(id),
			a = n.attachment;
		if (a) {
			ops.push({
				op: 'attach',
				id: map.get(id),
				attachment: {
					...a,
					parent: map.get(a.parent) || a.parent,
					dx: a.dx + (map.has(a.parent) ? 0 : dx),
					dy: a.dy + (map.has(a.parent) ? 0 : dy),
				},
			});
		}
	}
	for (const e of store.edges) {
		if (map.has(e.from) && map.has(e.to)) {
			ops.push({
				op: 'addEdge',
				styleKey: e.styleKey,
				fromAnchor: e.fromAnchor,
				toAnchor: e.toAnchor,
				fromOffset: e.fromOffset,
				toOffset: e.toOffset,
				loopSide: e.loopSide,
				loopSize: e.loopSize,
				loopOut: e.loopOut,
				loopIn: e.loopIn,
				looseness: e.looseness,
				loopMax: e.loopMax,
				...(e.route === 'fixed'
					? {
							waypoints: edgeGeom(e)
								.pts.slice(1, -1)
								.map((p) => [p[0] + dx, p[1] + dy]),
						}
					: {}),
				from: map.get(e.from),
				to: map.get(e.to),
				kind: e.kind,
				route: e.route,
				mid: e.mid,
				bend: e.bend,
				head: e.head,
				label: e.label,
				labelStyle: e.labelStyle,
				labels: e.labels,
				style: e.style,
				extra: e.extra,
			});
		}
	}
	return { op: { op: 'batch', ops }, select: [...map.values()] };
}
export function duplicate(ids, dx, dy) {
	const { op, select } = duplicateOps(ids, dx, dy);
	store.pendingSelect = select;
	post(op);
}
export function deleteSelection() {
	if (store.selN.label) {
		post({ op: 'label', ...store.selN.label, text: '' });
		delete store.selN.label;
		render();
		return;
	}
	const ids = [...store.selN].filter(byId),
		ix = [...store.selE].filter((k) => store.edges[k]);
	// arrows first, highest index first, so the indices stay valid; then the boxes
	const ops = [...ix].sort((a, b) => b - a).map((k) => ({ op: 'deleteEdge', index: k }));
	post({ op: 'batch', ops: [...ops, ...ids.map((id) => ({ op: 'deleteNode', id }))] });
	store.selN = new Set();
	store.selE = new Set();
}
