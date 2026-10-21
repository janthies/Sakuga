import { geo } from '../../store/geometry';
import { lineLabel } from '../../../core/geometry/line-geometry';
import { store } from '../../store/store';
import { byId, catOf, descendant, layout, nodeAt, snap } from '../../store/model';
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
	get snapping() {
		return store.grid > 0;
	},
	itemRect(id) {
		const item = store.items.find((i) => i.id === id);
		if (item?.kind === 'Frame') return geo().frame(id) ?? undefined;
		if (item?.kind !== 'Text' || item.node) return undefined;
		const parent = store.items.find((i) => i.id === item.parent);
		const g =
			parent?.kind === 'Line'
				? lineLabel(parent.line, item.text, item.placement, store.figureFont, store.outerGap)
				: parent?.kind === 'Connector'
					? geo().label(parent.connector, item.placement, item.text)
					: undefined;
		return g ? { x: g.p[0], y: g.p[1], w: g.w, h: g.h } : undefined;
	},
	get items() {
		return store.items;
	},
	get lines() {
		return store.lines;
	},
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
