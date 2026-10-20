import { ControlState, Field, Mixed, h, isMixed } from './control';
import { PT } from '../store/constants';
import { el, iconShape } from '../render/svg';
import { store } from '../store/store';
import { closeFloating, floatAt } from './floating';

export function previewIcon(name: string): SVGElement {
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

// Clears the search and marks the current icon; set whenever the palette is built.
let resetPanel: (value: string) => void = () => {};

// The floating palette with a search field and every icon of the catalogue, built once and reused by every picker.
export function buildIconPanel() {
	if (store.iconPanel) {
		closeFloating(false);
		store.iconPanel.remove();
	}
	const panel = h('div', 'floating-picker icon-panel', { role: 'dialog', 'aria-label': 'Choose icon' });
	panel.hidden = true;
	const search = h('input', '', { placeholder: 'Search icons', 'aria-label': 'Search icons' });
	const body = h('div', 'icon-results');
	store.iconEntries = [];
	store.iconGroups = [];
	let active = 0;
	const entry = (name: string, parent: HTMLElement, category = '') => {
		const b = h('button', '', { type: 'button', title: name || 'No icon', tabindex: -1 });
		b.setAttribute('aria-label', b.title);
		b.dataset.search = `${name} ${category} ${category.replace(/[-_]/g, ' ')}`.toLowerCase();
		b.dataset.value = name;
		if (name) {
			b.append(previewIcon(name));
		} else {
			b.textContent = 'No icon';
			b.className = 'no-icon';
		}
		b.onclick = () => {
			const pick = store.chooseIcon;
			closeFloating();
			pick?.(name);
		};
		parent.append(b);
		store.iconEntries.push(b);
	};
	entry('', body);
	for (const category of [...new Set(store.icons.map((i) => i.category))].sort()) {
		const section = h('section'),
			title = h('h4', '', {}, category.replace(/[-_]/g, ' ')),
			grid = h('div', 'icon-grid');
		section.append(title, grid);
		body.append(section);
		for (const i of store.icons.filter((i) => i.category === category).sort((a, b) => a.name.localeCompare(b.name))) {
			entry(i.name, grid, category);
		}
		store.iconGroups.push(section);
	}
	const visible = () => store.iconEntries.filter((b) => !b.hidden);
	const mark = (index: number) => {
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
			b.hidden = !!b.dataset.value && !(b.dataset.search || '').includes(q);
		}
		for (const group of store.iconGroups) {
			group.hidden = ![...group.querySelectorAll('button')].some((b) => !b.hidden);
		}
		mark(0);
	};
	panel.onkeydown = (e) => {
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
	panel.append(search, body);
	document.body.append(panel);
	store.iconPanel = panel;
	resetPanel = (value: string) => {
		search.value = '';
		search.oninput?.(new Event('input'));
		const i = visible().findIndex((b) => b.dataset.value === value);
		mark(Math.max(0, i));
		search.focus();
	};
}

// A button showing the chosen icon; it opens the palette and reports the pick ('' = no icon).
export class IconPicker extends Field<string> {
	readonly el: HTMLButtonElement;
	private value = '';

	constructor() {
		super();
		this.el = h('button', 'icon-picker', {
			type: 'button',
			title: 'Choose icon',
			'aria-label': 'Choose icon',
			'aria-haspopup': 'dialog',
			'aria-expanded': 'false',
		});
		this.el.onclick = () => {
			if (!store.iconPanel) buildIconPanel();
			store.chooseIcon = (name) => this.commit(name);
			floatAt(store.iconPanel!, this.el);
			resetPanel(this.value);
		};
	}

	set(value: string | Mixed, state?: ControlState): void {
		this.value = isMixed(value) ? '' : value;
		this.el.title = this.value || 'Choose icon';
		this.el.replaceChildren();
		if (this.value) this.el.append(previewIcon(this.value));
		else this.el.textContent = isMixed(value) ? '…' : '+';
		this.mark(state);
	}
}

// The picker as a plain function, for the toolbar.
export function iconPicker(value: string, onChange: (icon: string) => void): HTMLButtonElement {
	const picker = new IconPicker();
	picker.set(value);
	picker.onCommit((v) => onChange(v ?? ''));
	return picker.el;
}
