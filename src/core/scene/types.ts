// What the canvas draws, as plain data: keyed primitives in millimetres, y pointing down (SVG orientation).
// Paint order is array order. No DOM, no view: pan and zoom are the renderer's business.
import type { FigureGeometry } from '../geometry/figure-geometry';
import type { Category, FigEdge, FigNode, Group, Icon } from '../model/figure';
import type { ObjectRef } from '../model/refs';

export type PrimKind = 'g' | 'rect' | 'ellipse' | 'circle' | 'line' | 'path' | 'text' | 'defs' | 'clipPath' | 'pattern';
export type Attrs = Record<string, string | number>;

// What a pointer event landed on; the renderer writes it as data-* attributes and reads it back in hit().
export type HitRef =
	| { k: 'node'; id: string }
	| { k: 'locked' }
	| { k: 'edge'; index: number }
	| { k: 'mid'; index: number }
	| { k: 'segment'; index: number; j: number }
	| { k: 'corner'; index: number; j: number }
	| { k: 'endpoint'; index: number; end: string }
	| { k: 'group'; id: string }
	| { k: 'label'; ref: { group?: string; index?: number; slot?: number } }
	| { k: 'scale'; dir: string }
	| { k: 'resize'; id: string; dir: string }
	| { k: 'handle'; id: string };

export interface Prim {
	/** Unique among its siblings; the renderer patches the DOM by it. */
	key: string;
	kind: PrimKind;
	/** The object this primitive belongs to. */
	ref?: ObjectRef;
	hit?: HitRef;
	/** SVG attributes, lengths in mm (in screen pixels for overlay primitives). */
	attrs: Attrs;
	text?: string;
	children?: Prim[];
}

export interface Scene {
	/** Three layers in paint order: group frames, boxes (with step badges and legend), arrows. */
	prims: Prim[];
}

// The figure as the canvas needs it: the derived snapshot of core/view, without the text.
export interface SceneInput {
	nodes: FigNode[]; // hidden and locked already include the layer
	edges: FigEdge[];
	groups: Group[];
	categories: Category[];
	layers: { id: string; opacity?: number }[];
	legend: boolean;
	font: string;
	arrowStyle: string;
}

export interface SceneCtx {
	icons: Icon[];
	/** The geometry of this very input; built from the input when absent. */
	geometry?: FigureGeometry;
}

export interface SceneOpts {
	/** The box whose title is being edited in place: its text is not drawn. */
	editing?: string | null;
	/** Arrows that get a selection halo under their line. */
	haloEdges?: number[];
}
