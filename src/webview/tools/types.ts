// What a tool sees and says. Nothing here touches the DOM or the store: the dispatcher in live/ turns DOM events into
// CanvasEvents and applies the Steps that come back.

import type { LabelRef } from '../../core/model/refs';
import type { OpLike } from '../../core/model/node';

export type Point = { x: number; y: number };
export type Mods = { ctrl: boolean; shift: boolean; alt: boolean; space: boolean };
export type { LabelRef };

/** What was under the pointer, as the renderer marked it. */
export type HitRef =
	| { k: 'none' }
	| { k: 'line'; id: string }
	| { k: 'text'; id: string; parent: string }
	| { k: 'label'; ref: LabelRef }
	| { k: 'locked' }
	| { k: 'corner'; index: number; j: number }
	| { k: 'segment'; index: number; j: number }
	| { k: 'endpoint'; index: number; end: 'from' | 'to' }
	| { k: 'mid'; index: number }
	| { k: 'group'; id: string }
	| { k: 'scale'; dir: string }
	| { k: 'resize'; id: string; dir: string }
	| { k: 'handle'; id: string }
	| { k: 'node'; id: string }
	| { k: 'edge'; index: number };

export interface CanvasEvent {
	/** Position in mm, y up. */
	p: Point;
	/** Position in screen pixels (panning). */
	screen: Point;
	button: number;
	mods: Mods;
	hit: HitRef;
	/** The text of the open text field, for the text-edit tool. */
	text?: string;
}
export interface KeyEvent {
	/** `Enter`, `Escape` or `blur` for the text field. */
	key: string;
	text?: string;
}

export interface Selection {
	nodes: Set<string>;
	edges: Set<number>;
	group: string | null;
	label: LabelRef | null;
	/** The reference object of alignment commands. */
	key: string | null;
}

// Ops are the legacy op shapes the host applies (src/core/ops); a preview is applied to the webview's model only.
export type Op = OpLike;
/** A change shown on screen before it is committed: node geometry, arrow fields, a label style. */
export interface PreviewOp {
	slots?: { id: string; slot: string }[];
	labels?: { ref: LabelRef; style: any; titlePosition?: string }[];
	texts?: { id: string; placement: import('../../core/model/figure').LabelStyle }[];
	lines?: { id: string; start: [number, number]; end: [number, number] }[];
	nodes?: { id: string; x?: number; y?: number; width?: number; minh?: number; attachment?: any }[];
	arrows?: { index: number; fields: Record<string, any> }[];
	label?: { ref: LabelRef; style: any; titlePosition?: string };
	/** Attached boxes follow their parents again after the change. */
	place?: boolean;
}

export type EditTarget =
	| { kind: 'text'; id: string }
	| { kind: 'node'; id: string }
	| { kind: 'edge'; index: number }
	| { kind: 'draft'; id: string; draft: any };
export type EditView = { open: EditTarget; text?: string } | 'close';

export interface Step {
	wheel?: Point;
	/** Applied to the model on screen only, never sent. */
	preview?: PreviewOp;
	/** Sent to the host. */
	commit?: Op;
	/** The whole selection after this event. */
	select?: Selection;
	clearLayers?: boolean;
	next?: Tool;
	hover?: string | null;
	view?: { ox: number; oy: number };
	edit?: EditView;
	lastCat?: string;
	pendingEdit?: string;
	pendingSelect?: string[];
	/** Default true; false when the screen need not be redrawn. */
	render?: boolean;
	/** The event is handled again by the idle tool (a click that ends a text edit). */
	redispatch?: boolean;
}

export interface Tool {
	down(e: CanvasEvent): Step;
	move(e: CanvasEvent): Step;
	up(e: CanvasEvent): Step;
	key?(e: KeyEvent): Step;
	dbl?(e: CanvasEvent): Step;
	/** What the renderer draws while the gesture runs (guides, band, rubber line); the old `store.drag`. */
	overlay?: any;
}

/** The questions tools ask about the figure, answered by live/ctx.ts from the store, or by a fake in tests. */
export interface ToolCtx {
	itemRect?(id: string): { x: number; y: number; w: number; h: number } | undefined;
	readonly items?: import('../../core/model/item').Item[];
	readonly lines?: import('../../core/model/item').FigLine[];
	nodes: any[];
	edges: any[];
	groups: any[];
	/** Screen pixels per mm. */
	scale: number;
	view(): { ox: number; oy: number };
	sel(): Selection;
	byId(id: string): any;
	layout(n: any): { w: number; h: number };
	snap(v: number): number;
	nodeAt(p: Point, margin?: number): any;
	descendant(id: string, parent: string): boolean;
	edgeGeom(e: any): any;
	endpointObject(id: string): any;
	endpointTarget(p: Point, disableSnap?: boolean): any;
	dropAnchor(p: Point, ids: string[]): any;
	labelDrop(p: Point, n: any): any;
	labelTarget(ref: LabelRef): any;
	frameTitleGeom(g: any): any;
	arrowLabelGeom(e: any, style?: any, text?: any, step?: any): any;
	projectLabel(e: any, p: Point, text?: any, step?: any): any;
	selBox(ids: string[]): { x0: number; x1: number; y0: number; y1: number };
	newId(): string;
	/** A valid category for a new box: the last one used, or none. */
	lastCat(): string;
	/** The selection after a click on a layer row or a frame, as the layer panel computes it. */
	clickLayer(id: string, additive: boolean): Selection;
	duplicateOp(ids: string[], dx: number, dy: number): { op: Op; select: string[] };
	hover(): string | null;
	/** TeX source for the text of a title field. */
	tex(text: string): string;
	/** Takes the unsent box and arrow of a Tab draft out of the model. */
	dropDraft(draft: any): void;
}
