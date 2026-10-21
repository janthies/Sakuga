import { store } from '../../store/store';
import { post } from '../../store/model';
import { BOX_SLOTS, LINE_SLOTS } from '../../../core/model/slots';
import { AnchorPicker } from '../../ui/anchor';
import { Actions } from '../../ui/actions';
import type { PanelCtx, RowControls } from './spec';

export function placementRow(c: PanelCtx): RowControls {
	const id =
			c.sel.group?.id ||
			c.sel.node?.id ||
			[...store.selN][0] ||
			(store.selN.label
				? store.items.find(
						(i) =>
							i.kind === 'Text' &&
							i.parent === store.edges[store.selN.label!.index!]?.id &&
							i.order === (store.selN.label!.slot || 0),
					)?.id
				: undefined),
		item = store.items.find((i) => i.id === id);
	const parent = store.items.find((i) => i.id === item?.parent);
	if (!item || !parent || !['Shape', 'Line'].includes(parent.kind)) return null;
	const slots = parent.kind === 'Shape' ? BOX_SLOTS : LINE_SLOTS;
	const select = new AnchorPicker({
		cells: [...slots],
		columns: parent.kind === 'Shape' ? 5 : 3,
		name: (v) => v.replaceAll('-', ' '),
		className: parent.kind === 'Shape' ? 'slot-picker box-slots' : 'slot-picker line-slots',
		ariaLabel: 'Place',
	});
	select.set(item.slot || (parent.kind === 'Shape' ? 'centre' : 'middle-above'));
	select.onCommit((slot) => slot && post({ op: 'slot', id, slot }));
	return select;
}
export const parentAnchorRow = placementRow;
export const ownAnchorRow = () => null;
export const offsetRow = () => null;
export const attachedToRow = () => null;
export function detachRow(c: PanelCtx): RowControls {
	const id =
			c.sel.group?.id ||
			c.sel.node?.id ||
			[...store.selN][0] ||
			(store.selN.label
				? store.items.find(
						(i) =>
							i.kind === 'Text' &&
							i.parent === store.edges[store.selN.label!.index!]?.id &&
							i.order === (store.selN.label!.slot || 0),
					)?.id
				: undefined),
		item = store.items.find((i) => i.id === id);
	return item && store.items.some((p) => p.id === item.parent)
		? new Actions([{ label: 'Detach', run: () => post({ op: 'detach', id }) }])
		: null;
}
