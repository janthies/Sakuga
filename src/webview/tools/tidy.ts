// @ts-nocheck
import * as coreSketch from '../../core/layout/sketch';
import { store } from '../store/store';
import { byId, groupById, layout, members, post } from '../store/model';
import { render } from '../render/scene';
import { isTyping } from '../platform/dom';

function tidyPlan() {
	return coreSketch.tidy(store.nodes, store.groups, store.edges, [...store.selN], layout);
}
export function previewTidy() {
	if (!store.tidyPreview) {
		store.tidyPreview = tidyPlan();
		render();
	}
}
export function cancelTidy() {
	store.tidyPreview = null;
	store.tidyHeld = false;
	render();
}
export function applyTidy() {
	const batch = store.tidyPreview || tidyPlan();
	store.tidyPreview = null;
	store.tidyHeld = false;
	if (batch.ops.length) post(batch);
	render();
}
export function sketchCommand(command) {
	if (command === 'tidy') {
		if (!store.floating && !store.editing && !isTyping()) {
			store.tidyHeld = true;
			previewTidy();
		}
		return;
	}
	if (store.floating || store.editing || isTyping()) {
		return;
	}
	const ids = [...store.selN].filter((id) => byId(id) && !byId(id).locked && !byId(id).hidden);
	if (ids.length < 2) {
		return;
	}
	const key = store.selN.has(store.keyObject)
		? store.keyObject
		: groupById(store.keyObject) && members(store.keyObject).every((id) => store.selN.has(id))
			? members(store.keyObject)[0]
			: null;
	const batch =
		command === 'sameW' || command === 'sameH'
			? coreSketch.sameSize(store.nodes, ids, key, command === 'sameW' ? 'w' : 'h', layout)
			: coreSketch.arrange(store.nodes, store.groups, ids, key, command, layout);
	if (batch.ops.length) {
		post(batch);
	}
}

export function initToolsTidy() {
	window.addEventListener('blur', () => {
		if (store.tidyPreview) cancelTidy();
	});
}
