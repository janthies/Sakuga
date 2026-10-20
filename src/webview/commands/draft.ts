import * as coreSketch from '../../core/layout/sketch';
import { store } from '../store/store';
import { layout } from '../store/model';
import { newId } from '../store/layers';
import type { ViewNode } from '../store/types';

// The style of a box without the properties that differ from it.
function withoutOverrides(n: ViewNode) {
	const def = store.styles.find((s) => s.key === n.cat),
		st: Record<string, any> = { ...n.style };
	for (const k of n.overrides || []) {
		if (def && def.props[k] !== undefined) {
			st[k] = def.props[k];
		} else {
			delete st[k];
		}
	}
	return st;
}
// Tab: add a box (and the arrow to it) after the selected one, unsent, and select it. Returns the draft.
export function makeDraft(n: ViewNode, below: boolean) {
	store.activeLayer = n.layer || store.activeLayer;
	const draft = coreSketch.nextBox(
		store.nodes,
		store.edges,
		{ ...n, style: withoutOverrides(n) },
		newId(),
		below,
		layout,
	);
	store.freshBox = draft;
	store.nodes.push(draft.node);
	store.edges.push(draft.edge);
	store.selG = null;
	store.keyObject = null;
	store.selN = new Set([draft.node.id]);
	store.selE.clear();
	return draft;
}
