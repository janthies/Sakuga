import { categoryKey } from '../../../core/styles/cascade';
import { parse } from '../../../core/codec/parse';
import { src } from '../../platform/dom';
import { store } from '../../store/store';
import { post } from '../../store/model';
import { show, tex } from '../../store/constants';
import { ChoiceControl } from '../../ui/choice';
import { TextControl } from '../../ui/text';
import { Block } from '../../ui/block';
import { MIXED, h } from '../../ui/control';
import { styleColor } from '../../render/svg';
import type { PanelCtx, RowControls } from './spec';

export function categoryRow(c: PanelCtx): RowControls {
	const ids = new Set([...store.selN, ...c.sel.edges.map((e) => e.e.id || '')]);
	if (store.selN.label) {
		const ref = store.selN.label;
		const child = store.items.find(
			(i) =>
				i.kind === 'Text' &&
				i.parent === (ref.group || store.edges[ref.index!]?.id) &&
				i.order === (ref.slot === undefined ? 0 : ref.slot + 1),
		);
		if (child) ids.add(child.id);
	}
	const items = store.items.filter((i) => ids.has(i.id) && i.kind !== 'Frame');
	if (!items.length) return null;
	const fig = parse(src.value);
	const category = (i: (typeof items)[number]) => categoryKey(fig, i);
	const picker = new ChoiceControl(
		[
			{ value: '', label: 'None' },
			...store.cats.map((c) => ({
				value: c.key,
				label: show(c.name),
				icon: c.icon,
				color: c.icon ? undefined : styleColor(c.color, '#fff'),
			})),
		],
		'Category',
	);
	const values = items.map(category);
	picker.set(values.every((v) => v === values[0]) ? values[0] : MIXED);
	picker.onCommit(
		(value) =>
			value !== null &&
			post({ op: 'batch', ops: items.map((i) => ({ op: 'setCategory', id: i.id, category: value })) }),
	);
	return picker;
}
export function itemTextRow(c: PanelCtx): RowControls {
	const item = store.items.find((i) => i.id === [...store.selN][0]);
	if (item?.kind !== 'Text') return null;
	const field = new TextControl({ ariaLabel: 'Text' });
	field.set(show(item.text));
	field.onCommit((text) => post({ op: 'text', id: item.id, text: tex(text || '') }));
	return field;
}
export function lineLabelsRow(): RowControls {
	const item = store.items.find((i) => i.id === [...store.selN][0]);
	if (item?.kind !== 'Line') return null;
	return ['above', 'below'].map((side) => {
		const label = store.items.find((i) => i.kind === 'Text' && i.parent === item.id && i.slot?.endsWith(side));
		const field = new TextControl({ ariaLabel: `Label ${side}` });
		field.set(label?.kind === 'Text' ? show(label.text) : '');
		field.onCommit((text) => {
			if (label) post({ op: 'text', id: label.id, text: tex(text || '') });
			else
				post({
					op: 'line',
					id: item.id,
					labels: [...(item.line.labels || []), { text: tex(text || ''), style: { pos: 0.5, side } }],
				});
		});
		return field;
	});
}
export function memberCountRow(c: PanelCtx): RowControls {
	return new Block(h('span', '', {}, String(store.items.filter((i) => i.parent === c.sel.group?.id).length)));
}
