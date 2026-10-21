import { store } from '../../store/store';
import { post } from '../../store/model';
import { BOX_SLOTS, LINE_SLOTS } from '../../../core/model/slots';
import { SelectControl } from '../../ui/select';
import { Actions } from '../../ui/actions';
import type { PanelCtx, RowControls } from './spec';

export function placementRow(c: PanelCtx): RowControls {
	const id = c.sel.node?.id || [...store.selN][0],
		item = store.items.find((i) => i.id === id);
	const parent = store.items.find((i) => i.id === item?.parent);
	if (!item || !parent || !['Shape', 'Line'].includes(parent.kind)) return null;
	const slots = parent.kind === 'Shape' ? BOX_SLOTS : LINE_SLOTS;
	const select = new SelectControl(
		slots.map((value) => ({ value, label: value.replaceAll('-', ' ') })),
		'Place',
	);
	select.set(item.slot || 'centre');
	select.onCommit((slot) => slot && post({ op: 'slot', id, slot }));
	return select;
}
export const parentAnchorRow = placementRow;
export const ownAnchorRow = () => null;
export const offsetRow = () => null;
export const attachedToRow = () => null;
export function detachRow(c: PanelCtx): RowControls {
	const id = c.sel.node?.id || [...store.selN][0],
		item = store.items.find((i) => i.id === id);
	return item && store.items.some((p) => p.id === item.parent)
		? new Actions([{ label: 'Detach', run: () => post({ op: 'detach', id }) }])
		: null;
}
