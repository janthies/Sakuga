import { store } from '../store/store';
import { calls } from '../store/calls';
import { buildIconPanel } from '../ui/iconpicker';
import { render } from '../render/scene';
import { byId, groupById, members } from '../store/model';
import { showText } from './toolbar';
import { fit } from '../tools/live/view';
import { labelTarget } from '../render/labelgeom';
import { startEdit } from '../tools/live/dispatch';
import { appState } from './state';
import { runCommand } from './registry';
import type { ToWebview } from '../../bridge/protocol';
import type { Icon } from '../../core/model/figure';

export function initCommandsMessages() {
	window.addEventListener('message', (ev) => {
		const m: ToWebview<Icon> = ev.data;
		if (m.type === 'sketch') {
			runCommand(appState, `sketch.${m.command}`, { preview: m.preview });
			return;
		}
		if (m.type === 'icons') {
			store.icons = m.icons;
			buildIconPanel();
			render();
			return;
		}
		if (m.type === 'select') {
			store.pendingSelect = m.ids;
		}
		if (m.type !== 'state') {
			if (store.pendingSelect && store.pendingSelect.every(byId)) {
				store.selG = null;
				store.selN = new Set(store.pendingSelect.filter((id) => byId(id) && !byId(id)!.hidden && !byId(id)!.locked));
				store.selE = new Set();
				store.pendingSelect = null;
				render();
			}
			return;
		}
		store.tidyPreview = null;
		store.tidyHeld = false;

		store.figureFont = m.font || 'small';
		showText(m.text);
		for (const id of store.selectedLayers) {
			if (!(m.layers || []).some((l) => l.id === id)) {
				store.selectedLayers.delete(id);
			}
		}
		store.layers = m.layers || [{ id: 'layer1', name: 'Layer 1', hidden: false, locked: false }];
		if (!store.layers.some((l) => l.id === store.activeLayer)) {
			store.activeLayer = store.layers[0].id;
		}
		store.items = m.items || [];
		store.lines = m.lines || [];
		store.nodes = m.nodes;
		store.groups = m.groups || [];
		const labelGroup = store.selN.label?.group;
		if (labelGroup && !store.groups.some((g) => g.id === labelGroup)) delete store.selN.label;
		if (
			store.selG === null ||
			!groupById(store.selG) ||
			members(store.selG).every((id) => byId(id)!.locked || byId(id)!.hidden)
		) {
			store.selG = null;
		}
		store.edges = m.edges;
		if (store.freshBox) {
			store.nodes.push(store.freshBox.node);
			store.edges.push(store.freshBox.edge);
		}
		store.cats = m.categories;
		store.styles = m.styles || [];
		store.shared = m.shared || [];
		if (store.pendingStyleFocus) {
			const made = store.styles.find((s) => s.name === store.pendingStyleFocus);
			if (made) {
				store.openStyles.add(made.key);
				calls.setTab('figure');
				setTimeout(() => document.querySelector<HTMLInputElement>(`[data-style-name="${made.key}"]`)?.select(), 0);
				store.pendingStyleFocus = null;
			}
		}
		store.legend = m.legend;
		store.arrowsStyle = m.arrows || 'manhattan';
		store.palette = m.palette;
		store.defaultWidth = m.defaultWidth;
		if (!store.fitted) {
			fit();
			store.fitted = true;
		}
		const selectedAttached = store.selN.label;
		store.selN = new Set([...store.selN].filter((id) => byId(id) && !byId(id)!.locked && !byId(id)!.hidden));
		if (selectedAttached) store.selN.label = selectedAttached;
		if (store.selN.label && !labelTarget()) delete store.selN.label;
		store.selE = new Set([...store.selE].filter((k) => store.edges[k]));
		if (store.pendingSelect && store.pendingSelect.every(byId)) {
			store.selG = null;
			store.selN = new Set(store.pendingSelect.filter((id) => byId(id) && !byId(id)!.hidden && !byId(id)!.locked));
			store.selE = new Set();
			store.pendingSelect = null;
		}
		render();
		if (
			store.pendingEdit &&
			byId(store.pendingEdit) &&
			!byId(store.pendingEdit)!.hidden &&
			!byId(store.pendingEdit)!.locked
		) {
			store.selN = new Set([store.pendingEdit]);
			store.selE = new Set();
			startEdit(store.pendingEdit);
			store.pendingEdit = null;
		}
	});
}
