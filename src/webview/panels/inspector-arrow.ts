// @ts-nocheck
import * as coreSketch from '../../core/layout/sketch';
import { store } from '../store/store';
import { copyStyle, labelChange, nextStep, pasteStyle, resetToAuto, sourceColour } from '../commands/styles';
import { edgeGeom } from '../render/edges';
import { emphasisToggle, label, numberControl, unit } from '../ui/controls';
import { byId, layout, post, textMm } from '../store/model';
import { HEAD_OPTS, PT, routeOpts, show, sizes, tex } from '../store/constants';
import { SKETCH_CONTROLS, runCommand } from '../commands/registry';
import { appState } from '../commands/state';
import { styleColour } from '../ui/stylecontrols';
import { arrowLabelGeom, frameTitleGeom } from '../render/labelgeom';
import { newId } from '../store/layers';
import { applyTidy, cancelTidy, previewTidy } from '../commands/tidy';
import { inspector } from '../platform/dom';

export function inspArrow(ctx) {
	ctx.section('Arrow');
	const reset = document.createElement('button');
	reset.textContent = 'Reset to auto';
	reset.onclick = () => resetToAuto([ctx.ei]);
	ctx.row('', reset);
	if (typeof edgeGeom === 'function' && edgeGeom(ctx.e)?.blocked)
		ctx.row('', label('No route with at most 3 bends. Move a box or set a manual route.'));
	if (ctx.e.from === ctx.e.to) {
		ctx.row(
			'Loop side',
			ctx.choice(
				[
					['north', 'Above'],
					['east', 'Right'],
					['south', 'Below'],
					['west', 'Left'],
				],
				ctx.e.loopSide || 'north',
				(loopSide) =>
					post({
						op: 'arrow',
						index: ctx.ei,
						loopSide,
						loopOut:
							{ north: 90, east: 0, south: 270, west: 180 }[loopSide] +
							(/circle|ellipse/.test(byId(ctx.e.from)?.style?.shape) ? 22 : 0),
						loopIn:
							{ north: 90, east: 0, south: 270, west: 180 }[loopSide] -
							(/circle|ellipse/.test(byId(ctx.e.from)?.style?.shape) ? 22 : 0),
						fromAnchor: '',
						toAnchor: '',
					}),
			),
		);
		ctx.row(
			'Loop size',
			numberControl(ctx.e.loopSize ?? 8, (loopSize) => post({ op: 'arrow', index: ctx.ei, loopSize: loopSize ?? 8 }), {
				min: 1,
				step: 1,
			}),
			unit('mm'),
		);
	}
	ctx.row('From', label(ctx.e.from));
	ctx.row('To', label(ctx.e.to));
	for (const [name, prop] of [
		['Start side', 'fromAnchor'],
		['End side', 'toAnchor'],
	])
		ctx.row(
			name,
			ctx.choice(
				[['', 'Automatic'], ...['north', 'east', 'south', 'west'].map((v) => [v, v])],
				ctx.e[prop] || '',
				(v) => post({ op: 'arrow', index: ctx.ei, [prop]: v }),
			),
		);
	ctx.row(
		'Lane',
		numberControl(ctx.e.lane, (v) => post({ op: 'arrow', index: ctx.ei, lane: v }), {
			min: -100,
			step: 0.5,
			placeholder: 'Automatic',
		}),
		unit('mm'),
	);
	ctx.row(
		'Step',
		numberControl(ctx.e.style?.step, (v) => post({ op: 'style', indices: [ctx.ei], style: { step: v || 0 } }), {
			step: 1,
			min: 1,
			placeholder: String(nextStep()),
		}),
	);
	const badge = document.createElement('button');
	badge.textContent = 'Set next step';
	badge.onclick = () => post({ op: 'style', indices: [ctx.ei], style: { step: nextStep() } });
	ctx.row('', badge);
	const colour = document.createElement('button');
	colour.textContent = 'Colour from source';
	colour.onclick = () => sourceColour([ctx.ei]);
	ctx.row('', colour);

	ctx.row(
		'Route',
		ctx.choice(routeOpts(ctx.e), ctx.e.route, (v) =>
			post({ op: 'arrow', index: ctx.ei, route: v, mid: null, bend: 0 }),
		),
	);
	ctx.row(
		'Heads',
		ctx.choice(HEAD_OPTS, ctx.e.head, (v) => post({ op: 'arrow', index: ctx.ei, head: v })),
	);
	ctx.row(
		'Label',
		ctx.field(show(ctx.e.label), (v) => post({ op: 'arrow', index: ctx.ei, label: tex(v) })),
	);
}
export function inspAttached(ctx) {
	ctx.section(ctx.attached.g ? 'Frame title' : 'Arrow label');
	const st = ctx.attached.style;
	ctx.row(
		'Text',
		ctx.field(show(ctx.attached.text), (v) => post({ op: 'label', ...store.selN.label, text: tex(v) })),
	);
	ctx.row(
		'Font size',
		ctx.choice([['', 'Inherit'], ...Object.keys(sizes).map((v) => [v, v])], st.font || '', (font) =>
			labelChange({ font }),
		),
	);
	for (const key of ['bold', 'italic', 'background'])
		ctx.row(
			key === 'background' ? 'Knock-out' : key,
			emphasisToggle(key, st[key], (v) => labelChange({ [key]: v }), true),
		);
	ctx.row(
		'Colour',
		styleColour('textColor', st.color || '', (v) => labelChange({ color: v.textColor })),
	);
	if (ctx.attached.e) {
		ctx.row(
			'Position',
			numberControl(st.pos ?? 0.5, (pos) => labelChange({ pos: Math.max(0, Math.min(1, pos ?? 0.5)) }), {
				step: 0.05,
			}),
		);
		ctx.row(
			'Side',
			ctx.choice(
				['', 'above', 'below', 'left', 'right'].map((v) => [v, v || 'Inherit']),
				st.side || '',
				(side) => labelChange({ side }),
			),
		);
	} else
		ctx.row(
			'Title at',
			ctx.choice(
				['above-left', 'above-center', 'inside-top-left', 'inside-top-right', 'below-left'].map((v) => [v, v]),
				ctx.attached.g.titlePosition || 'above-left',
				(titlePosition) => post({ op: 'groupProps', id: ctx.attached.g.id, titlePosition }),
			),
		);
	for (const k of ['dx', 'dy'])
		ctx.row(
			k === 'dx' ? 'Offset X' : 'Offset Y',
			ctx.field(st[k] || 0, (v) => labelChange({ [k]: +v }), { type: 'number' }),
			unit('mm'),
		);
	const reset = document.createElement('button');
	reset.textContent = 'Reset position';
	reset.onclick = () => labelChange({ pos: 0.5, segment: null, dx: 0, dy: 0, side: '' });
	ctx.row('', reset);
	const detach = document.createElement('button');
	detach.textContent = 'Detach';
	detach.onclick = () => {
		const G = ctx.attached.g
				? frameTitleGeom(ctx.attached.g)
				: arrowLabelGeom(ctx.attached.e, st, ctx.attached.text, ctx.attached.step),
			x = G.p[0],
			y = G.p[1],
			w = ctx.attached.g ? textMm(show(ctx.attached.text), G.pt, 'Sakuga Sans') : G.w;
		post({
			op: 'detachLabel',
			...store.selN.label,
			id: newId(),
			x: x + (G.align === 'start' ? w / 2 : G.align === 'end' ? -w / 2 : 0),
			y,
			width: Math.max(1, ctx.attached.g ? w : w - 2 * PT),
		});
		delete store.selN.label;
	};
	ctx.row('', detach);
	const copy = document.createElement('button');
	copy.textContent = 'Copy style';
	copy.onclick = copyStyle;
	const paste = document.createElement('button');
	paste.textContent = 'Paste style';
	paste.onclick = pasteStyle;
	ctx.row('', copy, paste);
}
export function tidyControl(parent) {
	const b = document.createElement('button');
	b.type = 'button';
	b.textContent = store.selN.size ? 'Tidy up' : 'Tidy up figure';
	b.title = 'Tidy up (Alt+T)';
	b.onmouseenter = previewTidy;
	b.onmouseleave = () => {
		if (!store.tidyHeld) cancelTidy();
	};
	b.onclick = () => {
		b.blur();
		applyTidy();
	};
	parent.append(b);
}
export function sketchControls(parent = inspector) {
	const bar = document.createElement('div');
	bar.className = 'sketch-controls';
	bar.setAttribute('role', 'group');
	bar.setAttribute('aria-label', 'Align, distribute and size');
	for (const [command, label, key, path] of SKETCH_CONTROLS) {
		const b = document.createElement('button');
		b.type = 'button';
		b.title = `${label} (${key})`;
		b.setAttribute('aria-label', b.title);
		b.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="${path}"/></svg>`;
		b.disabled =
			command.startsWith('distribute') &&
			coreSketch.units(store.nodes, store.groups, [...store.selN], layout).length < 3;
		b.onclick = () => {
			b.blur();
			runCommand(appState, `sketch.${command}`);
		};
		bar.appendChild(b);
	}
	parent.appendChild(bar);
	const hint = document.createElement('p');
	hint.className = 'empty';
	hint.textContent = store.selN.has(store.keyObject)
		? `Reference: ${show(byId(store.keyObject).title) || store.keyObject}`
		: 'Shift/Ctrl+click sets a reference';
	parent.appendChild(hint);
}
