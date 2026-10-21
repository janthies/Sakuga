import { SIZE_LABEL, sizes } from '../../store/constants';
import { post } from '../../store/model';
import { saveState } from '../../store/prefs';
import { render } from '../../render/scene';
import { store } from '../../store/store';
import { NumberControl } from '../../ui/number';
import { SelectControl } from '../../ui/select';
import { Block } from '../../ui/block';
import { h } from '../../ui/control';
import { tidyRow } from './rows-common';
import { styleList } from './figure-styles';
import type { RowControls, SectionSpec } from './spec';

function fontRow(): RowControls {
	const control = new SelectControl(
		Object.keys(sizes)
			.filter(
				(v) =>
					Number(SIZE_LABEL[v as keyof typeof SIZE_LABEL]) >= 8 &&
					Number(SIZE_LABEL[v as keyof typeof SIZE_LABEL]) <= 12,
			)
			.map((value) => ({ value, label: `${SIZE_LABEL[value as keyof typeof SIZE_LABEL]} pt` })),
		'Font size',
	);
	control.set(store.figureFont);
	control.onCommit((fontSize) => post({ op: 'themeEdit', fontSize: fontSize! }));
	return control;
}
function arrowsRow(): RowControls {
	const select = new SelectControl(
		['straight', 'manhattan', 'curved'].map((value) => ({ value, label: value === 'auto' ? 'Automatic' : value })),
		'Default arrow route',
	);
	select.set(store.arrowsStyle);
	select.onCommit((route) => post({ op: 'arrows', style: route! }));
	return select;
}
function gridRow(): RowControls {
	const grid = new NumberControl({ step: 0.5, min: 0, unit: 'mm', ariaLabel: 'Grid' });
	grid.set(store.grid);
	grid.onCommit((v) => {
		if (v === null) return;
		store.grid = v;
		saveState();
		render();
	});
	return grid;
}
function paletteRow(): RowControls {
	const list = h('div', 'palette-swatches');
	for (const [key, colour] of Object.entries(store.palette)) {
		const input = h('input', '', { type: 'color', title: key, 'aria-label': key });
		input.value = '#' + colour.hex.replace(/^#/, '');
		input.onchange = () => post({ op: 'themeEdit', palette: { [key]: input.value } });
		list.append(input);
	}
	return new Block(list);
}
export const FIGURE: SectionSpec[] = [
	{
		id: 'settings',
		title: 'Figure settings',
		collapsed: true,
		rows: [
			{ label: 'Export target', custom: () => new Block(h('span', 'empty', {}, '—')) },
			{ label: 'Font size', custom: fontRow },
			{ label: 'Arrow route', custom: arrowsRow },
			{ label: 'Palette', custom: paletteRow },
			{ label: 'Grid', custom: gridRow },
			{ label: '', custom: tidyRow },
		],
	},
	{ id: 'categories', title: '', rows: [{ label: '', custom: styleList }] },
];
