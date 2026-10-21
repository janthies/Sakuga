import type { TreeState, Port } from './item-base';

// The figure model: boxes, arrows, groups, layers, named styles and the line list that keeps the file order.

export interface ObjectStyle {
	cornerRadius?: number;
	dashOn?: number;
	dashOff?: number;
	roundCap?: boolean;
	compact?: boolean;
	lineWidth?: number;
	tipLength?: number;
	tipWidth?: number;
	step?: number;
	opacity?: number;
	pattern?: string;
	patternColor?: string;
	mark?: string;
	markCorner?: string;
	markSize?: string;
	markColor?: string;
	shape?: string;
	fill?: string;
	border?: string;
	color?: string;
	weight?: string;
	text?: string;
	font?: string;
	textColor?: string;
	start?: string;
	end?: string;
	position?: string;
	side?: string;
}

export interface Icon {
	name: string;
	category: string;
	paths: string[];
	circles?: { cx: number; cy: number; r: number }[];
	rects?: { x: number; y: number; width: number; height: number; rx?: number }[];
}

interface CategorySettings {
	fill?: string;
	outlineColor?: string;
	outline?: string;
	key: string;
	name: string;
	legend?: boolean;
}
export type Category = CategorySettings & ({ color: string; icon?: never } | { icon: string; color?: never });

// A named style acts on every object that names it. One flat level per kind, no inheritance.
// props use the names of ObjectStyle (a box style's colour is its fill); an object keeps only
// the properties that differ from its style, which are its overrides.
export type StyleKind = 'box' | 'arrow' | 'frame' | 'label';

export interface StyleDef {
	color?: string;
	fill?: string;
	outlineColor?: string;
	outline?: string;
	emphasis?: string;
	kinds?: Partial<Record<import('./item-base').ItemKind, Record<string, any>>>;
	kind: StyleKind;
	key: string;
	name: string;
	legend?: boolean;
	icon?: string;
	boxes?: boolean;
	props: Record<string, any>;
}

export interface Attachment {
	parent: string;
	anchor: string;
	ownAnchor: string;
	dx: number;
	dy: number;
}

export interface FigNode extends TreeState {
	categoryMarker?: boolean;
	derivedRect?: { x: number; y: number; w: number; h: number; lines?: string[]; textWidth?: number };
	titleId?: string;
	titleHidden?: boolean;
	labelPlacement?: LabelStyle;
	titlePosition?: string;
	attachment?: Attachment;
	wantWidth?: number;
	codeFont?: string;
	style?: ObjectStyle;
	id: string;
	icon?: string;
	iconPosition?: string;
	kind?: string;
	cat: string;
	x: number;
	y: number;
	title: string;
	code: string;
	width: number;
	minh: number;
	layer: string;
	group: string;
	hidden: boolean;
	locked: boolean;
	extra: string[];
}

// A group is a folder in the layer stack; it can draw a frame or a tinted region around its members.
export interface Layer {
	opacity?: number;
	id: string;
	name: string;
	hidden: boolean;
	locked: boolean;
}

export interface LabelStyle {
	hidden?: boolean;
	locked?: boolean;
	segment?: number;
	pos?: number;
	dx?: number;
	dy?: number;
	side?: string;
	font?: string;
	bold?: boolean;
	italic?: boolean;
	color?: string;
	background?: boolean;
}

export interface AttachedLabel {
	id?: string;
	text: string;
	style?: LabelStyle;
}

export interface Group extends TreeState {
	titleId?: string;
	fill?: string;
	fillStrength?: number;
	outline?: string;
	labelStyle?: LabelStyle;
	padding?: number;
	titlePosition?: string;
	titleBold?: boolean;
	titleFont?: string;
	titleColor?: string;
	lineWidth?: number;
	frameColor?: string;
	id: string;
	name: string;
	frame: string;
	color: string;
	parent: string;
}

// route: 'auto' uses the ordered orthogonal router; 'straight', 'manhattan' and 'curved' choose a style
// for this arrow; 'hvh' (across, down, across; mid = x of the vertical part), 'vhv' (down, across,
// down; mid = y of the horizontal part) and 'bend' (bend in degrees, positive = left) are shapes set
// by hand. mid = null puts the corner at the target. head: 'end', 'both' or 'none'.
// Fixed chains use native coordinate/operator tokens; editable waypoints are absolute mm.
// Side offsets and loop control distances use mm; loop angles use TikZ degrees.
export interface FigEdge extends TreeState {
	labelId?: string;
	fromPort?: Port;
	toPort?: Port;
	id?: string;
	styleKey?: string;
	fromOffset?: number;
	toOffset?: number;
	loopSide?: string;
	loopSize?: number;
	loopOut?: number;
	loopIn?: number;
	looseness?: number;
	loopMax?: number;
	chain?: string[];
	waypoints?: number[][];
	fromAnchor?: string;
	toAnchor?: string;
	lane?: number;
	labelStyle?: LabelStyle;
	labels?: AttachedLabel[];
	style?: ObjectStyle;
	from: string;
	to: string;
	kind: string;
	route: string;
	mid: number | null;
	bend: number;
	head: string;
	label: string;
	extra: string[];
}
