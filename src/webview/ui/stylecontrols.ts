// @ts-nocheck
import { store } from '../store/store';
import { ANCHORS, ARROW, show, sizes } from '../store/constants';
import { choiceGlyph, numberControl, segmented, sizeSegments, weightControl } from './controls';
import { fillOf, styleColor } from '../render/svg';
import { saveState } from '../store/prefs';
import { byId } from '../store/model';
import { visualChoice } from './choices';

export function styleSelect(prop, values, objects, change) {
	if (values === null) {
		const mixed = objects.some((o) => o.style?.[prop] !== objects[0].style?.[prop]);
		const defaults = { lineWidth: 0.45, tipLength: 1.5, tipWidth: 1.2 };
		return numberControl(
			mixed
				? null
				: (objects[0].style?.[prop] ??
						(prop === 'lineWidth' ? { medium: 0.8, thick: 1.2 }[objects[0].style?.weight] || 0.45 : defaults[prop])),
			(v) => change({ [prop]: v ?? defaults[prop] }),
			{ min: 0.05, placeholder: mixed ? 'Mixed' : '' },
		);
	}
	const select = document.createElement('select');
	select.setAttribute('aria-label', prop);
	const get = (o) =>
		o.style?.[prop] ||
		(prop === 'start'
			? o.head === 'both'
				? 'Latex'
				: 'none'
			: prop === 'end'
				? o.head === 'none'
					? 'none'
					: 'Latex'
				: prop === 'border' && o.kind === 'arr-dashed'
					? 'dashed'
					: '');
	const value = objects.every((o) => get(o) === get(objects[0])) ? get(objects[0]) : '*';
	if (['fill', 'color', 'patternColor', 'markColor'].includes(prop)) {
		return styleColour(prop, value, change);
	}
	if (prop === 'text') {
		const wrap = document.createElement('div');
		wrap.className = 'segments';
		wrap.value = value;
		wrap.setAttribute('role', 'group');
		wrap.setAttribute('aria-label', 'Text emphasis');
		for (const key of ['bold', 'italic']) {
			const b = document.createElement('button');
			b.type = 'button';
			b.title = key;
			b.setAttribute('aria-label', key);
			b.setAttribute('aria-pressed', value === '*' ? 'mixed' : String(value.includes(key)));
			b.innerHTML = choiceGlyph(key, key);
			b.onclick = () => {
				const bold = key === 'bold' ? !value.includes('bold') : value.includes('bold'),
					italic = key === 'italic' ? !value.includes('italic') : value.includes('italic');
				change({ text: bold && italic ? 'bold-italic' : bold ? 'bold' : italic ? 'italic' : '' });
			};
			wrap.append(b);
		}
		return wrap;
	}
	if (prop === 'font')
		return sizeSegments(
			values.map((v) => [v, v || 'Figure font size']),
			value,
			(v) => change({ font: v }),
		);
	if (prop === 'markSize')
		return segmented(
			[
				['', 'Small (2.4 mm)', undefined, 'S'],
				['medium', 'Medium (5 mm)', undefined, 'M'],
			],
			value,
			(v) => change({ markSize: v }),
		);
	if (prop === 'weight') return weightControl(objects, change);
	if (['shape', 'border', 'text', 'start', 'end', 'side', 'position', 'mark', 'markCorner', 'pattern'].includes(prop))
		return segmented(
			values.map((v) => [
				v,
				{ nw: 'Top left', ne: 'Top right', sw: 'Bottom left', se: 'Bottom right' }[v] ||
					v ||
					{
						shape: 'Rounded rectangle',
						border: 'Default outline',
						text: 'Normal',
						position: 'Middle',
						side: 'On the line',
						mark: 'None',
						pattern: 'None',
					}[prop] ||
					'Default',
			]),
			value,
			(v) => change({ [prop]: v }),
		);
	for (const v of value === '*' ? ['*', ...values] : values) {
		select.add(
			new Option(
				v === '*'
					? '(mixed)'
					: {
							nw: 'top left',
							se: 'bottom right',
							sw: 'bottom left',
							medium: prop === 'markSize' ? 'medium (5 mm)' : 'medium',
						}[v] ||
							v ||
							{
								shape: 'rounded rectangle',
								fill: 'category',
								border: 'solid',
								color: 'grey',
								weight: 'thin',
								text: 'normal',
								font: 'figure',
								position: 'middle',
								side: 'on the line',
								pattern: 'none',
								mark: 'none',
								markCorner: 'top right',
								markSize: 'small (2.4 mm)',
							}[prop] ||
							'default',
				v,
			),
		);
	}
	select.value = value;
	select.onchange = () => {
		if (select.value !== '*') {
			if (prop === 'mark') {
				select.blur();
			}
			change({ [prop]: select.value });
		}
	};
	return select;
}
export function styleColour(prop, value, change) {
	const wrap = document.createElement('div');
	wrap.className = 'style-colour';
	const defaults = {
		fill: 'style / white',
		color: 'grey',
		patternColor: 'black 25%',
		markColor: '#33333A',
		textColor: 'black',
	};
	const options = [
		{ value: '', label: defaults[prop] },
		...Object.keys(store.palette).map((k) => ({ value: k, label: k, color: styleColor(k, '#fff') })),
		...(prop === 'fill' ? [{ value: 'none', label: 'none' }] : []),
		...store.recentColors.map((k) => ({ value: k, label: k, color: k })),
	];
	if (value === '*') {
		options.unshift({ value: '*', label: '(mixed)' });
	} else if (value && !options.some((o) => o.value === value)) {
		options.push({ value, label: value, color: styleColor(value, '#fff') });
	}
	const apply = (v) => {
		if (v !== '*') {
			change({ [prop]: v });
		}
	};
	const picker = document.createElement('input');
	picker.type = 'color';
	picker.setAttribute('aria-label', `${prop} custom colour`);
	picker.value = /^#[0-9a-f]{6}$/i.test(value) ? value : prop === 'markColor' ? '#33333a' : '#000000';
	const hex = document.createElement('input');
	hex.type = 'text';
	hex.placeholder = '#RRGGBB';
	hex.setAttribute('aria-label', `${prop} hex colour`);
	hex.value = /^#[0-9a-f]{6}$/i.test(value) ? value : '';
	hex.maxLength = 7;
	const custom = (raw) => {
		const v = (raw.startsWith('#') ? raw : '#' + raw).toUpperCase();
		if (!/^#[0-9A-F]{6}$/.test(v)) {
			hex.setCustomValidity('Enter a six-digit hex colour');
			hex.reportValidity();
			return;
		}
		hex.setCustomValidity('');
		hex.value = v;
		picker.value = v;
		store.recentColors = [v, ...store.recentColors.filter((c) => c !== v)].slice(0, 8);
		saveState();
		apply(v);
	};
	picker.onchange = () => custom(picker.value);
	hex.oninput = () => hex.setCustomValidity('');
	hex.onchange = () => custom(hex.value);
	const swatches = document.createElement('div');
	swatches.className = 'colour-swatches';
	swatches.value = value;
	swatches.options = options;
	swatches.onSelect = apply;
	swatches.setAttribute('role', 'group');
	swatches.setAttribute('aria-label', prop + ' colours');
	for (const option of options) {
		if (option.value === '*') continue;
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'colour-swatch' + (option.value === 'none' ? ' no-colour' : '');
		b.title = option.label;
		b.setAttribute('aria-label', option.label);
		b.setAttribute('aria-pressed', String(option.value === value));
		b.style.setProperty(
			'--swatch',
			option.color ||
				(prop === 'fill'
					? typeof store.selN === 'undefined'
						? '#ffffff'
						: fillOf(byId([...store.selN][0])?.cat)
					: '#9e9e9e'),
		);
		b.onclick = () => apply(option.value);
		swatches.append(b);
	}
	const customButton = document.createElement('button');
	customButton.type = 'button';
	customButton.className = 'colour-swatch custom-colour';
	customButton.textContent = '+';
	customButton.title = 'Custom hex colour';
	customButton.setAttribute('aria-label', 'Custom hex colour');
	customButton.onclick = () => {
		hex.hidden = !hex.hidden;
		if (!hex.hidden) hex.focus();
	};
	swatches.append(customButton);
	if (value === '*') {
		const mixed = document.createElement('span');
		mixed.textContent = 'Mixed';
		mixed.className = 'mixed';
		swatches.append(mixed);
	}
	hex.hidden = true;
	picker.hidden = true;
	wrap.append(swatches, picker, hex);
	return wrap;
}
export const styleSwatch = (def) =>
	def.kind === 'box'
		? styleColor(def.props.fill, '#ffffff')
		: def.kind === 'arrow'
			? styleColor(def.props.color, ARROW)
			: def.kind === 'label'
				? styleColor(def.props.textColor, '#444444')
				: styleColor(def.props.color, '#bbbbbb');
export function styleChoice(kind, value, onChange) {
	const options = [
		{ value: '', label: 'Plain', color: '#ffffff' },
		...store.styles
			.filter((s) => s.kind === kind)
			.map((s) => ({ value: s.key, label: show(s.name), color: styleSwatch(s), icon: s.icon })),
	];
	if (value === '*') {
		options.unshift({ value: '*', label: '(mixed)' });
	}
	const b = visualChoice(options, value, onChange);
	b.setAttribute('aria-label', 'Style');
	return b;
}
export function titlePositionPicker(options, value, change) {
	const wrap = document.createElement('div');
	wrap.className = 'title-position';
	wrap.setAttribute('role', 'group');
	wrap.setAttribute('aria-label', 'Title position');
	const slots = [
		'above-left',
		'above-center',
		null,
		null,
		null,
		null,
		'inside-top-left',
		null,
		'inside-top-right',
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		'below-left',
		null,
		null,
		null,
		null,
	];
	const allowed = new Map(options);
	for (const v of slots) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = '·';
		b.disabled = !v || !allowed.has(v);
		b.title = v ? allowed.get(v) || v : 'Position unavailable';
		b.setAttribute('aria-label', b.title);
		b.setAttribute('aria-pressed', String(v === value));
		if (v) b.onclick = () => change(v);
		wrap.append(b);
	}
	if (allowed.has('legacy')) {
		const b = document.createElement('button');
		b.textContent = 'Original';
		b.className = 'legacy-position';
		b.title = 'Original placement';
		b.onclick = () => change('legacy');
		wrap.append(b);
	}
	return wrap;
}
export function anchorPicker(value, change) {
	const grid = document.createElement('div');
	grid.className = 'anchor-picker';
	grid.setAttribute('role', 'group');
	grid.setAttribute('aria-label', 'Anchor');
	for (const a of ANCHORS) {
		const b = document.createElement('button');
		b.textContent = '·';
		b.title = a;
		b.setAttribute('aria-label', a);
		b.setAttribute('aria-pressed', String(a === value));
		b.onclick = () => change(a);
		grid.append(b);
	}
	return grid;
}
// Inspector: the selection, the categories of this figure, and figure settings.
export const styleFields = (arrow) => [
	...(arrow
		? []
		: [
				['Shape', 'shape', ['', 'rectangle', 'pill', 'ellipse', 'circle', 'diamond', 'cylinder']],
				['Text', 'text', ['', 'bold', 'italic', 'bold-italic']],
				['Font size', 'font', ['', ...Object.keys(sizes)]],
				['Colour', 'fill', ['', ...Object.keys(store.palette), 'none']],
				['Pattern', 'pattern', ['', 'hatched', 'crosshatch', 'dots', 'horizontal', 'vertical']],
				['Pattern colour', 'patternColor', ['', ...Object.keys(store.palette)]],
				['Corner mark', 'mark', ['', 'triangle', 'circle']],
				['Corner', 'markCorner', ['', 'nw', 'se', 'sw']],
				['Mark size', 'markSize', ['', 'medium']],
				['Mark colour', 'markColor', ['', ...Object.keys(store.palette)]],
			]),
	['Line', 'border', ['', 'solid', 'dashed', 'dotted', 'none', ...(arrow ? [] : ['double'])]],
	['Colour', 'color', ['', ...Object.keys(store.palette)]],
	...(arrow
		? [
				['Line width (pt)', 'lineWidth', null],
				['Tip length (mm)', 'tipLength', null],
				['Tip width (mm)', 'tipWidth', null],
			]
		: [['Width', 'weight', ['', 'medium', 'thick']]]),
	...(arrow
		? [
				['Start', 'start', ['none', 'Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar']],
				['End', 'end', ['Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar', 'none']],
				['Label at', 'position', ['', 'start', 'end']],
				['Label side', 'side', ['', 'above', 'below', 'left', 'right']],
			]
		: []),
];
