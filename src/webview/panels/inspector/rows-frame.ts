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
