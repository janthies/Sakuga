import { pasteOps } from '../../core/ops/paste';
import { parse } from '../../core/codec/parse';
import { serializeSubset } from '../../core/codec/subset';
import { store } from '../store/store';
import { byId, post } from '../store/model';
import { edgeGeom } from '../render/edges';
import { src } from '../platform/dom';
import { render } from '../render/scene';
import type { ObjectRef } from '../../core/model/refs';
import type { Op } from '../tools/types';

// Copy: the selected boxes, arrows and groups as TikZ, written by the same serializer as the file.
export function clip() {
	const refs: ObjectRef[] = [
		...[...store.selN].map((id) => ({ k: 'node' as const, id })),
		...[...store.selE].map((index) => ({ k: 'edge' as const, index })),
		...(store.selG ? [{ k: 'group' as const, id: store.selG }] : []),
	];
	return serializeSubset(parse(src.value), refs);
}
// The batch op that copies the boxes `ids` (and the arrows between them) by (dx, dy), and the ids of the copies.
export function duplicateOps(ids: string[], dx: number, dy: number): { op: Op; select: string[] } {
	const fig = parse(src.value);
	const text = serializeSubset(
		fig,
		ids.map((id) => ({ k: 'node' as const, id })),
	);
	const result = pasteOps(fig, text, dx, dy, store.selG || store.activeLayer);
	return { op: { op: 'batch', ops: result.ops }, select: result.ids };
}
export function duplicate(ids: string[], dx: number, dy: number) {
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
