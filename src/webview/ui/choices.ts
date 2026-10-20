// @ts-nocheck
import { store } from '../store/store';
import { previewIcon } from './iconpicker';
import { closeFloating, floatAt } from './floating';
import { catOf } from '../store/model';
import { fillOf, styleColor } from '../render/svg';

export function visualChoice(options, value, onChange) {
	const b = document.createElement('button');
	b.type = 'button';
	b.className = 'visual-choice';
	b.setAttribute('aria-haspopup', 'listbox');
	b.setAttribute('aria-expanded', 'false');
	const paint = (target, option) => {
		if (option.color) {
			const sw = document.createElement('i');
			sw.className = 'swatch';
			sw.style.background = option.color;
			target.append(sw);
		}
		if (option.icon) {
			target.append(previewIcon(option.icon));
		}
		const name = document.createElement('span');
		name.textContent = option.label;
		target.append(name);
	};
	paint(b, options.find((o) => o.value === value) || options[0]);
	b.onclick = () => {
		const panel = document.createElement('div');
		panel.className = 'floating-picker choice-panel';
		panel.setAttribute('role', 'listbox');
		panel.setAttribute('aria-label', 'Choose value');
		for (const o of options) {
			const item = document.createElement('button');
			item.type = 'button';
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', String(o.value === value));
			paint(item, o);
			item.onclick = () => {
				closeFloating();
				panel.remove();
				onChange(o.value);
			};
			panel.append(item);
		}
		document.querySelectorAll('.choice-panel').forEach((p) => p.remove());
		document.body.append(panel);
		floatAt(panel, b);
		const items = [...panel.children];
		(items[options.findIndex((o) => o.value === value)] || items[0]).focus();
		panel.onkeydown = (e) => {
			let i = items.indexOf(document.activeElement);
			if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
				i =
					e.key === 'Home'
						? 0
						: e.key === 'End'
							? items.length - 1
							: (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
				items[i].focus();
				e.preventDefault();
				e.stopPropagation();
			} else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
				const found = items.find((item) => item.textContent.toLowerCase().startsWith(e.key.toLowerCase()));
				found?.focus();
				e.stopPropagation();
			}
		};
	};
	return b;
}
function categoryChoice(options, value, onChange) {
	return visualChoice(
		options.map(([value, label]) => {
			const c = catOf(value);
			return { value, label, color: c ? fillOf(value) : '', icon: c?.icon };
		}),
		value,
		onChange,
	);
}
function colourChoice(value, onChange) {
	return visualChoice(
		Object.keys(store.palette).map((k) => ({ value: k, label: k, color: styleColor(k, '#fff') })),
		value,
		onChange,
	);
}
