// @ts-nocheck
import { store } from '../store/store';
import { input, isTyping, svg } from '../platform/dom';
import { byId, isBox, post } from '../store/model';
import { applyTidy, cancelTidy, previewTidy, sketchCommand } from '../tools/tidy';
import { ROUTE_OPTS, SKETCH_CONTROLS } from '../store/constants';
import { moveToLayer, selectedRoots } from '../store/layers';
import { copyStyle, pasteStyle } from './styles';
import { groupSelection, ungroupSelection } from './groups';
import { render } from '../render/scene';
import { clip, deleteSelection, duplicate } from './clipboard';
import { fit } from '../tools/canvas';
import { nextConnectedBox, startEdit } from '../tools/edit';
import { vscode } from '../platform/host';

export function initCommandsKeys() {
	document.addEventListener('keydown', (ev) => {
		if (store.floating || store.editing || isTyping()) {
			return;
		}
		if (ev.key === ' ') {
			store.space = true;
			svg.classList.add('panning');
			ev.preventDefault();
			return;
		}
		if (ev.isComposing || ev.key === 'Dead' || ev.key === 'Process') {
			return;
		}
		const ctrl = ev.ctrlKey || ev.metaKey;
		const k = ev.key.toLowerCase();
		const ids = [...store.selN].filter(byId),
			ix = [...store.selE].filter((i) => store.edges[i]);
		const one = ids.length === 1 && ix.length === 0 ? byId(ids[0]) : null;
		if (ev.altKey && !ctrl && !ev.shiftKey && k === 't') {
			ev.preventDefault();
			store.tidyHeld = true;
			previewTidy();
			return;
		}
		if (ev.key === 'Escape' && store.tidyPreview) {
			ev.preventDefault();
			cancelTidy();
			return;
		}
		const alignment =
			ev.altKey && !ctrl && !ev.shiftKey && SKETCH_CONTROLS.find((c) => c[2].toLowerCase() === `alt+${k}`);
		if (alignment) {
			sketchCommand(alignment[0]);
		} else if (
			ctrl &&
			!ev.altKey &&
			(ev.code === 'BracketRight' || ev.code === 'BracketLeft') &&
			(ids.length || store.selG)
		) {
			const current = store.layers.findIndex((l) => l.id === (one?.layer || store.activeLayer)),
				target = store.layers[current + (ev.code === 'BracketRight' ? 1 : -1)];
			if (target) {
				moveToLayer(selectedRoots(), target.id);
			}
		} else if (ctrl && ev.altKey && ev.code === 'KeyC') {
			copyStyle();
		} else if (ctrl && ev.altKey && ev.code === 'KeyV') {
			pasteStyle();
		} else if (ctrl && !ev.altKey && k === 'g') {
			if (ev.shiftKey) {
				ungroupSelection();
			} else {
				groupSelection();
			}
		} else if (ctrl && !ev.altKey && k === 'a') {
			store.keyObject = null;
			store.selG = null;
			store.selN = new Set(store.nodes.filter((n) => !n.hidden && !n.locked).map((n) => n.id));
			store.selE = new Set(store.edges.map((_, i) => i));
			render();
		} else if (ctrl && !ev.altKey && k === 'd') {
			if (ids.length) {
				duplicate(ids, 5, -5);
			}
		} else if (ctrl || ev.altKey) {
			return;
		} else if (ev.shiftKey && ev.code === 'Digit1') {
			fit();
			render();
		} else if (one && ev.key === 'Tab' && nextConnectedBox(ev.shiftKey)) {
		} else if (one && !one.locked && (ev.key === 'Enter' || ev.key === 'F2')) {
			startEdit(one.id);
		} else if (ids.length && !ev.shiftKey && /^Digit[1-9]$/.test(ev.code) && store.cats[+ev.code.slice(5) - 1]) {
			store.lastCat = store.cats[+ev.code.slice(5) - 1].key;
			post({ op: 'batch', ops: ids.map((id) => ({ op: 'node', id, cat: store.lastCat })) });
		} else if (ids.length && ev.key.startsWith('Arrow')) {
			const step = ev.shiftKey ? 5 : 1;
			const dx = { ArrowLeft: -step, ArrowRight: step }[ev.key] || 0;
			const dy = { ArrowDown: -step, ArrowUp: step }[ev.key] || 0;
			post({
				op: 'batch',
				ops: ids
					.filter((id) => !byId(id).locked)
					.map((id) => ({ op: 'move', id, x: byId(id).x + dx, y: byId(id).y + dy })),
			});
		} else if (ix.length && k === 'r') {
			const order = ROUTE_OPTS.map((o) => o[0]);
			const route = order[(order.indexOf(store.edges[ix[0]].route) + 1) % order.length];
			post({ op: 'batch', ops: ix.map((i) => ({ op: 'arrow', index: i, route, mid: null, bend: 0 })) });
		} else if (ix.length && k === 'd') {
			const kind = ix.every((i) => store.edges[i].kind === 'arr-dashed') ? 'arr' : 'arr-dashed';
			post({ op: 'batch', ops: ix.map((i) => ({ op: 'arrow', index: i, kind })) });
		} else if ((ids.length || ix.length || store.selN.label) && (ev.key === 'Delete' || ev.key === 'Backspace')) {
			deleteSelection();
		} else if (ev.key === 'Escape') {
			delete store.selN.label;
			store.keyObject = null;
			store.selectedLayers.clear();
			store.selG = null;
			store.selN = new Set();
			store.selE = new Set();
			render();
		} else if (
			one &&
			!one.locked &&
			!one.hidden &&
			(isBox(one) || one.kind === 'label') &&
			Array.from(ev.key).length === 1 &&
			!'dr'.includes(k)
		) {
			startEdit(one.id);
			input.value = ev.key;
			input.setSelectionRange(input.value.length, input.value.length);
		} else {
			return;
		}
		ev.preventDefault();
	});
	document.addEventListener('keyup', (ev) => {
		if (store.tidyHeld && (ev.key.toLowerCase() === 't' || ev.key === 'Alt')) {
			ev.preventDefault();
			applyTidy();
			return;
		}
		if (ev.key === ' ') {
			store.space = false;
			svg.classList.remove('panning');
		}
	});
	// Ctrl+C, Ctrl+X and Ctrl+V reach the page as clipboard events; the clipboard holds TikZ lines.
	document.addEventListener('copy', (ev) => {
		if (store.editing || isTyping()) {
			return;
		}
		const t = clip();
		if (!t) {
			return;
		}
		ev.clipboardData.setData('text/plain', t);
		ev.preventDefault();
	});
	document.addEventListener('cut', (ev) => {
		if (store.editing || isTyping()) {
			return;
		}
		const t = clip();
		if (!t) {
			return;
		}
		ev.clipboardData.setData('text/plain', t);
		ev.preventDefault();
		deleteSelection();
	});
	document.addEventListener('paste', (ev) => {
		if (store.editing || isTyping()) {
			return;
		}
		const t = ev.clipboardData.getData('text/plain');
		if (!t || !/\\(node|draw|pic)\[/.test(t)) {
			return;
		}
		ev.preventDefault();
		store.pasteCount = t === store.lastPaste ? store.pasteCount + 1 : 1;
		store.lastPaste = t;
		vscode.postMessage({
			type: 'paste',
			layer: store.activeLayer,
			text: t,
			dx: 5 * store.pasteCount,
			dy: -5 * store.pasteCount,
		});
	});
}
