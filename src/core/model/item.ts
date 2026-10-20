// The shared tree. The line list retains source order and foreign TikZ; these records
// give every editable object (including titles and path labels) one identity and parent.
import type { Attachment, FigEdge, FigNode, Group, LabelStyle, ObjectStyle } from './payload';

import type { ItemKind } from './item-base';
export type { ItemKind } from './item-base';
import type { TreeState, Endpoint } from './item-base';
export type { TreeState, Endpoint, Port } from './item-base';
export interface FigLine extends TreeState {
	id: string;
	start: [number, number];
	end: [number, number];
	layer?: string;
	group?: string;
	style?: ObjectStyle;
	labels?: { id?: string; text: string; style?: LabelStyle }[];
	extra: string[];
}
interface Base extends TreeState {
	id: string;
	parent: string;
	order: number;
	hidden: boolean;
	locked: boolean;
}
export interface TextItem extends Base {
	kind: 'Text';
	text: string;
	code?: string;
	role?: 'title' | 'label';
	placement?: LabelStyle;
	attachment?: Attachment;
	node?: FigNode;
}
export type Item =
	| (Base & { kind: 'Shape' | 'Icon'; node: FigNode })
	| (Base & { kind: 'Frame'; frame: Group })
	| TextItem
	| (Base & { kind: 'Line'; line: FigLine })
	| (Base & { kind: 'Connector'; connector: FigEdge; source: Endpoint; target: Endpoint });

export const CHILD_RULES: Record<ItemKind | 'Layer', readonly ItemKind[]> = {
	Layer: ['Shape', 'Frame', 'Text', 'Icon', 'Line', 'Connector'],
	Frame: ['Shape', 'Frame', 'Text', 'Icon', 'Line', 'Connector'],
	Shape: ['Text', 'Icon', 'Shape'],
	Connector: ['Text'],
	Line: ['Text'],
	Text: [],
	Icon: [],
};
