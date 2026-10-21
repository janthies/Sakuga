import { categoryKey } from '../../../core/styles/cascade';
import { parse } from '../../../core/codec/parse';
import { src } from '../../platform/dom';
import { show, tex } from '../../store/constants';
import { post } from '../../store/model';
import { store } from '../../store/store';
import { vscode } from '../../platform/host';
import type { Category } from '../../store/types';
import { Block } from '../../ui/block';
import { h } from '../../ui/control';
import { IconPicker, previewIcon } from '../../ui/iconpicker';
import { SelectControl } from '../../ui/select';
import { TextControl } from '../../ui/text';
import { Row } from '../../ui/row';
import { newColour } from './props';
import { styleColor } from '../../render/svg';

const edit = (c: Category, patch: Partial<Category>) => post({ op: 'categoryEdit', key: c.key, patch });
function editor(c: Category): HTMLElement {
	const body = h('div', 'category-edit');
	const add = (label: string, controls: any[]) => body.append(new Row(label, controls).el);
	const name = new TextControl({ ariaLabel: 'Category name' });
	name.set(show(c.name));
	name.onCommit((name) => edit(c, { name: tex(name || '') }));
	add('Name', [name]);
	const mode = new SelectControl(
		[
			{ value: 'colour', label: 'Colour' },
			{ value: 'icon', label: 'Icon' },
		],
		'Marker type',
	);
	mode.set(c.icon ? 'icon' : 'colour');
	mode.onCommit((value) => edit(c, value === 'icon' ? { icon: store.icons[0]?.name || 'box' } : { color: 'blue' }));
	const marker = c.icon ? new IconPicker() : newColour('Marker colour', false);
	marker.set(c.icon || c.color || 'white');
	marker.onCommit((value) =>
		edit(c, c.icon ? { icon: value || store.icons[0]?.name || 'box' } : { color: value || 'white' }),
	);
	add('Marker', [mode, marker]);
	const fill = newColour('Fill', true);
	fill.set(c.fill || '');
	fill.onCommit((value) => edit(c, { fill: value || (c.icon ? 'none' : c.color || 'white') }));
	add('Fill', [fill]);
	const colour = newColour('Outline colour', false);
	colour.set(c.outlineColor || '');
	colour.onCommit((value) => edit(c, { outlineColor: value || '' }));
	const style = new SelectControl(
		['solid', 'dashed', 'dotted', 'none'].map((value) => ({ value, label: value })),
		'Outline style',
	);
	style.set(c.outline || 'solid');
	style.onCommit((value) => edit(c, { outline: value || 'solid' }));
	add('Outline', [colour, style]);
	return body;
}
export function styleList(): Block {
	const list = h('div', 'categories');
	list.append(h('div', 'category-heading', {}, 'Categories'));
	for (const c of store.cats) {
		const marker = h('button', 'category-marker', { type: 'button', 'aria-label': 'Edit ' + show(c.name) });
		if (c.icon) marker.append(previewIcon(c.icon));
		else {
			const swatch = h('i', 'swatch');
			swatch.style.background = styleColor(c.color, '#fff') || '#fff';
			marker.append(swatch);
		}
		const name = h('button', 'category-name', { type: 'button' }, show(c.name));
		const fig = parse(src.value);
		const count = store.items.filter((i) => categoryKey(fig, i) === c.key).length;
		const users = h('span', 'category-count', { title: 'Uses' }, String(count));
		const legend = h('input', '', { type: 'checkbox', 'aria-label': 'Include ' + show(c.name) + ' in legend' });
		legend.checked = !!c.legend;
		legend.onchange = () => edit(c, { legend: legend.checked });
		const remove = h(
			'button',
			'category-delete',
			{ type: 'button', title: 'Delete category', 'aria-label': 'Delete ' + show(c.name) },
			h('i', 'ci ci-trash'),
		);
		remove.onclick = () => vscode.postMessage({ type: 'deleteCategory', key: c.key });
		const body = editor(c);
		body.hidden = !store.openStyles.has(c.key);
		const toggle = () => {
			body.hidden = !body.hidden;
			if (body.hidden) store.openStyles.delete(c.key);
			else store.openStyles.add(c.key);
		};
		marker.onclick = name.onclick = toggle;
		const row = h('div', 'category-line', {}, marker, name, users, legend, remove);
		row.onclick = (ev) => {
			if (ev.target === row || ev.target === users) toggle();
		};
		list.append(h('div', 'category-item', {}, row, body));
	}
	const add = h('button', '', { type: 'button' }, 'New category');
	add.onclick = () => {
		let n = 1;
		while (store.cats.some((c) => c.key === `category-${n}`)) n++;
		const key = `category-${n}`;
		store.openStyles.add(key);
		post({ op: 'categoryAdd', category: { key, name: 'New category', color: 'blue', legend: false } });
	};
	list.append(add);
	return new Block(list);
}
