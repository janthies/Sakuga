import { ANCHORS, show } from '../../store/constants';
import { projectLabel } from '../../render/labelgeom';
import { attachmentFor, byId, descendant, isBox, post } from '../../store/model';
import { store } from '../../store/store';
import type { Attachment } from '../../../core/model/figure';
import { Actions } from '../../ui/actions';
import { AnchorPicker } from '../../ui/anchor';
import { NumberControl } from '../../ui/number';
import { SelectControl } from '../../ui/select';
import { ANCHOR_GRID } from './rows-common';
import type { PanelCtx, RowControls } from './spec';

// A node hanging on a box (a label also on an arrow or a frame): the parent, both anchors, the offset and the placement.

const attach = (id: string, attachment: Attachment | null) => post({ op: 'attach', id, attachment });
const single = (c: PanelCtx) => c.sel.node;

export function attachedToRow(c: PanelCtx): RowControls {
	const n = single(c);
	if (!n) return null;
	const labelTargets: { value: string; label: string }[] =
		n.kind === 'label'
			? [
					...store.edges.map((_, i) => ({ value: 'arrow:' + i, label: 'Arrow ' + (i + 1) })),
					...store.groups.map((g) => ({ value: 'frame:' + g.id, label: 'Frame ' + g.id })),
				]
			: [];
	const select = new SelectControl([
		{ value: '', label: 'None' },
		...store.nodes
			.filter((p) => isBox(p) && p.id !== n.id && !descendant(p.id, n.id))
			.map((p) => ({ value: p.id, label: show(p.title) || p.id })),
		...labelTargets,
	]);
	select.set(n.attachment?.parent || '');
	select.onCommit((id) => {
		if (id?.startsWith('arrow:')) {
			const index = +id.slice(6);
			post({ op: 'attachLabel', id: n.id, index, style: projectLabel(store.edges[index], n) });
		} else if (id?.startsWith('frame:')) {
			post({ op: 'attachLabel', id: n.id, group: id.slice(6) });
		} else {
			attach(n.id, id ? attachmentFor(n, byId(id)!, 'center') : null);
		}
	});
	return select;
}

function anchorRow(which: 'anchor' | 'ownAnchor') {
	return (c: PanelCtx): RowControls => {
		const n = single(c);
		const a = n?.attachment;
		if (!n || !a) return null;
		const picker = new AnchorPicker(ANCHOR_GRID);
		picker.set(a[which]);
		picker.onCommit((anchor) => attach(n.id, { ...a, [which]: anchor! }));
		return picker;
	};
}
export const parentAnchorRow = anchorRow('anchor');
export const ownAnchorRow = anchorRow('ownAnchor');

export function offsetRow(c: PanelCtx): RowControls {
	const n = single(c);
	const a = n?.attachment;
	if (!n || !a) return null;
	return (['dx', 'dy'] as const).map((key, i) => {
		const field = new NumberControl({
			prefix: i ? 'Y' : 'X',
			ariaLabel: i ? 'Offset Y' : 'Offset X',
			unit: i ? 'mm' : undefined,
			step: 0.05,
		});
		field.set(a[key]);
		field.onCommit((v) => v !== null && attach(n.id, { ...a, [key]: v }));
		return field;
	});
}

export function detachRow(c: PanelCtx): RowControls {
	const n = single(c);
	if (!n?.attachment) return null;
	return new Actions([{ label: 'Detach', run: () => attach(n.id, null) }]);
}

const OPPOSITE: Record<string, string> = {
	'north west': 'south east',
	north: 'south',
	'north east': 'south west',
	west: 'east',
	center: 'center',
	east: 'west',
	'south west': 'north east',
	south: 'north',
	'south east': 'north west',
};

// Where a label sits against its parent: inside or outside, on one of the anchors.
export function placementRow(c: PanelCtx): RowControls {
	const n = single(c);
	if (!n?.attachment || n.kind !== 'label') return null;
	const a = n.attachment;
	const select = new SelectControl([
		{ value: '', label: 'Choose…' },
		...ANCHORS.map((x) => ({ value: 'inside:' + x, label: 'Inside ' + x })),
		...ANCHORS.filter((x) => x !== 'center').map((x) => ({ value: 'outside:' + x, label: 'Outside ' + x })),
	]);
	select.set('');
	select.onCommit((v) => {
		if (!v) return;
		const [mode, anchor] = v.split(':');
		const sign = mode === 'inside' ? -1 : 1;
		attach(n.id, {
			...a,
			anchor,
			ownAnchor: mode === 'inside' ? anchor : OPPOSITE[anchor],
			dx: anchor.includes('west') ? -sign * 1.5 : anchor.includes('east') ? sign * 1.5 : 0,
			dy: anchor.includes('north') ? sign * 1.5 : anchor.includes('south') ? -sign * 1.5 : 0,
		});
	});
	return select;
}
