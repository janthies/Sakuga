// @ts-nocheck
import { store } from '../../store/store';
import { attachmentFor, byId, catOf, descendant, layout, nodeAt, snap } from '../../store/model';
import { newId, selectLayer } from '../../store/layers';
import { tex } from '../../store/constants';
import { edgeGeom } from '../../render/edges';
import { arrowLabelGeom, frameTitleGeom, labelTarget, projectLabel } from '../../render/labelgeom';
import { endpointObject, endpointTarget } from '../../render/anchors';
import { selBox } from '../../render/svg';
import { duplicateOps } from '../../commands/clipboard';
import { dropAnchor, labelDrop } from './queries';
import type { ToolCtx } from '../types';

export function selection() {
	return {
		nodes: new Set(store.selN),
		edges: new Set(store.selE),
		group: store.selG,
		label: store.selN.label ?? null,
		key: store.keyObject,
	};
}

// The tool context over the live store. Lists are read through getters: the store replaces them with every state message.
export const liveCtx: ToolCtx = {
	get nodes() {
		return store.nodes;
	},
	get edges() {
		return store.edges;
	},
	get groups() {
		return store.groups;
	},
	get scale() {
		return store.view.s;
	},
	view: () => ({ ox: store.view.ox, oy: store.view.oy }),
	sel: selection,
	byId,
	layout,
	snap,
	nodeAt,
	descendant,
	attachmentFor,
	edgeGeom,
	endpointObject,
	endpointTarget,
	dropAnchor,
	labelDrop,
	labelTarget,
	frameTitleGeom,
	arrowLabelGeom,
	projectLabel,
	selBox,
	newId,
	lastCat: () => (catOf(store.lastCat) ? store.lastCat : ''),
	clickLayer(id, additive) {
		selectLayer(id, additive);
		return selection();
	},
	duplicateOp: duplicateOps,
	hover: () => store.hover,
	tex,
	dropDraft(draft) {
		store.freshBox = null;
		store.nodes = store.nodes.filter((n) => n.id !== draft.node.id);
		store.edges = store.edges.filter((e) => e !== draft.edge);
	},
};
