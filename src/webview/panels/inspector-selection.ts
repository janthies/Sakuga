// @ts-nocheck
import * as coreText from '../../core/text';
import { store } from '../store/store';
import { inspArrow, inspAttached, sketchControls, tidyControl } from './inspector-arrow';
import { byId, effectiveIcon, fontPt, groupById, isOverride, layout, nodeStyleKind, post } from '../store/model';
import { labelTarget } from '../render/labelgeom';
import { inspGroup, inspNode } from './inspector-node';
import { render } from '../render/scene';
import { unit } from '../ui/controls';
import { moveToLayer, selectedRoots } from '../store/layers';
import { styleColour, styleFields, styleSelect } from '../ui/stylecontrols';
import { markOverride } from './inspector-styles';
import { HEAD_OPTS, ROUTE_OPTS, r1, show, sizes, smallerPt, tex } from '../store/constants';
import { copyStyle, pasteStyle, resetToAuto } from '../commands/styles';
import { iconPicker } from '../ui/iconpicker';

export function inspectorSelection(ctx) {
	if (store.selN.size >= 2) {
		sketchControls(ctx.getSection('Arrange'));
	}
	if (!store.selE.size || store.selN.size) tidyControl(ctx.getSection('Arrange'));
	ctx.count = store.selN.size + store.selE.size;
	ctx.n = ctx.count === 1 && store.selN.size ? byId([...store.selN][0]) : null;
	ctx.ei = ctx.count === 1 && store.selE.size ? [...store.selE][0] : -1;
	ctx.e = ctx.ei >= 0 ? store.edges[ctx.ei] : null;
	ctx.group = groupById(store.selG);
	const layer = store.selectedLayers.size ? store.layers.find((l) => l.id === store.activeLayer) : null;
	ctx.attached = store.selN.label ? labelTarget() : null;
	if (ctx.attached) {
		inspAttached(ctx);
	} else if (layer) {
		ctx.section('Layer');
		ctx.row(
			'Name',
			ctx.field(layer.name, (name) => post({ op: 'layerProps', id: layer.id, name })),
		);
	} else if (ctx.group) {
		inspGroup(ctx);
	} else if (ctx.n) {
		inspNode(ctx);
	} else if (ctx.e) {
		inspArrow(ctx);
	} else if (ctx.count > 1) {
		inspMulti(ctx);
	}
	const opacityObjects = layer
		? store.layers.filter((l) => store.selectedLayers.has(l.id))
		: [...store.selN].map(byId).concat([...store.selE].map((i) => store.edges[i]));
	if (opacityObjects.length) {
		const values = opacityObjects.map((o) => (layer ? (o.opacity ?? 1) : (o.style?.opacity ?? 1))),
			mixed = values.some((v) => v !== values[0]);
		const slider = document.createElement('input'),
			number = document.createElement('input');
		slider.type = 'range';
		number.type = 'number';
		for (const control of [slider, number]) {
			control.min = '0';
			control.max = '100';
			control.step = '1';
			control.setAttribute('aria-label', 'Opacity (%)');
		}
		slider.value = Math.round(values[0] * 100);
		number.value = mixed ? '' : slider.value;
		number.placeholder = mixed ? 'Mixed' : '';
		slider.title = mixed ? 'Mixed opacity' : 'Opacity';
		const change = (control) => {
			if (control.value === '' || !Number.isFinite(+control.value)) {
				return;
			}
			const value = Math.max(0, Math.min(100, +control.value));
			slider.value = number.value = value;
			post(
				layer
					? { op: 'batch', ops: opacityObjects.map((l) => ({ op: 'layerProps', id: l.id, opacity: value / 100 })) }
					: { op: 'style', ids: [...store.selN], indices: [...store.selE], style: { opacity: value / 100 } },
			);
		};
		slider.oninput = () => {
			number.value = slider.value;
			const value = +slider.value / 100;
			for (const object of opacityObjects) {
				if (layer) {
					object.opacity = value;
				} else {
					object.style = { ...object.style, opacity: value };
				}
			}
			render();
		};
		slider.onchange = () => change(slider);
		number.onchange = () => change(number);
		ctx.row('Opacity', slider, number, unit('%')).classList.add('opacity-row');
	}
	if (store.selN.size) {
		const selected = [...store.selN].map(byId);
		for (const key of ['x', 'y']) {
			const same = selected.every((n) => n[key] === selected[0][key]);
			ctx.row(
				key.toUpperCase(),
				ctx.field(
					same ? selected[0][key] : '',
					(v) =>
						post({
							op: 'batch',
							ops: selected.map((n) => ({
								op: 'move',
								id: n.id,
								x: key === 'x' ? +v : n.x,
								y: key === 'y' ? +v : n.y,
							})),
						}),
					{ type: 'number' },
				),
				unit('mm'),
			);
		}
	}
	if (store.selN.size || store.selG) {
		ctx.row(
			'Move to layer',
			ctx.choice([['', 'Choose…'], ...store.layers.map((l) => [l.id, l.name])], '', (value) => {
				if (value) {
					moveToLayer(selectedRoots(), value);
				}
			}),
		);
	}
	for (const arrow of [false, true]) {
		const objects = arrow
			? [...store.selE].map((i) => store.edges[i])
			: [...store.selN].map(byId).filter((n) => n.kind !== 'icon');
		if (!objects.length) {
			continue;
		}
		ctx.section(arrow ? 'Arrow style' : 'Style');
		for (const [name, prop, values] of styleFields(arrow)) {
			ctx.current = ['text', 'font', 'textColor'].includes(prop)
				? 'Text'
				: prop === 'fill'
					? 'Fill'
					: ['border', 'color', 'weight', 'lineWidth'].includes(prop)
						? 'Outline'
						: ['start', 'end'].includes(prop)
							? 'Route & tips'
							: 'Shape & decoration';
			if (
				['markCorner', 'markSize', 'markColor'].includes(prop) &&
				!objects.some((o) => o.style?.mark && o.style.mark !== 'none')
			)
				continue;
			const control = styleSelect(prop, values, objects, (style) =>
				post({
					op: 'batch',
					ops: [{ op: 'style', ...(arrow ? { indices: [...store.selE] } : { ids: [...store.selN] }), style }],
				}),
			);
			control._inspectorSection = ctx.current;
			const styledRow = ctx.row(name, control);
			if (objects.some((o) => isOverride(o, prop)))
				markOverride(styledRow, arrow ? null : [...store.selN], arrow ? [...store.selE] : null, [prop]);
			if (!arrow && prop === 'font' && objects.every((n) => !n.kind)) {
				const same = objects.every((n) => (n.codeFont || '') === (objects[0].codeFont || ''));
				ctx.row(
					'Code size',
					ctx.choice(
						[
							...(same ? [] : [['*', 'Mixed']]),
							['', 'One step below title'],
							...['tiny', ...Object.keys(sizes)]
								.filter((v) => coreText.sizes[v] <= Math.min(...objects.map((n) => smallerPt(fontPt(n)))))
								.map((v) => [v, v]),
						],
						same ? objects[0].codeFont || '' : '*',
						(codeFont) => {
							if (codeFont !== '*')
								post({ op: 'batch', ops: objects.map((n) => ({ op: 'node', id: n.id, codeFont })) });
						},
					),
				);
				for (const n of objects)
					if (n.wantWidth !== undefined) {
						const hint = document.createElement('p');
						hint.className = 'empty';
						hint.textContent = 'box widened to fit `' + coreText.need(n, store.figureFont).content + '`';
						ctx.getSection('Text').append(hint);
					}
			}
		}
	}
	if (ctx.n) {
		ctx.current = 'Text';
		const colourRow = ctx.row(
			'Text colour',
			styleColour('textColor', ctx.n.style?.textColor || '', (style) => post({ op: 'style', ids: [ctx.n.id], style })),
		);
		if (isOverride(ctx.n, 'textColor')) markOverride(colourRow, [ctx.n.id], null, ['textColor']);
	}
	if (ctx.count > 0) {
		const b1 = document.createElement('button');
		b1.textContent = 'Copy style';
		b1.title = 'Ctrl+Alt+C';
		b1.addEventListener('click', copyStyle);
		const b2 = document.createElement('button');
		b2.textContent = 'Paste style';
		b2.title = 'Ctrl+Alt+V';
		b2.disabled = !store.styleClip;
		b2.addEventListener('click', pasteStyle);
		const r = document.createElement('div');
		r.className = 'buttons';
		r.append(b1, b2);
		ctx.getSection('Arrange').appendChild(r);
	} else if (!layer && !ctx.group && !ctx.attached) {
		ctx.section('Selection');
		const p = document.createElement('p');
		p.className = 'empty';
		p.textContent = 'Nothing selected';
		ctx.selection.appendChild(p);
	}
}
function inspMulti(ctx) {
	ctx.section(`${store.selN.size} boxes, ${store.selE.size} arrows`);
	if (store.selN.size) {
		const ids = [...store.selN];
		const selected = ids.map(byId);
		const titleSame = selected.every((n) => n.title === selected[0].title);
		const title = ctx.field(titleSame ? show(selected[0].title) : '', (v) =>
			post({ op: 'batch', ops: ids.map((id) => ({ op: 'node', id, title: tex(v) })) }),
		);
		title.placeholder = titleSame ? '' : 'Mixed';
		ctx.row('Title', title);
		for (const [name, key] of [
			['Width', 'width'],
			['Height', 'minh'],
		]) {
			const values = selected.map((n) => (key === 'minh' ? +r1(layout(n).h) : n.width)),
				same = values.every((v) => v === values[0]);
			const size = ctx.field(
				same ? values[0] : '',
				(v) => post({ op: 'batch', ops: ids.map((id) => ({ op: 'node', id, [key]: +v })) }),
				{ type: 'number' },
			);
			size.placeholder = same ? '' : 'Mixed';
			size.min = '0';
			size.step = '0.5';
			ctx.row(name, size, unit('mm'));
		}
		const commonIcon = ids.every((id) => effectiveIcon(byId(id)) === effectiveIcon(byId(ids[0])))
			? effectiveIcon(byId(ids[0]))
			: '';
		ctx.row(
			'Icon',
			iconPicker(commonIcon, (icon) =>
				post({
					op: 'batch',
					ops: ids.map((id) => ({ op: 'node', id, icon: icon || (byId(id).kind === 'icon' ? '' : 'none') })),
				}),
			),
		);
		const boxes = ids.filter((id) => byId(id).kind !== 'icon');
		if (boxes.length) {
			ctx.row(
				'Position',
				ctx.choice(
					[
						['left', 'Left of title'],
						['above', 'Above title'],
						['right', 'Right of title'],
						['nw', 'Top left'],
						['ne', 'Top right'],
						['sw', 'Bottom left'],
						['se', 'Bottom right'],
					],
					byId(boxes[0]).iconPosition || 'left',
					(iconPosition) => post({ op: 'batch', ops: boxes.map((id) => ({ op: 'node', id, iconPosition })) }),
				),
			);
			const inherit = document.createElement('button');
			inherit.textContent = 'Use style icons';
			inherit.onclick = () => post({ op: 'batch', ops: boxes.map((id) => ({ op: 'node', id, icon: 'category' })) });
			ctx.row('Icons', inherit);
		}
		const styled = ids.filter((id) => nodeStyleKind(byId(id)));
		if (styled.length && styled.every((id) => nodeStyleKind(byId(id)) === nodeStyleKind(byId(styled[0])))) {
			ctx.styleHeader(styled);
		}
	}
	if (store.selE.size) {
		const ix = [...store.selE];
		const reset = document.createElement('button');
		reset.textContent = 'Reset to auto';
		reset.onclick = () => resetToAuto(ix);
		ctx.row('', reset);
		for (const [name, prop, opts] of [
			['Route', 'route', ROUTE_OPTS],
			['Heads', 'head', HEAD_OPTS],
		]) {
			const same = ix.every((i) => store.edges[i][prop] === store.edges[ix[0]][prop]) ? store.edges[ix[0]][prop] : '*';
			ctx.row(
				name,
				ctx.choice(same === '*' ? [['*', '(mixed)'], ...opts] : opts, same, (v) => {
					if (v !== '*') {
						post({ op: 'batch', ops: ix.map((i) => ({ op: 'arrow', index: i, [prop]: v })) });
					}
				}),
			);
		}
	}
}
