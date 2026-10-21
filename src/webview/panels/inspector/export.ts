import { EXPORT_PRESETS } from '../../../core/model/export';
import { FONT_SIZES } from '../../../core/model/constants';
import { store } from '../../store/store';
import { post } from '../../store/model';
import { SelectControl } from '../../ui/select';
import { NumberControl } from '../../ui/number';
import { Block } from '../../ui/block';
import { h } from '../../ui/control';

export function exportRow() {
	const target = store.exportTarget;
	const preset = new SelectControl(
		[
			...EXPORT_PRESETS.map((p) => ({ value: String(p.width), label: `${p.name} ${p.width} mm` })),
			{ value: 'custom', label: 'Custom' },
		],
		'Export preset',
	);
	preset.set(EXPORT_PRESETS.some((p) => p.width === target.width) ? String(target.width) : 'custom');
	preset.onCommit((value) => {
		const p = EXPORT_PRESETS.find((p) => String(p.width) === value);
		if (p) post({ op: 'export', width: p.width, font: p.font });
		else {
			width.el.querySelector('input')?.focus();
		}
	});
	const width = new NumberControl({ min: 1, max: 1000, step: 1, unit: 'mm', ariaLabel: 'Export width' });
	width.set(target.width);
	width.onCommit((value) => {
		if (value !== null) post({ op: 'export', width: value });
	});
	const font = new SelectControl(
		FONT_SIZES.map((value) => ({ value, label: `\\${value}` })),
		'Export font',
	);
	font.set(store.figureFont);
	font.onCommit((value) => {
		if (value) post({ op: 'export', font: value });
	});
	return new Block(h('div', 'export-target', {}, preset.el, width.el, font.el));
}
