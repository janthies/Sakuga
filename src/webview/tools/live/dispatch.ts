// @ts-nocheck
import { store } from '../../store/store';
import { input, svg } from '../../platform/dom';
import { byId, post, resolveAttached, toMm } from '../../store/model';
import { render, renderView, renderer } from '../../render/scene';
import { IdleTool } from '../idle';
import { TextEditTool } from '../textedit';
import { applyPreview } from '../preview';
import { liveCtx } from './ctx';
import { closeField, focusField, openField } from './editview';
import { fit } from './view';
import type { CanvasEvent, EditTarget, Selection, Step, Tool } from '../types';

// Turns DOM events into CanvasEvents for the active tool and applies the Steps it returns to the store.
const idle = new IdleTool(liveCtx);
let tool: Tool = idle;

function setSelection(s: Selection) {
	store.selN = new Set(s.nodes);
	if (s.label) store.selN.label = s.label;
	store.selE = new Set(s.edges);
	store.selG = s.group;
	store.keyObject = s.key;
}
function apply(step: Step) {
	if (step.select) setSelection(step.select);
	if (step.clearLayers) store.selectedLayers.clear();
	if (step.lastCat !== undefined) store.lastCat = step.lastCat;
	if (step.pendingEdit !== undefined) store.pendingEdit = step.pendingEdit;
	if (step.pendingSelect !== undefined) store.pendingSelect = step.pendingSelect;
	if (step.hover !== undefined) store.hover = step.hover;
	if (step.view) {
		store.moved = true;
		store.view.ox = step.view.ox;
		store.view.oy = step.view.oy;
	}
	if (step.preview) {
		applyPreview(store, step.preview);
		if (step.preview.place) resolveAttached();
	}
	if (step.edit === 'close') closeField();
	else if (step.edit) openField(step.edit.open);
	if (step.commit) post(step.commit);
}
function canvasEvent(ev: any): CanvasEvent {
	return {
		p: toMm(ev),
		screen: { x: ev.clientX, y: ev.clientY },
		button: ev.button,
		mods: { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey, alt: ev.altKey, space: store.space },
		hit: renderer.hit(ev.target) ?? { k: 'none' },
		text: input.value,
	};
}

/** Open the text field on a box or arrow (Enter, a typed character, Tab, a new box). */
export function beginEdit(target: EditTarget, text?: string) {
	const step = new TextEditTool(liveCtx, target).open(text);
	tool = step.next;
	store.drag = null;
	apply(step);
	if (step.render !== false) render();
	focusField(text);
}
export function initDispatch() {
	svg.addEventListener('pointerdown', (ev) => {
		const e = canvasEvent(ev);
		if (tool instanceof TextEditTool) {
			// a click on the canvas ends the text edit and then counts as an ordinary click
			apply(tool.down(e));
			tool = idle;
			store.drag = null;
		}
		const step = idle.down(e);
		tool = step.next ?? idle;
		apply(step);
		store.drag = tool.overlay ?? null;
		if (store.drag) svg.setPointerCapture(ev.pointerId);
		if (step.render !== false) render();
	});
	svg.addEventListener('pointermove', (ev) => {
		const step = (tool instanceof TextEditTool ? idle : tool).move(canvasEvent(ev));
		apply(step);
		// a pan or a hover changes the view or the overlay only: the scene stays
		const viewOnly = (step.view || step.hover !== undefined) && !step.preview && !step.commit && !step.select;
		if (step.render !== false) viewOnly ? renderView() : render();
	});
	svg.addEventListener('pointerup', (ev) => {
		if (tool instanceof TextEditTool) {
			render();
			return;
		}
		const t = tool;
		tool = idle;
		store.drag = null;
		apply(t.up(canvasEvent(ev)));
		render();
	});
	svg.addEventListener('dblclick', (ev) => {
		const step = idle.dbl(canvasEvent(ev));
		if (step.next) tool = step.next;
		apply(step);
		if (step.render !== false) render();
		if (step.edit && step.edit !== 'close') focusField();
	});
	input.addEventListener('keydown', (ev) => {
		if (ev.key === 'Enter' || ev.key === 'Escape') {
			endField(ev.key);
			ev.preventDefault();
		}
		ev.stopPropagation();
	});
	input.addEventListener('blur', () => endField('blur'));
	svg.addEventListener(
		'wheel',
		(ev) => {
			ev.preventDefault();
			store.moved = true;
			if (ev.ctrlKey) {
				const r = svg.getBoundingClientRect();
				const mx = ev.clientX - r.left,
					my = ev.clientY - r.top;
				const s = Math.min(30, Math.max(1, store.view.s * Math.exp(-ev.deltaY * 0.002)));
				store.view.ox = mx - ((mx - store.view.ox) * s) / store.view.s;
				store.view.oy = my - ((my - store.view.oy) * s) / store.view.s;
				store.view.s = s;
			} else {
				store.view.ox -= ev.deltaX;
				store.view.oy -= ev.deltaY;
			}
			renderView();
		},
		{ passive: false },
	);
	new ResizeObserver(() => {
		if (!store.fitted) {
			return;
		}
		if (!store.moved) {
			fit();
		}
		renderView();
	}).observe(document.getElementById('desk'));
}
/** Open the text field on a box, as Enter or a double-click does. */
export function startEdit(id: string, text?: string) {
	if (byId(id)) beginEdit({ kind: 'node', id }, text);
}
function endField(key: string) {
	if (!(tool instanceof TextEditTool)) return;
	const step = tool.key({ key, text: input.value });
	tool = idle;
	apply(step);
	store.drag = null;
	render();
}
