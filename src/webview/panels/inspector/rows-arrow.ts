import { HEAD_OPTS, routeOpts, show, tex } from '../../store/constants';
import { edgeGeom } from '../../render/edges';
import { nextStep, resetToAuto, sourceColour } from '../../commands/styles';
import { byId, post } from '../../store/model';
import type { Op } from '../../store/types';
import { Actions } from '../../ui/actions';
import { Block } from '../../ui/block';
import { h } from '../../ui/control';
import { NumberControl } from '../../ui/number';
import { SelectControl } from '../../ui/select';
import { TextControl } from '../../ui/text';
import { sameOr } from './rows-common';
import type { PanelCtx, RowControls } from './spec';

// Rows of arrows: how they are routed and where they start and end.

// One arrow op for one arrow, a batch for several.
const arrowOps = (indices: number[], patch: Record<string, unknown>): Op =>
	indices.length === 1
		? { op: 'arrow', index: indices[0], ...patch }
		: { op: 'batch', ops: indices.map((index) => ({ op: 'arrow', index, ...patch })) };
const indicesOf = (c: PanelCtx) => c.sel.edges.map((e) => e.i);

export function resetAutoRow(c: PanelCtx): RowControls {
	if (!c.sel.edges.length) return null;
	const ix = indicesOf(c);
	const actions = new Actions([{ label: 'Reset to auto', run: () => resetToAuto(ix) }]);
	const e = c.sel.edge;
	if (e && edgeGeom(e.e)?.blocked) {
		actions.el.append(h('code', '', {}, 'No route with at most 3 bends. Move a box or set a manual route.'));
	}
	return actions;
}

export function routeRow(c: PanelCtx): RowControls {
	const edges = c.sel.edges;
	if (!edges.length) return null;
	const options = routeOpts(edges[0].e).map(([value, label]) => ({ value, label }));
	const select = new SelectControl(options, 'Route');
	select.set(sameOr(edges.map(({ e }) => e.route)));
	select.onCommit((route) =>
		post(arrowOps(indicesOf(c), { route: route!, ...(edges.length === 1 ? { mid: null, bend: 0 } : {}) })),
	);
	return select;
}

export function headsRow(c: PanelCtx): RowControls {
	const edges = c.sel.edges;
	if (!edges.length) return null;
	const select = new SelectControl(
		HEAD_OPTS.map(([value, label]) => ({ value, label })),
		'Heads',
	);
	select.set(sameOr(edges.map(({ e }) => e.head)));
	select.onCommit((head) => post(arrowOps(indicesOf(c), { head: head! })));
	return select;
}

export function arrowLabelRow(c: PanelCtx): RowControls {
	const e = c.sel.edge;
	if (!e) return null;
	const field = new TextControl({ ariaLabel: 'Label' });
	field.set(show(e.e.label));
	field.onCommit((v) => post({ op: 'arrow', index: e.i, label: tex(v ?? '') }));
	return field;
}

const SIDES = ['', 'north', 'east', 'south', 'west'].map((v) => ({ value: v, label: v || 'Automatic' }));

export function sidesRow(c: PanelCtx): RowControls {
	const e = c.sel.edge;
	if (!e) return null;
	return (['fromAnchor', 'toAnchor'] as const).map((prop) => {
		const select = new SelectControl(SIDES, prop === 'fromAnchor' ? 'Start side' : 'End side');
		select.set(e.e[prop] || '');
		select.onCommit((v) => post({ op: 'arrow', index: e.i, [prop]: v ?? '' }));
		return select;
	});
}

const LOOP_ANGLE: Record<string, number> = { north: 90, east: 0, south: 270, west: 180 };

export function loopRows(c: PanelCtx): RowControls {
	const e = c.sel.edge;
	if (!e || e.e.from !== e.e.to) return null;
	const round = /circle|ellipse/.test(byId(e.e.from)?.style?.shape ?? '') ? 22 : 0;
	const side = new SelectControl<string>(
		[
			{ value: 'north', label: 'Above' },
			{ value: 'east', label: 'Right' },
			{ value: 'south', label: 'Below' },
			{ value: 'west', label: 'Left' },
		],
		'Loop side',
	);
	side.set(e.e.loopSide || 'north');
	side.onCommit((loopSide) =>
		post({
			op: 'arrow',
			index: e.i,
			loopSide: loopSide!,
			loopOut: LOOP_ANGLE[loopSide!] + round,
			loopIn: LOOP_ANGLE[loopSide!] - round,
			fromAnchor: '',
			toAnchor: '',
		}),
	);
	const size = new NumberControl({ min: 1, step: 1, unit: 'mm', prefix: 'Size', ariaLabel: 'Loop size' });
	size.set(e.e.loopSize ?? 8);
	size.onCommit((loopSize) => post({ op: 'arrow', index: e.i, loopSize: loopSize ?? 8 }));
	return [side, size];
}

export function endpointsRow(c: PanelCtx): RowControls {
	const e = c.sel.edge;
	if (!e) return null;
	return new Block(h('span', 'endpoints', {}, h('code', '', {}, e.e.from), ' → ', h('code', '', {}, e.e.to)));
}

export function laneRow(c: PanelCtx): RowControls {
	const e = c.sel.edge;
	if (!e) return null;
	const lane = new NumberControl({ min: -100, step: 0.5, unit: 'mm', placeholder: 'Automatic', ariaLabel: 'Lane' });
	lane.set(e.e.lane ?? null);
	lane.onCommit((v) => post({ op: 'arrow', index: e.i, lane: v }));
	return lane;
}

// The number badge of an arrow in the legend order.
export function stepRow(c: PanelCtx): RowControls {
	const e = c.sel.edge;
	if (!e) return null;
	const step = new NumberControl({ step: 1, min: 1, placeholder: String(nextStep()), ariaLabel: 'Step' });
	step.set(e.e.style?.step ?? null);
	step.onCommit((v) => post({ op: 'style', indices: [e.i], style: { step: v || 0 } }));
	return [
		step,
		new Actions([
			{ label: 'Set next step', run: () => post({ op: 'style', indices: [e.i], style: { step: nextStep() } }) },
		]),
	];
}

export function sourceColourRow(c: PanelCtx): RowControls {
	if (!c.sel.edge) return null;
	const ix = indicesOf(c);
	return new Actions([{ label: 'Colour from source', run: () => sourceColour(ix) }]);
}
