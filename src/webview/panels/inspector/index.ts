import { calls } from '../../store/calls';
import { inspector } from '../../platform/dom';
import { store } from '../../store/store';
import { setTab } from '../chrome';
import { h } from '../../ui/control';
import { mountSections } from './build';
import { FIGURE } from './figure';
import { currentSelection, header } from './selection';
import { PanelCtx } from './spec';
import { SPECS } from './specs';
import { subjectFor } from './subject';

// Show the selection, or figure settings and categories when the selection is empty.

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
	if (
		inspector.contains(document.activeElement) &&
		['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')
	)
		return;
	inspector.replaceChildren();
	const sel = currentSelection();
	const ctx: PanelCtx = { sel, subject: subjectFor(sel), refresh: renderInspectorRaw };

	const has = sel.mode !== 'none';
	const selectionPane = pane(has ? 'pane-selection' : 'pane-figure');
	const head = header(sel);
	if (head) selectionPane.append(h('div', 'insp-head', {}, `${head.kind}${head.name ? ' · ' + head.name : ''}`));
	const specs = has ? SPECS[sel.mode] : FIGURE;
	mountSections(selectionPane, specs, specs, ctx, has ? 'selection' : 'figure');
	setTab(has ? 'selection' : 'figure', false);
}

inspector.addEventListener('focusout', () =>
	setTimeout(() => {
		if (!inspector.contains(document.activeElement)) renderInspectorRaw();
	}, 0),
);
calls.renderInspector = renderInspector;
