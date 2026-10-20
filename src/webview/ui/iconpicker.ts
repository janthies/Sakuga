// @ts-nocheck
import { store } from '../store/store';
import { el, iconShape } from '../render/svg';
import { PT } from '../store/constants';
import { closeFloating, floatAt } from './floating';

export function previewIcon(name) {
	const preview = el('svg', {
		viewBox: '0 0 24 24',
		width: 20,
		height: 20,
		fill: 'none',
		stroke: '#666',
		'stroke-width': (0.6 * PT * 24) / 3,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
	});
	iconShape(preview, name);
	return preview;
}
export function buildIconPanel() {
	if (store.iconPanel) {
		closeFloating(false);
		store.iconPanel.remove();
	}
	store.iconPanel = document.createElement('div');
	store.iconPanel.className = 'floating-picker icon-panel';
	store.iconPanel.hidden = true;
	store.iconPanel.setAttribute('role', 'dialog');
	store.iconPanel.setAttribute('aria-label', 'Choose icon');
	const search = document.createElement('input');
	search.placeholder = 'Search icons';
	search.setAttribute('aria-label', 'Search icons');
	const body = document.createElement('div');
	body.className = 'icon-results';
	store.iconEntries = [];
	store.iconGroups = [];
	let active = 0;
	const entry = (name, parent, category = '') => {
		const b = document.createElement('button');
		b.type = 'button';
		b.title = name || 'No icon';
		b.setAttribute('aria-label', b.title);
		b.dataset.search = `${name} ${category} ${category.replace(/[-_]/g, ' ')}`.toLowerCase();
		b.dataset.value = name;
		b.tabIndex = -1;
		if (name) {
			b.append(previewIcon(name));
		} else {
			b.textContent = 'No icon';
			b.className = 'no-icon';
		}
		b.onclick = () => {
			const pick = store.chooseIcon;
			closeFloating();
			pick(name);
		};
		parent.append(b);
		store.iconEntries.push(b);
	};
	entry('', body);
	for (const category of [...new Set(store.icons.map((i) => i.category))].sort()) {
		const section = document.createElement('section'),
			h = document.createElement('h4'),
			grid = document.createElement('div');
		h.textContent = category.replace(/[-_]/g, ' ');
		grid.className = 'icon-grid';
		section.append(h, grid);
		body.append(section);
		for (const i of store.icons.filter((i) => i.category === category).sort((a, b) => a.name.localeCompare(b.name))) {
			entry(i.name, grid, category);
		}
		store.iconGroups.push(section);
	}
	const visible = () => store.iconEntries.filter((b) => !b.hidden);
	const mark = (index) => {
		const entries = visible();
		active = Math.max(0, Math.min(entries.length - 1, index));
		store.iconEntries.forEach((b) => b.classList.remove('active'));
		if (entries[active]) {
			entries[active].classList.add('active');
			entries[active].scrollIntoView({ block: 'nearest' });
		}
	};
	search.oninput = () => {
		const q = search.value.trim().toLowerCase();
		for (const b of store.iconEntries) {
			b.hidden = !!b.dataset.value && !b.dataset.search.includes(q);
		}
		for (const group of store.iconGroups) {
			group.hidden = ![...group.querySelectorAll('button')].some((b) => !b.hidden);
		}
		mark(0);
	};
	store.iconPanel.onkeydown = (e) => {
		if (e.key.startsWith('Arrow')) {
			const entries = visible(),
				current = entries[active];
			let next = active + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
			if (current && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
				const a = current.getBoundingClientRect(),
					dir = e.key === 'ArrowDown' ? 1 : -1;
				const row = entries
					.map((b, i) => ({ i, r: b.getBoundingClientRect() }))
					.filter((v) => dir * (v.r.top - a.top) > 1)
					.sort(
						(u, v) =>
							Math.abs(u.r.top - a.top) - Math.abs(v.r.top - a.top) ||
							Math.abs(u.r.left - a.left) - Math.abs(v.r.left - a.left),
					);
				if (row.length) {
					next = row[0].i;
				}
			}
			mark(next);
			search.focus();
			e.preventDefault();
			e.stopPropagation();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			e.stopPropagation();
			visible()[active]?.click();
		}
	};
	store.iconPanel.append(search, body);
	document.body.append(store.iconPanel);
	store.iconPanel.reset = (value) => {
		search.value = '';
		search.oninput();
		const i = visible().findIndex((b) => b.dataset.value === value);
		mark(Math.max(0, i));
		search.focus();
	};
}
export function iconPicker(value, onChange) {
	const b = document.createElement('button');
	b.type = 'button';
	b.className = 'icon-picker';
	b.title = value || 'Choose icon';
	b.setAttribute('aria-label', 'Choose icon');
	b.setAttribute('aria-haspopup', 'dialog');
	b.setAttribute('aria-expanded', 'false');
	if (value) {
		b.append(previewIcon(value));
	} else {
		b.textContent = '+';
	}
	b.onclick = () => {
		if (!store.iconPanel) {
			buildIconPanel();
		}
		store.chooseIcon = onChange;
		floatAt(store.iconPanel, b);
		store.iconPanel.reset(value);
	};
	return b;
}
