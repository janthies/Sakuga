import { loadIcons } from './env';
import { geometryOf } from '../../src/core/geometry/figure-geometry';

loadIcons();
const { parse } = require('../../src/core/codec/parse');

// What both sides must agree on: box sizes, frames, and for every arrow its route choice, path, label anchor and label boxes.
// A side is given as the questions the code asks of its geometry (the serializer asks core directly, the canvas through its
// webview entry points), and the objects it asks about.
interface Questions {
	nodes: any[];
	edges: any[];
	groups: any[];
	size(n: any): { w: number; h: number; lines: any[] };
	half(n: any): number[];
	frame(id: string): any;
	frameTitle(g: any): any;
	route(e: any): any;
	base(e: any): any;
	edge(e: any): any;
	label(e: any, st: any, content: string, step?: number): any;
	drawn(e: any): boolean;
}

export function describe(q: Questions) {
	const rect = (o: any) => o && { id: o.id, x: o.x, y: o.y, w: o.w, h: o.h };
	const byId = (a: any, b: any) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	return {
		nodes: q.nodes
			.map((n) => {
				const s = q.size(n);
				return { id: n.id, x: n.x, y: n.y, w: s.w, h: s.h, lines: s.lines.length, half: q.half(n) };
			})
			.sort(byId),
		frames: q.groups
			.filter((g) => g.frame !== 'none')
			.map((g) => rect(q.frame(g.id)))
			.filter(Boolean)
			.sort(byId),
		frameTitles: q.groups.map((g) => ({ id: g.id, title: q.frameTitle(g) })).sort(byId),
		edges: q.edges.map((e, index) => ({
			index,
			from: e.from,
			to: e.to,
			route: q.route(e),
			drawn: q.drawn(e),
			base: q.base(e),
			geometry: q.edge(e),
			labels: [
				...(e.labelStyle || e.label ? [{ slot: null, g: q.label(e, e.labelStyle || {}, e.label, e.style?.step) }] : []),
				...(e.labels || []).map((l: any, slot: number) => ({ slot, g: q.label(e, l.style || {}, l.text, 0) })),
			],
		})),
	};
}

// Geometry as the serializer side sees it: core, asked about the figure parsed from the file.
export function serializerDump(text: string) {
	const fig = parse(text);
	const geo = geometryOf(fig);
	const { nodes, edges, groups } = geo.input;
	const hidden = (id: string) => nodes.find((n) => n.id === id)?.hidden;
	return describe({
		nodes,
		edges,
		groups,
		size: (n) => geo.size(n),
		half: (n) => geo.half(n),
		frame: (id) => geo.frame(id),
		frameTitle: (g) => geo.frameTitle(g),
		route: (e) => geo.route(e),
		base: (e) => geo.base(e),
		edge: (e) => geo.edge(e),
		label: (e, st, content, step) => geo.label(e, st, content, step),
		drawn: (e) => !hidden(e.from) && !hidden(e.to),
	});
}

// Geometry as the canvas computes it: the webview's entry points, asked about the store it built from the state message.
export function canvasDump(hook: any) {
	const s = hook.state();
	return describe({
		nodes: s.nodes,
		edges: s.edges,
		groups: s.groups,
		size: (n) => hook.layout(n),
		half: (n) => hook.boxHalf(n),
		frame: (id) => hook.frameRect(id),
		frameTitle: (g) => hook.frameTitleGeom(g),
		route: (e) => hook.resolveRoute(e),
		base: (e) => hook.baseEdgeGeom(e),
		edge: (e) => hook.rawEdge(e),
		label: (e, st, content, step) => hook.rawLabel(e, st, content, step),
		drawn: (e) => hook.edgeGeom(e) !== null,
	});
}

export interface Drift {
	object: string;
	what: string;
	mm: number | 'structural';
	detail?: unknown;
}

// Every difference between the two dumps, found by walking both: numbers that differ by more than 0.0005 mm, and anything
// that exists on one side only or has another shape.
export function drift(S: unknown, C: unknown): Drift[] {
	const out: Drift[] = [];
	const walk = (a: any, b: any, path: string) => {
		if (typeof a === 'number' && typeof b === 'number') {
			if (Math.abs(a - b) > 0.0005)
				out.push({ object: path, what: 'value', mm: Math.round(Math.abs(a - b) * 1000) / 1000 });
		} else if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length)
				out.push({ object: path, what: 'length', mm: 'structural', detail: [a.length, b.length] });
			else a.forEach((v, i) => walk(v, b[i], `${path}[${i}]`));
		} else if (a && b && typeof a === 'object' && typeof b === 'object') {
			for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
				if (a[k] === undefined && b[k] === undefined) continue;
				walk(a[k], b[k], `${path}.${k}`);
			}
		} else if (a !== b) out.push({ object: path, what: 'different', mm: 'structural', detail: [a, b] });
	};
	walk(S, C, '');
	return out;
}
