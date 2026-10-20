import * as coreSketch from '../../../core/layout/sketch';
import { ANCHORS } from '../../store/constants';
import { SKETCH_CONTROLS, runCommand } from '../../commands/registry';
import { appState } from '../../commands/state';
import { applyTidy } from '../../commands/tidy';
import { copyStyle, pasteStyle } from '../../commands/styles';
import { byId, layout, post } from '../../store/model';
import { moveToLayer, selectedRoots } from '../../store/layers';
import { r1, show } from '../../store/constants';
import { render } from '../../render/scene';
import { store } from '../../store/store';
import type { Op } from '../../store/types';
import { Actions } from '../../ui/actions';
import { AnchorPicker, AnchorLayout } from '../../ui/anchor';
import { Block } from '../../ui/block';
import { MIXED, h } from '../../ui/control';
import { pathGlyph } from '../../ui/glyph';
import { NumberControl } from '../../ui/number';
import { RangeControl } from '../../ui/range';
import { SelectControl } from '../../ui/select';
import { TextControl } from '../../ui/text';
import type { PanelCtx, RowControls } from './spec';

// Rows shared by several kinds of object.

// One node op for one node, a batch for several: what the old single and multi inspectors each posted.
export const nodeOps = (ids: string[], patch: Record<string, unknown>): Op =>
	ids.length === 1
		? { op: 'node', id: ids[0], ...patch }
		: { op: 'batch', ops: ids.map((id) => ({ op: 'node', id, ...patch })) };

export const sameOr = <T>(values: T[]): T | typeof MIXED =>
	values.every((v) => JSON.stringify(v) === JSON.stringify(values[0])) ? values[0] : MIXED;

export const ANCHOR_GRID: AnchorLayout<string> = {
	cells: ANCHORS,
	columns: 3,
	name: (a) => a,
	className: 'anchor-picker',
	ariaLabel: 'Anchor',
};

export function opacityRow(c: PanelCtx): RowControls {
	const layers = c.sel.mode === 'layer' ? c.sel.layers : [];
	const objects = layers.length ? [] : [...c.sel.nodes, ...c.sel.edges.map((e) => e.e)];
	if (!layers.length && !objects.length) return null;
	const values = layers.length ? layers.map((l) => l.opacity ?? 1) : objects.map((o) => o.style?.opacity ?? 1);
	const control = new RangeControl('Opacity (%)');
	control.set(sameOr(values) === MIXED ? MIXED : Math.round(values[0] * 100));
	control.onPreview((percent) => {
		for (const l of layers) l.opacity = percent / 100;
		for (const o of objects) o.style = { ...o.style, opacity: percent / 100 };
		render();
	});
	control.onCommit((percent) => {
		if (percent === null) return;
		post(
			layers.length
				? { op: 'batch', ops: layers.map((l) => ({ op: 'layerProps', id: l.id, opacity: percent / 100 })) }
				: { op: 'style', ids: [...store.selN], indices: [...store.selE], style: { opacity: percent / 100 } },
		);
	});
	return control;
}

// Two number fields with their own scrub handles: X and Y, or width and height.
function pair(
	names: [string, string],
	values: [number | typeof MIXED, number | typeof MIXED],
	commit: (which: 0 | 1, v: number) => void,
	opts: { step: number; min?: number },
): NumberControl[] {
	return names.map((name, i) => {
		const n = new NumberControl({ prefix: name[0], ariaLabel: name, unit: i ? 'mm' : undefined, ...opts });
		n.set(values[i]);
		n.onCommit((v) => v !== null && commit(i as 0 | 1, v));
		return n;
	});
}

export function positionRow(c: PanelCtx): RowControls {
	const nodes = c.sel.nodes;
	if (!nodes.length) return null;
	return pair(
		['X', 'Y'],
		[sameOr(nodes.map((n) => n.x)), sameOr(nodes.map((n) => n.y))],
		(which, v) =>
			post({
				op: 'batch',
				ops: nodes.map((n) => ({ op: 'move', id: n.id, x: which === 0 ? v : n.x, y: which === 1 ? v : n.y })),
			}),
		{ step: 0.05 },
	);
}

export function sizeRow(c: PanelCtx): RowControls {
	const nodes = c.sel.nodes;
	if (!nodes.length) return null;
	const ids = nodes.map((n) => n.id);
	return pair(
		['Width', 'Height'],
		[sameOr(nodes.map((n) => n.wantWidth ?? n.width)), sameOr(nodes.map((n) => +r1(layout(n).h)))],
		(which, v) => post(nodeOps(ids, which === 0 ? { width: v } : { minh: v })),
		{ step: 0.5, min: 0 },
	);
}

export function layerRow(c: PanelCtx): RowControls {
	if (!c.sel.nodes.length && !store.selG) return null;
	const select = new SelectControl([
		{ value: '', label: 'Choose…' },
		...store.layers.map((l) => ({ value: l.id, label: l.name })),
	]);
	select.set('');
	select.onCommit((id) => {
		if (id) moveToLayer(selectedRoots(), id);
	});
	return select;
}

export function copyPasteRow(): RowControls {
	return new Actions([
		{ label: 'Copy style', title: 'Ctrl+Alt+C', run: copyStyle },
		{ label: 'Paste style', title: 'Ctrl+Alt+V', disabled: !store.styleClip, run: pasteStyle },
	]);
}

export function tidyRow(): RowControls {
	return new Actions([
		{
			label: store.selN.size ? 'Tidy up' : 'Tidy up figure',
			title: 'Tidy up (Alt+T)',
			run: (b) => {
				b.blur();
				runCommand(appState, 'sketch.tidy');
			},
		},
	]);
}

// Align, distribute and equalise the selected boxes, by command id, with a note on the reference box.
export function alignRow(c: PanelCtx): RowControls {
	if (c.sel.nodes.length < 2) return null;
	const few = coreSketch.units(store.nodes, store.groups, [...store.selN], layout).length < 3;
	const bar = new Actions(
		SKETCH_CONTROLS.map(([command, label, key, path]) => ({
			label,
			title: `${label} (${key})`,
			svg: pathGlyph(path),
			disabled: command.startsWith('distribute') && few,
			run: (b) => {
				b.blur();
				runCommand(appState, `sketch.${command}`);
			},
		})),
		'sketch-controls',
		'Align, distribute and size',
	);
	const ref = store.selN.has(store.keyObject ?? '') ? byId(store.keyObject!) : undefined;
	const note = h(
		'p',
		'empty',
		{},
		ref ? `Reference: ${show(ref.title) || ref.id}` : 'Shift/Ctrl+click sets a reference',
	);
	return new Block(h('div', '', {}, bar.el, note));
}

export function layerNameRow(c: PanelCtx): RowControls {
	const layer = c.sel.layers.find((l) => l.id === store.activeLayer) ?? c.sel.layers[0];
	if (!layer) return null;
	const field = new TextControl({ ariaLabel: 'Name' });
	field.set(layer.name);
	field.onCommit((name) => post({ op: 'layerProps', id: layer.id, name: name ?? '' }));
	return field;
}
