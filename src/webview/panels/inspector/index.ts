import { calls } from '../../store/calls';
import { inspector } from '../../platform/dom';
import { store } from '../../store/store';
import { setTab } from '../chrome';
import { h } from '../../ui/control';
import { mountSections } from './build';
import { FIGURE } from './figure';
import { currentSelection, header } from './selection';
import { SKELETON, PanelCtx } from './spec';
import { SPECS } from './specs';
import { subjectFor } from './subject';

// The inspector: a Selection tab built from the SectionSpecs of whatever is selected, and a Figure tab.

export function renderInspector() {
	renderInspectorRaw();
}

function pane(id: string): HTMLElement {
	const p = h('div', 'tabpane', { id, role: 'tabpanel' });
	inspector.append(p);
	return p;
}

function renderInspectorRaw() {
	// Do not rebuild under an open palette or a field being typed in.
	if (store.floating && inspector.contains(store.floating.anchor)) return;
	if (inspector.contains(document.activeElement) && document.activeElement?.tagName !== 'BUTTON') return;
	inspector.replaceChildren();
	const sel = currentSelection();
	const ctx: PanelCtx = { sel, subject: subjectFor(sel), refresh: renderInspectorRaw };

	const selectionPane = pane('pane-selection');
	const figurePane = pane('pane-figure');
	const head = header(sel);
	if (head) {
		selectionPane.append(
			h(
				'div',
				'insp-head',
				{},
				h('span', 'insp-kind', {}, head.kind),
				...(head.name ? [h('span', 'insp-name', {}, head.name)] : []),
			),
		);
	} else {
		selectionPane.append(h('p', 'empty', {}, 'Nothing selected'));
	}
	mountSections(selectionPane, SKELETON, SPECS[sel.mode], ctx, 'selection');
	mountSections(figurePane, FIGURE, FIGURE, ctx, 'figure');

	const signature = JSON.stringify([
		[...store.selN],
		[...store.selE],
		store.selG,
		store.selN.label,
		[...store.selectedLayers],
	]);
	const has = !!(store.selN.size || store.selE.size || store.selG || store.selN.label || store.selectedLayers.size);
	if (has && signature !== store.lastInspectorSelection) setTab('selection');
	store.lastInspectorSelection = signature;
	const tabCount = document.getElementById('tab-count');
	if (tabCount) tabCount.textContent = sel.count > 1 ? String(sel.count) : '';
}

calls.renderInspector = renderInspector;
