// The questions the scene builders ask about one figure, answered once per build.
import { FigureGeometry } from '../geometry/figure-geometry';
import type { FigEdge, FigNode, Group } from '../model/figure';
import { mm, sizes } from '../text';
import { display } from './style';
import type { SceneCtx, SceneInput, SceneOpts } from './types';

export interface Env {
	fig: SceneInput;
	ctx: SceneCtx;
	opts: SceneOpts;
	geo: FigureGeometry;
	byId(id: string | undefined): FigNode | undefined;
	fontPt(n: FigNode): number;
	size(n: FigNode): { w: number; h: number; lines: string[] };
	textMm(t: string, pt: number, family?: string): number;
	/** An arrow whose end box is hidden is not drawn. */
	hiddenEnd(e: FigEdge): boolean;
	edgeGeom(e: FigEdge): any;
	labelGeom(e: FigEdge, st: any, content: string, step: number | undefined): any;
}

export function makeEnv(fig: SceneInput, ctx: SceneCtx, opts: SceneOpts): Env {
	const geo =
		ctx.geometry ??
		new FigureGeometry({
			nodes: fig.nodes,
			edges: fig.edges,
			groups: fig.groups,
			categories: fig.categories,
			font: fig.font,
			arrowStyle: fig.arrowStyle,
		});
	const index = new Map(fig.nodes.map((n) => [n.id, n]));
	const hiddenEnd = (e: FigEdge) => !!(index.get(e.from)?.hidden || index.get(e.to)?.hidden);
	return {
		fig,
		ctx,
		opts,
		geo,
		byId: (id) => (id === undefined ? undefined : index.get(id)),
		fontPt: (n) => sizes[n?.style?.font || fig.font] || 10,
		size: (n) => geo.size(n),
		textMm: (t, pt, family = 'Sakuga Sans') => mm(t, pt, family === 'Sakuga Mono' ? 'mono' : 'sans'),
		hiddenEnd,
		edgeGeom: (e) => (hiddenEnd(e) ? null : geo.edge(e)),
		labelGeom: (e, st, content, step) => (!hiddenEnd(e) && geo.base(e) ? geo.label(e, st, content, step) : null),
	};
}

export const members = (nodes: FigNode[], groups: Group[], id: string): string[] =>
	nodes.filter((n) => inGroup(n, id, groups)).map((n) => n.id);

export function inGroup(n: FigNode, id: string, groups: Group[]): boolean {
	let parent = n.group;
	const seen = new Set<string>();
	while (parent && !seen.has(parent)) {
		if (parent === id) return true;
		seen.add(parent);
		parent = groups.find((g) => g.id === parent)?.parent as string;
	}
	return false;
}

// Boxes in paint order: a box after the one it hangs on.
export function paintOrder(nodes: FigNode[]): FigNode[] {
	const index = new Map(nodes.map((n) => [n.id, n]));
	const ordered: FigNode[] = [],
		seen = new Set<string>();
	const visit = (n: FigNode) => {
		if (seen.has(n.id)) return;
		seen.add(n.id);
		const parent = n.attachment && index.get(n.attachment.parent);
		if (parent) visit(parent);
		ordered.push(n);
	};
	nodes.forEach(visit);
	return ordered;
}

export interface HNode {
	kind: 'node' | 'group';
	id: string;
	children: HNode[];
}
// Sibling subtrees sorted by their frontmost box (the front of the stack first).
export function hierarchy(ns: FigNode[], gs: Group[]): HNode[] {
	const rank = (item: { kind: string; id: string }) =>
		item.kind === 'node'
			? ns.findIndex((n) => n.id === item.id)
			: Math.max(-1, ...ns.map((n, i) => (inGroup(n, item.id, gs) ? i : -1)));
	const walk = (parent: string, seen = new Set<string>()): HNode[] => {
		const children = [
			...ns.filter((n) => (n.group || '') === parent).map((n) => ({ kind: 'node' as const, id: n.id })),
			...gs
				.filter((g) => (g.parent || '') === parent && !seen.has(g.id))
				.map((g) => ({ kind: 'group' as const, id: g.id })),
		].sort((a, b) => rank(b) - rank(a));
		return children.map((item) => ({
			...item,
			children: item.kind === 'group' ? walk(item.id, new Set([...seen, item.id])) : [],
		}));
	};
	return walk('');
}

// The extent of the boxes that are drawn, including the title beside an icon.
export function nodesBox(env: Env): { x0: number; x1: number; y0: number; y1: number } {
	const b = env.fig.nodes.filter((n) => !n.hidden).map((n) => ({ n, ...env.size(n) }));
	if (!b.length) return { x0: 0, x1: 0, y0: 0, y1: 0 };
	return {
		x0: Math.min(...b.map((o) => o.n.x - o.w / 2)),
		x1: Math.max(
			...b.map(
				(o) =>
					o.n.x +
					o.w / 2 +
					(o.n.kind === 'icon' && o.n.title ? 1 + env.textMm(display(o.n.title), env.fontPt(o.n)) : 0),
			),
		),
		y0: Math.min(...b.map((o) => o.n.y - o.h / 2)),
		y1: Math.max(...b.map((o) => o.n.y + o.h / 2)),
	};
}
