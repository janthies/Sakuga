// Loose shapes of the objects the text, routing and layout code passes around (millimetres, y upwards).
// The index signature keeps the many optional fields of a node, group or arrow readable without listing them all.
export type Point = number[];

export interface Obj {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	[key: string]: any;
}

export interface NodeLike {
	id: string;
	title: string;
	x: number;
	y: number;
	width: number;
	[key: string]: any;
}

export interface GroupLike {
	id: string;
	parent?: string;
	[key: string]: any;
}

export interface EdgeLike {
	from: string;
	to: string;
	[key: string]: any;
}

export interface Size {
	w: number;
	h: number;
	lines: string[];
}

/** A figure operation as sketch.js emits it; the op union is typed in S6. */
export type OpLike = { op: string; [key: string]: any };
export type Layout = (n: any) => any;
