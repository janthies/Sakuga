import * as coreSketch from '../../core/layout/sketch';
import { store } from '../store/store';
import { byId, groupById, layout, members, post } from '../store/model';
import { render } from '../render/scene';
import { safeArrange } from './arrange-routes';
import type { Op } from '../tools/types';

function tidyPlan(): Op {
	return coreSketch.tidy(store.nodes, store.groups, store.edges, [...store.selN], layout);
}
export function applyTidy() {
	const batch = tidyPlan();
	if (batch.ops.length) post(safeArrange(batch));
	render();
}
// Align, distribute or equalise the selected boxes, about the reference box if one is set.
export function arrange(command: string) {
	const ids = [...store.selN].filter((id) => byId(id) && !byId(id)!.locked && !byId(id)!.hidden);
	if (ids.length < 2) {
		return;
	}
	const ref = store.keyObject ?? '';
	const key = store.selN.has(ref)
		? ref
		: groupById(ref) && members(ref).every((id) => store.selN.has(id))
			? members(ref)[0]
			: null;
	const batch =
		command === 'sameW' || command === 'sameH'
			? coreSketch.sameSize(store.nodes, ids, key, command === 'sameW' ? 'w' : 'h', layout)
			: coreSketch.arrange(store.nodes, store.groups, ids, key, command, layout);
	if (batch.ops.length) {
		post(safeArrange(batch));
	}
}
