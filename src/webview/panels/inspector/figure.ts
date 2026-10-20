import { STYLE_OPTS, SIZE_LABEL, sizes } from '../../store/constants';
import { post } from '../../store/model';
import { saveState } from '../../store/prefs';
import { render } from '../../render/scene';
import { store } from '../../store/store';
import { NumberControl } from '../../ui/number';
import { Segmented } from '../../ui/segmented';
import { Toggle } from '../../ui/toggle';
import { styleList } from './figure-styles';
import type { RowControls, SectionSpec } from './spec';

// The Figure tab: settings of the whole figure and the list of named styles.

function fontRow(): RowControls {
	const seg = new Segmented<string>(
		Object.keys(sizes).map((value) => ({
			value,
			label: value,
			tip: `${value} (${(SIZE_LABEL as Record<string, string>)[value]} pt)`,
			text: (SIZE_LABEL as Record<string, string>)[value],
		})),
		'Font size',
	);
	seg.set(store.figureFont);
	seg.onCommit((size) => post({ op: 'font', size: size! }));
	return seg;
}

function arrowsRow(): RowControls {
	const seg = new Segmented<string>(
		STYLE_OPTS.map(([value, label]) => ({ value, label })),
		'Arrows',
	);
	seg.set(store.arrowsStyle);
	seg.onCommit((style) => post({ op: 'arrows', style: style! }));
	return seg;
}

function legendRow(): RowControls {
	const toggle = new Toggle({ label: 'Legend' });
	toggle.set(store.legend);
	toggle.onCommit((on) => post({ op: 'legend', on: !!on }));
	return toggle;
}

function gridRow(): RowControls {
	const grid = new NumberControl({ step: 0.5, unit: 'mm', ariaLabel: 'Grid' });
	grid.set(store.grid);
	grid.onCommit((v) => {
		if (v === null) return;
		store.grid = Math.max(0.5, v || 1);
		saveState();
		render();
	});
	return grid;
}

export const FIGURE: SectionSpec[] = [
	{ id: 'text', title: 'Text', rows: [{ label: 'Font size', custom: fontRow }] },
	{ id: 'arrows', title: 'Arrows', rows: [{ label: 'Arrows', custom: arrowsRow }] },
	{ id: 'legend', title: 'Legend', rows: [{ label: 'Legend', custom: legendRow }] },
	{ id: 'grid', title: 'Grid', rows: [{ label: 'Grid', custom: gridRow }] },
	{ id: 'styles', title: 'Styles', rows: [{ label: '', custom: () => styleList() }] },
];
