import { interact } from './interaction';
import { store } from '../store/store';
import { input, isTyping, svg } from '../platform/dom';
import { vscode } from '../platform/host';
import { byId, post, snap } from '../store/model';
import { newId, moveToLayer, selectedRoots } from '../store/layers';
import { ROUTE_OPTS } from '../store/constants';
import { render } from '../render/scene';
import { fit } from '../tools/live/view';
import { beginEdit, startEdit } from '../tools/live/dispatch';
import { applyTidy, arrange } from './tidy';
import { makeDraft } from './draft';
import { copyStyle, pasteStyle } from './styles';
import { groupSelection, ungroupSelection } from './groups';
import { clip, deleteSelection, duplicate } from './clipboard';
import type { AppState } from './registry';

const ids = () => [...store.selN].filter(byId);
const ix = () => [...store.selE].filter((i) => store.edges[i]);
const one = (): any => {
	if (store.selN.size !== 1 || ix().length) return null;
	const id = [...store.selN][0],
		n = byId(id);
	if (n) return n;
	const item = store.items.find((i) => i.id === id);
	return item?.kind === 'Text'
		? { id, kind: 'label', title: item.text, locked: item.locked, hidden: item.hidden }
		: null;
};

// The application as the commands see it, over the live store.
export const appState: AppState = {
	interaction: interact,
	get cats() {
		return store.cats;
	},
	get layers() {
		return store.layers;
	},
	get activeLayer() {
		return store.activeLayer;
	},
	get selG() {
		return store.selG;
	},
	get label() {
		return store.selN.label;
	},
	get routes() {
		return ROUTE_OPTS.map((o) => o[0]);
	},
	ids,
	ix,
	one,
	node: byId,
	edge: (i) => store.edges[i],
	blocked: () => !!(store.floating || store.editing || isTyping()),
	busy: () => !!(store.editing || isTyping()),
	post,
	send: (m) => vscode.postMessage(m),
	tidy: { apply: applyTidy },
	arrange,
	moveSelectionToLayer(delta) {
		const current = store.layers.findIndex((l) => l.id === (one()?.layer || store.activeLayer)),
			target = store.layers[current + delta];
		if (target) {
			moveToLayer(selectedRoots(), target.id);
		}
	},
	copyStyle,
	pasteStyle,
	group: groupSelection,
	ungroup: ungroupSelection,
	selectAll() {
		store.keyObject = null;
		store.selG = null;
		store.selN = new Set(store.nodes.filter((n) => !n.hidden && !n.locked).map((n) => n.id));
		store.selE = new Set(store.edges.map((_, i) => i));
		render();
	},
	clearSelection() {
		delete store.selN.label;
		store.keyObject = null;
		store.selectedLayers.clear();
		store.selG = null;
		store.selN = new Set();
		store.selE = new Set();
		render();
	},
	deleteSelection,
	duplicate,
	fit() {
		fit();
		render();
	},
	resetFit() {
		store.moved = false;
		fit();
		render();
	},
	edit: (id, text) => startEdit(id, text),
	nextBox(below) {
		const draft = makeDraft(one()!, below);
		beginEdit({ kind: 'draft', id: draft.node.id, draft });
	},
	setLastCat(key) {
		store.lastCat = key;
	},
	clipText: clip,
	paste(t) {
		if (!t || !/\\(node|draw|pic)\[/.test(t)) {
			return false;
		}
		store.pasteCount = t === store.lastPaste ? store.pasteCount + 1 : 1;
		store.lastPaste = t;
		vscode.postMessage({
			type: 'paste',
			layer: store.selG || store.activeLayer,
			text: t,
			dx: 5 * store.pasteCount,
			dy: -5 * store.pasteCount,
		});
		return true;
	},
	newId,
	centre() {
		const r = svg.getBoundingClientRect();
		return {
			x: snap((r.width / 2 - store.view.ox) / store.view.s),
			y: snap((store.view.oy - r.height / 2) / store.view.s),
		};
	},
	pendingEdit(id: string) {
		store.pendingEdit = id;
	},
	pendingSelect(list: string[]) {
		store.pendingSelect = list;
	},
	preambleText: () => document.getElementById('pre')!.textContent,
	openObjectMenu: () => document.querySelector<HTMLElement>('.lc-obj')?.click(),
};
