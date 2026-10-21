import type { PropKey } from '../../../core/schema';
import type { Control } from '../../ui/control';
import type { Selection } from './selection';
import type { Subject } from './subject';

// What a row builder gets: the selection, the property view over it, and a way to redraw the inspector.
export interface PanelCtx {
	sel: Selection;
	subject: Subject;
	refresh(): void;
}

// The controls of a custom row, left to right. null drops the row (nothing to show for this selection).
export type RowControls = Control<any> | Control<any>[] | null;

interface RowBase {
	target?: 'label';
	// Only for these selections (default: always; rows of properties the objects lack are dropped anyway).
	when?(c: PanelCtx): boolean;
}
export type RowSpec =
	// A schema property: label, control type and values come from its PropDef.
	| (RowBase & { prop: PropKey; label?: string })
	// Several properties on one line, e.g. bold, italic and size.
	| (RowBase & { label: string; props: PropKey[] })
	// A control the schema cannot describe. An empty label makes the row span the whole width.
	| (RowBase & { label: string; class?: string; custom(c: PanelCtx): RowControls });

export interface SectionSpec {
	id: string;
	title: string;
	collapsed?: boolean;
	rows: RowSpec[];
}
