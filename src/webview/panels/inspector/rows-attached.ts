import { PT, show, sizes, tex } from '../../store/constants';
import { arrowLabelGeom, frameTitleGeom } from '../../render/labelgeom';
import { copyStyle, labelChange, pasteStyle } from '../../commands/styles';
import { newId } from '../../store/layers';
import { post, textMm } from '../../store/model';
import { store } from '../../store/store';
import { Actions } from '../../ui/actions';
import { NumberControl } from '../../ui/number';
import { SelectControl } from '../../ui/select';
import { TextControl } from '../../ui/text';
import { Toggle } from '../../ui/toggle';
import { newColour } from './props';
import type { PanelCtx, RowControls } from './spec';

// Rows of an attached label: an arrow's label or a frame's title. Its style values may be unset, which means inherited.

const pathText = () => store.items.find((i) => i.id === [...store.selN][0] && i.kind === 'Text');
const style = (c: PanelCtx) =>
	c.sel.attached?.style ??
	(pathText()?.kind === 'Text' ? (pathText() as import('../../../core/model/item').TextItem).placement : undefined) ??
	{};
function changePlacement(c: PanelCtx, patch: Record<string, any>) {
	const item = pathText();
	if (item?.kind === 'Text') post({ op: 'text', id: item.id, placement: { ...item.placement, ...patch } });
	else labelChange(patch);
}
const onArrow = (c: PanelCtx) =>
	!!c.sel.attached?.e || store.items.some((i) => i.id === pathText()?.parent && i.kind === 'Connector');

export function labelTextRow(c: PanelCtx): RowControls {
	const a = c.sel.attached;
	if (!a) return null;
	const field = new TextControl({ ariaLabel: 'Text' });
	field.set(show(a.text));
	field.onCommit((v) => post({ op: 'label', ...store.selN.label, text: tex(v ?? '') }));
	return field;
}

export function labelFontRow(c: PanelCtx): RowControls {
	if (!c.sel.attached) return null;
	const st = style(c);
	const size = new SelectControl(
		[{ value: '', label: 'Inherit' }, ...Object.keys(sizes).map((v) => ({ value: v, label: v }))],
		'Font size',
	);
	size.set(st.font || '');
	size.onCommit((font) => labelChange({ font: font ?? '' }));
	const toggles = (['bold', 'italic'] as const).map((key) => {
		const t = new Toggle({ glyph: key, label: key, inherit: true });
		t.set(st[key]);
		t.onCommit((v) => labelChange({ [key]: v }));
		return t;
	});
	return [size, ...toggles];
}

export function labelKnockoutRow(c: PanelCtx): RowControls {
	if (!c.sel.attached) return null;
	const t = new Toggle({ label: 'Knock-out', inherit: false });
	t.set(style(c).background);
	t.onCommit((v) => labelChange({ background: v }));
	return t;
}

export function labelColourRow(c: PanelCtx): RowControls {
	if (!c.sel.attached) return null;
	const colour = newColour('textColor', false);
	colour.set(style(c).color || '');
	colour.onCommit((v) => labelChange({ color: v ?? '' }));
	return colour;
}

export function labelPositionRow(c: PanelCtx): RowControls {
	const a = c.sel.attached;
	if (!onArrow(c)) return null;
	const pos = new NumberControl({ step: 0.05, ariaLabel: 'Position' });
	pos.set(style(c).pos ?? 0.5);
	pos.onCommit((v) => changePlacement(c, { pos: Math.max(0, Math.min(1, v ?? 0.5)) }));
	return pos;
}

export function labelSideRow(c: PanelCtx): RowControls {
	if (!onArrow(c)) return null;
	const side = new SelectControl(
		['', 'above', 'below', 'left', 'right'].map((v) => ({ value: v, label: v || 'Inherit' })),
		'Side',
	);
	side.set(style(c).side || '');
	side.onCommit((v) => changePlacement(c, { side: v ?? '' }));
	return side;
}

export function frameTitleAtRow(c: PanelCtx): RowControls {
	const g = c.sel.attached?.g;
	if (!g) return null;
	const select = new SelectControl(
		['above-left', 'above-center', 'inside-top-left', 'inside-top-right', 'below-left'].map((v) => ({
			value: v,
			label: v,
		})),
		'Label at',
	);
	select.set(g.titlePosition || 'above-left');
	select.onCommit((titlePosition) => post({ op: 'groupProps', id: g.id, titlePosition: titlePosition! }));
	return select;
}

export function labelOffsetRow(c: PanelCtx): RowControls {
	return null;
}

// Back to the preset place, or turn the label into a free label where it stands.
export function labelActionsRow(c: PanelCtx): RowControls {
	const a = c.sel.attached;
	if (!a) return null;
	return new Actions([
		{ label: 'Reset position', run: () => labelChange({ pos: 0.5, segment: null, dx: 0, dy: 0, side: '' }) },
		{
			label: 'Detach',
			run: () => {
				const G = a.g ? frameTitleGeom(a.g) : arrowLabelGeom(a.e!, a.style, a.text, a.step);
				if (!G) return;
				const align = 'align' in G ? G.align : undefined;
				const w = 'w' in G ? G.w : textMm(show(a.text), G.pt, 'Sakuga Sans');
				post({
					op: 'detachLabel',
					...store.selN.label,
					id: newId(),
					x: G.p[0] + (align === 'start' ? w / 2 : align === 'end' ? -w / 2 : 0),
					y: G.p[1],
					width: Math.max(1, a.g ? w : w - 2 * PT),
				});
				delete store.selN.label;
			},
		},
	]);
}

export function labelCopyPasteRow(): RowControls {
	return new Actions([
		{ label: 'Copy style', run: copyStyle },
		{ label: 'Paste style', run: pasteStyle },
	]);
}
