import { post } from '../../store/model';
import { AnchorLayout, AnchorPicker } from '../../ui/anchor';
import { TextControl } from '../../ui/text';
import { Segmented } from '../../ui/segmented';
import type { PanelCtx, RowControls } from './spec';

// Rows of frames that the schema does not describe well: the title text and its place, and the tint.

export function frameNameRow(c: PanelCtx): RowControls {
	const g = c.sel.group;
	if (!g) return null;
	const field = new TextControl({ ariaLabel: 'Name' });
	field.set(g.name);
	field.onCommit((name) => post({ op: 'groupProps', id: g.id, name: name ?? '' }));
	return field;
}

const TITLE_NAMES: Record<string, string> = {
	'above-left': 'Above left',
	'above-center': 'Above centre',
	'inside-top-left': 'Inside top left',
	'inside-top-right': 'Inside top right',
	'below-left': 'Below left',
	legacy: 'Original placement',
};
// Five by five: the title can sit outside the frame (the ring) or inside its top corners.
const TITLE_CELLS: (string | null)[] = Array(25).fill(null);
TITLE_CELLS[0] = 'above-left';
TITLE_CELLS[1] = 'above-center';
TITLE_CELLS[6] = 'inside-top-left';
TITLE_CELLS[8] = 'inside-top-right';
TITLE_CELLS[20] = 'below-left';
const TITLE_LAYOUT: AnchorLayout<string> = {
	cells: TITLE_CELLS,
	columns: 5,
	name: (v) => TITLE_NAMES[v] || v,
	extra: { value: 'legacy', label: 'Original', title: 'Original placement' },
	className: 'title-position',
	ariaLabel: 'Title position',
};

export function frameTitlePositionRow(c: PanelCtx): RowControls {
	const g = c.sel.group;
	if (!g) return null;
	const picker = new AnchorPicker(TITLE_LAYOUT);
	picker.set(g.titlePosition || 'legacy');
	picker.onCommit((titlePosition) => post({ op: 'groupProps', id: g.id, titlePosition: titlePosition! }));
	return picker;
}

export function frameFillRow(c: PanelCtx): RowControls {
	const g = c.sel.group;
	if (!g) return null;
	const seg = new Segmented<string>(
		[
			{ value: 'none', label: 'None', text: 'None' },
			{ value: 'tint', label: 'Tint', text: 'Tint' },
		],
		'Fill',
	);
	seg.set(g.fill || (g.frame === 'region' ? 'tint' : 'none'));
	seg.onCommit((fill) => post({ op: 'groupProps', id: g.id, fill: fill! }));
	return seg;
}
