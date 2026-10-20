// @ts-nocheck
import { SIZE_LABEL } from '../store/constants';

export function unit(s) {
	const u = document.createElement('span');
	u.className = 'unit';
	u.textContent = s;
	return u;
}
export function label(s) {
	const u = document.createElement('code');
	u.textContent = s;
	return u;
}
export function numberControl(value, change, { step = 0.05, min = 0, placeholder = '' } = {}) {
	const input = document.createElement('input');
	input.type = 'number';
	input.step = String(step);
	input.min = String(min);
	input.value = value ?? '';
	input.placeholder = placeholder;
	input.addEventListener('change', () => {
		const v = input.value === '' ? null : +input.value;
		if (v === null || (Number.isFinite(v) && v >= min && (step !== 1 || Number.isInteger(v)))) change(v);
	});
	return input;
}
export function segmented(options, value, change) {
	const wrap = document.createElement('div');
	wrap.className = 'segments';
	wrap.value = value;
	wrap.setAttribute('role', 'group');
	if (value === '*') {
		const mixed = document.createElement('span');
		mixed.textContent = 'Mixed';
		mixed.className = 'mixed';
		wrap.append(mixed);
	}
	for (const [v, name, tip, text] of options) {
		if (v === '*') continue;
		const b = document.createElement('button');
		b.type = 'button';
		b.title = tip || name;
		b.setAttribute('aria-label', tip || name);
		b.setAttribute('aria-pressed', String(v === value));
		b.innerHTML = text !== undefined ? `<span>${text}</span>` : choiceGlyph(v, name);
		b.onclick = () => change(v);
		wrap.append(b);
	}
	return wrap;
}
// Small visual choices share one keyboard-accessible button vocabulary.
export function emphasisToggle(key, value, change, inherit = false) {
	const wrap = document.createElement('div');
	wrap.className = 'segments';
	wrap.setAttribute('role', 'group');
	wrap.setAttribute('aria-label', key);
	if (inherit) {
		const reset = document.createElement('button');
		reset.type = 'button';
		reset.textContent = '↶';
		reset.title = 'Inherit';
		reset.setAttribute('aria-label', 'Inherit ' + key);
		reset.setAttribute('aria-pressed', String(value === undefined));
		reset.onclick = () => change(null);
		wrap.append(reset);
	}
	const b = document.createElement('button');
	b.type = 'button';
	b.title = key;
	b.setAttribute('aria-label', key);
	b.setAttribute('aria-pressed', String(!!value));
	b.innerHTML = choiceGlyph(key, key);
	b.onclick = () => change(!value);
	wrap.append(b);
	return wrap;
}
export function choiceGlyph(v, name) {
	const lineWeights = { Thin: 1, Medium: 2, Thick: 3.4 };
	if (lineWeights[name])
		return `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="${lineWeights[name]}" stroke-linecap="round" aria-hidden="true"><path d="M2 8h12"/></svg>`;
	const paths = {
		rectangle: 'M2 4h12v8H2z',
		pill: 'M6 4h4a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8z',
		ellipse: 'M8 4a6 4 0 1 1 0 8a6 4 0 1 1 0-8',
		circle: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12',
		diamond: 'M8 2l6 6-6 6-6-6z',
		cylinder: 'M2 5c0-4 12-4 12 0v6c0 4-12 4-12 0z M2 5c0 4 12 4 12 0',
		straight: 'M2 12L14 4',
		end: 'M2 8h12M10 4l4 4-4 4',
		both: 'M2 8h12M6 4L2 8l4 4M10 4l4 4-4 4',
		manhattan: 'M2 12h6V4h6',
		curved: 'M2 12C12 12 4 4 14 4',
		hatched: 'M3 13L13 3M3 8L8 3M8 13L13 8',
		crosshatch: 'M3 13L13 3M3 8L8 3M8 13L13 8M3 3L13 13M3 8L8 13M8 3L13 8',
		dots: 'M4 4h.1M8 4h.1M12 4h.1M4 8h.1M8 8h.1M12 8h.1M4 12h.1M8 12h.1M12 12h.1',
		horizontal: 'M2 4h12M2 8h12M2 12h12',
		vertical: 'M4 2v12M8 2v12M12 2v12',
		u: 'M2 4v8h12V4',
		auto: 'M2 12h6V4h6 M2 3h3 M3.5 1.5v3',
		none: 'M3 13L13 3',
		solid: 'M2 8h12',
		dashed: 'M2 8h3m3 0h3m2 0h1',
		dotted: 'M2 8h.1m3 0h.1m3 0h.1m3 0h.1',
		double: 'M2 6h12M2 10h12',
		Latex: 'M2 8h12M10 4l4 4-4 4',
		Stealth: 'M2 8h12M9 3l5 5-5 5 2-5z',
		triangle: 'M3 12L8 3l5 9z',
		barb: 'M2 8h12M10 4l4 4-4 4',
		bar: 'M2 8h10M12 3v10',
		bold: 'M5 2h4a3 3 0 0 1 0 6H5V2z M5 8h5a3 3 0 0 1 0 6H5V8z',
		italic: 'M7 2h6M3 14h6M10 2L6 14',
		'bold-italic': 'M5 2h4a3 3 0 0 1 0 6H5V2z M5 8h5a3 3 0 0 1 0 6H5V8z M14 3l-2 10',
		above: 'M2 11h12M5 7l3-4 3 4',
		below: 'M2 5h12M5 9l3 4 3-4',
		left: 'M11 2v12M7 5L3 8l4 3',
		right: 'M5 2v12M9 5l4 3-4 3',
	};
	const path = paths[v];
	if (path)
		return `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
	if (!v && /outline/i.test(name)) return choiceGlyph('solid', 'Solid');
	if (!v && name === 'Normal') return '<span>N</span>';
	if (!v && name === 'None') return choiceGlyph('none', 'None');
	if (!v)
		return '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="2" y="4" width="12" height="8" rx="2"/></svg>';
	return `<span>${String(name).replace(/[&<>"']/g, '')}</span>`;
}
// Outline width: thin / medium / thick, and a number only on demand.
export function weightControl(objects, change) {
	const first = objects[0].style || {},
		key = (o) => `${o.style?.weight || ''}|${o.style?.lineWidth ?? ''}`;
	const same = objects.every((o) => key(o) === key(objects[0])),
		custom = objects.some((o) => o.style?.lineWidth !== undefined);
	const wrap = document.createElement('div');
	wrap.className = 'width-control';
	wrap.append(
		segmented(
			[
				['', 'Thin'],
				['medium', 'Medium'],
				['thick', 'Thick'],
			],
			same ? (custom ? '#' : first.weight || '') : '*',
			(v) => change({ weight: v }),
		),
	);
	const number = numberControl(
		first.lineWidth ?? ({ medium: 0.8, thick: 1.2 }[first.weight] || 0.45),
		(v) => change({ lineWidth: v ?? 0.45 }),
		{ min: 0.05 },
	);
	number.hidden = !custom;
	number.setAttribute('aria-label', 'Line width (pt)');
	const toggle = document.createElement('button');
	toggle.type = 'button';
	toggle.className = 'custom-toggle';
	toggle.textContent = 'custom';
	toggle.title = 'Enter a line width in pt';
	toggle.setAttribute('aria-pressed', String(custom));
	toggle.onclick = () => {
		number.hidden = !number.hidden;
		toggle.setAttribute('aria-pressed', String(!number.hidden));
		if (!number.hidden) number.focus();
	};
	wrap.append(toggle, number);
	return wrap;
}
// Font sizes as one row of buttons labelled with the point size.
export function sizeSegments(options, value, change) {
	return segmented(
		options.map(([v, label]) =>
			v === '*'
				? [v, label]
				: [v, label, v ? `${label} (${SIZE_LABEL[v] || '?'} pt)` : label, v ? SIZE_LABEL[v] || v : 'Auto'],
		),
		value,
		change,
	);
}
