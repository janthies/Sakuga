import { store } from '../../store/store';
import { byId, fontPt, layout, px, py, textMm } from '../../store/model';
import { CODE_PT, PT, TITLE_PT, show } from '../../store/constants';
import { edgeGeom } from '../../render/edges';
import { etools, input, svg } from '../../platform/dom';
import type { EditTarget } from '../types';

// The text field over the canvas: where it sits and what it shows. The tool decides what the text means.
export function openField(target: EditTarget) {
	const r = svg.getBoundingClientRect();
	if (target.kind === 'edge') {
		const i = target.index,
			G = edgeGeom(store.edges[i]),
			w = 40;
		store.editing = `edge:${i}`;
		Object.assign(input.style, {
			display: 'block',
			left: `${r.left + px(G.label[0]) - (w * store.view.s) / 2}px`,
			top: `${r.top + py(G.label[1]) - 3 * store.view.s}px`,
			width: `${w * store.view.s}px`,
			height: `${6 * store.view.s}px`,
			fontSize: `${CODE_PT * PT * store.view.s}px`,
		});
		input.value = show(store.edges[i].label);
		etools.style.display = 'none';
		return;
	}
	const n = byId(target.id)!;
	store.editing = target.id;
	const { w, h } = layout(n);
	Object.assign(input.style, {
		display: 'block',
		left: `${r.left + px(n.x - w / 2)}px`,
		top: `${r.top + py(n.y + h / 2)}px`,
		width: `${w * store.view.s}px`,
		height: `${h * store.view.s}px`,
		fontSize: `${TITLE_PT * PT * store.view.s}px`,
	});
	if (n.kind === 'icon') {
		Object.assign(input.style, {
			left: `${r.left + px(n.x + w / 2 + 1)}px`,
			top: `${r.top + py(n.y + 3)}px`,
			width: `${Math.max(25, textMm(show(n.title), fontPt(n), 'Sakuga Sans') + 4) * store.view.s}px`,
			height: `${6 * store.view.s}px`,
		});
	}
	input.value = show(n.title.split('\\\\').join(' / '));
}
// After the redraw: focus the field, select its text, or put the caret behind a typed first character.
export function focusField(text?: string) {
	input.focus();
	input.select();
	if (text !== undefined) {
		input.value = text;
		input.setSelectionRange(input.value.length, input.value.length);
	}
}
export function closeField() {
	store.editing = null;
	input.style.display = 'none';
}
