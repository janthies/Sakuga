import * as coreText from '../../../core/text';
import { show, sizes, smallerPt, tex } from '../../store/constants';
import { catOf, effectiveIcon, fontPt, isBox, post } from '../../store/model';
import { store } from '../../store/store';
import { Block } from '../../ui/block';
import { MIXED, h } from '../../ui/control';
import { AnchorPicker } from '../../ui/anchor';
import { IconPicker } from '../../ui/iconpicker';
import { SelectControl } from '../../ui/select';
import { TextControl } from '../../ui/text';
import { Toggle } from '../../ui/toggle';
import { ANCHOR_GRID, nodeOps, sameOr } from './rows-common';
import type { PanelCtx, RowControls } from './spec';

// Text, icon and decoration rows of boxes, labels and icons.

const titleOf = (t: string) => show(t.split('\\\\').join(' / '));

// The title of the selected nodes (the label of a free icon).
export function titleRow(c: PanelCtx): RowControls {
	const nodes = c.sel.nodes;
	if (!nodes.length) return null;
	const field = new TextControl({ ariaLabel: 'Title' });
	field.set(sameOr(nodes.map((n) => titleOf(n.title))));
	field.onCommit((v) =>
		post(
			nodeOps(
				nodes.map((n) => n.id),
				{ title: (v ?? '').split(' / ').map(tex).join('\\\\') },
			),
		),
	);
	return field;
}

export function codeRow(c: PanelCtx): RowControls {
	const n = c.sel.node;
	if (!n) return null;
	const field = new TextControl({ mono: true, ariaLabel: 'Code' });
	field.set(show(n.code));
	field.onCommit((v) => post({ op: 'node', id: n.id, code: tex(v ?? '') }));
	return field;
}

// The code line is set one size below the title unless told otherwise.
export function codeSizeRow(c: PanelCtx): RowControls {
	const nodes = c.sel.nodes;
	if (!nodes.length || !nodes.every(isBox)) return null;
	const limit = Math.min(...nodes.map((n) => smallerPt(fontPt(n))));
	const sizeNames = ['tiny', ...Object.keys(sizes)].filter(
		(v) => (coreText.sizes as Record<string, number>)[v] <= limit,
	);
	const select = new SelectControl(
		[{ value: '', label: 'One step below title' }, ...sizeNames.map((v) => ({ value: v, label: v }))],
		'Code size',
	);
	select.set(sameOr(nodes.map((n) => n.codeFont || '')));
	select.onCommit((codeFont) =>
		post({ op: 'batch', ops: nodes.map((n) => ({ op: 'node', id: n.id, codeFont: codeFont ?? '' })) }),
	);
	return select;
}

export function widenedNoteRow(c: PanelCtx): RowControls {
	const wide = c.sel.nodes.filter((n) => isBox(n) && n.wantWidth !== undefined);
	if (!wide.length) return null;
	return new Block(
		h(
			'div',
			'',
			{},
			...wide.map((n) =>
				h('p', 'empty', {}, 'box widened to fit `' + coreText.need(n, store.figureFont).content + '`'),
			),
		),
	);
}

export function titlePositionRow(c: PanelCtx): RowControls {
	const n = c.sel.node;
	if (!n) return null;
	const picker = new AnchorPicker({ ...ANCHOR_GRID, ariaLabel: 'Title position' });
	picker.set(n.titlePosition || 'center');
	picker.onCommit((titlePosition) => post({ op: 'node', id: n.id, titlePosition: titlePosition! }));
	return picker;
}

// The icon of a box or free icon; the empty pick clears it ('none' for a box, so the style icon stays off).
export function iconRow(c: PanelCtx): RowControls {
	const nodes = c.sel.nodes;
	if (!nodes.length) return null;
	const picker = new IconPicker();
	picker.set(sameOr(nodes.map(effectiveIcon)) === MIXED ? '' : effectiveIcon(nodes[0]));
	picker.onCommit((icon) =>
		post(
			nodes.length === 1
				? { op: 'node', id: nodes[0].id, icon: icon || (nodes[0].kind === 'icon' ? '' : 'none') }
				: {
						op: 'batch',
						ops: nodes.map((n) => ({ op: 'node', id: n.id, icon: icon || (n.kind === 'icon' ? '' : 'none') })),
					},
		),
	);
	return picker;
}

const ICON_POSITIONS = [
	['left', 'Left of title'],
	['above', 'Above title'],
	['right', 'Right of title'],
	['nw', 'Top left'],
	['ne', 'Top right'],
	['sw', 'Bottom left'],
	['se', 'Bottom right'],
];

export function iconPositionRow(c: PanelCtx): RowControls {
	const boxes = c.sel.nodes.filter(isBox);
	if (!boxes.length || boxes.length !== c.sel.nodes.length) return null;
	const select = new SelectControl(
		ICON_POSITIONS.map(([value, label]) => ({ value, label })),
		'Icon position',
	);
	select.set(sameOr(boxes.map((n) => n.iconPosition || 'left')));
	select.onCommit((iconPosition) =>
		post(
			nodeOps(
				boxes.map((n) => n.id),
				{ iconPosition: iconPosition! },
			),
		),
	);
	return select;
}

// Whether the box shows its style's icon.
export function styleIconRow(c: PanelCtx): RowControls {
	const boxes = c.sel.nodes.filter(isBox);
	if (!boxes.length || boxes.length !== c.sel.nodes.length) return null;
	const toggle = new Toggle({ label: 'Use style icon in this box' });
	toggle.set(sameOr(boxes.map((n) => n.icon === 'category' || (!n.icon && !!catOf(n.cat)?.boxes))));
	toggle.onCommit((on) =>
		post(
			nodeOps(
				boxes.map((n) => n.id),
				{ icon: on ? 'category' : 'none' },
			),
		),
	);
	return toggle;
}

// A label's thin frame is a solid thin border, or none.
export function thinFrameRow(c: PanelCtx): RowControls {
	const n = c.sel.node;
	if (!n || n.kind !== 'label') return null;
	const toggle = new Toggle({ label: 'Thin frame' });
	toggle.set(!!n.style?.border && n.style.border !== 'none');
	toggle.onCommit((on) => post({ op: 'style', ids: [n.id], style: { border: on ? 'solid' : 'none', weight: 'thin' } }));
	return toggle;
}
