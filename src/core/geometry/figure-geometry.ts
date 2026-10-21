import { measureCandidate } from './measure-candidate';
// The one geometry of a figure: box sizes, frames, and the path and label position of every arrow.
// The serializer, the canvas and the clipboard all ask this object, so what the canvas draws is what TikZ gets.
// An instance answers for one revision of the figure and routes each arrow at most once.
import { lineLabel } from './line-geometry';
import type { FigLine } from '../model/item';
import { subtreeState } from '../model/tree-queries';
import { lineItems } from '../model/tree';
import * as routing from './route';
import { attachedLabel, frameTitle, pathLabel, sideOffset } from './label-geometry';
import { resolveRoute } from './resolve';
import { slotRect } from './slot-layout';
import type { Category, FigEdge, FigNode, Figure, Group, LabelStyle } from '../model/figure';
import type { Obj, Point, Size } from '../model/node';
import { arrowStyle, categories, edges, fontSize, groups, isHidden, nodes } from '../model/queries';
import { layout } from '../text';

export interface GeometryInput {
	gap?: number;
	lines?: FigLine[];
	nodes: FigNode[]; // hidden already includes the layer
	edges: FigEdge[];
	groups: Group[];
	categories: Category[];
	font: string;
	arrowStyle: string;
}

const PLAIN_ROUTES = ['auto', 'manhattan', 'fixed', 'loop'];

export class FigureGeometry {
	/** How many times the router ran; each arrow is routed at most twice (once bare for the arrows after it, once with them). */
	routed = 0;
	private sizes = new Map<FigNode, Size>();
	private objs?: any[];
	private frames = new Map<string, Obj | null>();
	private bare = new Map<number, Point[] | null>();
	private specials = new Map<FigEdge, any>();
	private bases = new Map<FigEdge, any>();

	constructor(readonly input: GeometryInput) {}

	get font() {
		return this.input.font;
	}

	// The icon a box shows: its own, or the one of its style.
	icon(n: FigNode): string | undefined {
		if (!n.kind) return undefined;
		const c = this.input.categories.find((c) => c.key === n.cat);
		return n.icon === 'none' ? undefined : n.icon === 'category' || (!n.icon && !!c?.icon) ? c?.icon : n.icon;
	}
	// A box as TeX sets it: width, height and wrapped lines.
	size(n: FigNode): Size {
		let s = this.sizes.get(n);
		if (!s) {
			s = layout({ ...n, icon: this.icon(n), style: { ...n.style, font: n.style?.font || this.font } });
			const original = this.input.nodes.find((o) => o.id === n.id);
			const changed = original && !n.kind && (n.width !== original.width || n.minh !== original.minh);
			const b = changed
				? measureCandidate(this.input.nodes, this.input.groups, n, this.font, this.input.gap)
				: slotRect(n) || n.derivedRect || (original && (slotRect(original) || original.derivedRect));
			if (b) s = { ...s, w: b.w, h: b.h, lines: b.lines || s.lines };
			this.sizes.set(n, s);
		}
		return s;
	}
	half(n: FigNode): [number, number] {
		const { w, h } = this.size(n);
		return [w / 2, h / 2];
	}
	anchor(n: FigNode, anchor: string): Point {
		const [w, h] = this.half(n);
		return [
			n.x + (anchor.includes('west') ? -w : anchor.includes('east') ? w : 0),
			n.y + (anchor.includes('north') ? h : anchor.includes('south') ? -h : 0),
		];
	}

	// Every box with its size, then every frame the router must avoid.
	objects(): any[] {
		if (!this.objs) {
			const ns = [
				...this.input.nodes.map((n) => {
					const { w, h } = this.size(n);
					return { ...n, w, h, hidden: n.hidden };
				}),
				...(this.input.lines || []).map((l) => ({
					...l,
					x: (l.start[0] + l.end[0]) / 2,
					y: (l.start[1] + l.end[1]) / 2,
					w: Math.abs(l.end[0] - l.start[0]),
					h: Math.abs(l.end[1] - l.start[1]),
					kind: 'line',
				})),
			];
			for (const l of this.input.lines || [])
				for (const [j, label] of (l.labels || []).entries()) {
					const { p, w, h } = lineLabel(l, label.text, label.style, this.font, this.input.gap);
					ns.push({
						...l,
						id: label.id || l.id + '-label-' + j,
						kind: 'label',
						x: p[0],
						y: p[1],
						w,
						h,
						hidden: !!l.hidden || !!label.style?.hidden,
					} as any);
				}
			const { edges, groups } = this.input;
			this.objs = [
				...ns,
				...groups
					.filter((g) => g.frame !== 'none' || edges.some((e) => e.from === g.id || e.to === g.id))
					.map((g) => routing.bounds(g.id, ns, groups, new Set(), edges))
					.filter((b): b is Obj => !!b),
			];
		}
		return this.objs;
	}
	node(id: string): Obj | undefined {
		return this.objects().find((n) => n.id === id && !n.frame);
	}
	// The rectangle around a group's members, whether or not the group draws a frame.
	frame(id: string): Obj | null {
		let b = this.frames.get(id);
		if (b === undefined) {
			const ns = this.objects().filter((n) => !n.frame);
			b = routing.bounds(id, ns, this.input.groups, new Set(), this.input.edges);
			this.frames.set(id, b);
		}
		return b;
	}
	// An arrow end: a box or a frame.
	endpoint(id: string): Obj | undefined {
		return this.node(id) || this.frame(id) || undefined;
	}
	frameTitle(g: Group) {
		return frameTitle(g, this.frame(g.id));
	}

	private index(e: FigEdge): number {
		const all = this.input.edges;
		const i = all.indexOf(e);
		if (i >= 0) return i;
		// A copy that only differs in its labels (a preview) routes like the original.
		const key = (o: FigEdge) => JSON.stringify({ ...o, labelStyle: undefined, labels: undefined });
		const k = key(e);
		const j = all.findIndex((o) => key(o) === k);
		return j >= 0 ? j : all.length;
	}

	// The shape a plain arrow gets (straight, one jog, bend).
	route(e: FigEdge): { type: string; mid?: number | null; at?: string; bend?: number } {
		const a = this.node(e.from),
			b = this.node(e.to);
		return a && b
			? resolveRoute(e, a as any, b as any, this.input.arrowStyle, (n) => [n.w / 2, n.h / 2])
			: { type: 'line' };
	}

	// The path an earlier arrow takes around the later ones, computed once.
	private path(j: number): Point[] | null {
		let p: Point[] | null | undefined = this.bare.get(j);
		if (p === undefined) {
			const { edges, arrowStyle } = this.input,
				o = edges[j],
				objects = this.objects();
			const x = objects.find((n) => n.id === o.from),
				y = objects.find((n) => n.id === o.to);
			if (x && y) this.routed++;
			p = x && y ? (routing.geometry(o, x, y, edges, arrowStyle, objects)?.pts ?? null) : null;
			this.bare.set(j, p ?? null);
		}
		return p ?? null;
	}

	// The path of an arrow the router or the user shaped (anchors, labels, lanes, frames, loops, fixed chains); null for a plain one.
	special(e: FigEdge): any {
		let g = this.specials.get(e);
		if (g === undefined) {
			g = this.computeSpecial(e);
			this.specials.set(e, g);
		}
		return g;
	}
	private computeSpecial(e: FigEdge): any {
		const { edges, groups, arrowStyle } = this.input;
		if (
			!PLAIN_ROUTES.includes(e.route) &&
			e.from !== e.to &&
			!e.labelStyle &&
			!e.labels?.length &&
			!e.fromAnchor &&
			!e.toAnchor &&
			!groups.some((g) => g.id === e.from || g.id === e.to) &&
			!routing.lane(e, edges) &&
			e.route !== 'u'
		)
			return null;
		const objects = this.objects();
		const a = objects.find((n) => n.id === e.from),
			b = objects.find((n) => n.id === e.to);
		if (
			!PLAIN_ROUTES.includes(e.route) &&
			e.from !== e.to &&
			!e.fromAnchor &&
			!e.toAnchor &&
			!a?.frame &&
			!b?.frame &&
			!routing.lane(e, edges) &&
			e.route !== 'u'
		)
			return routing.legacyGeometry(e, a!, b!, arrowStyle);
		const prior: Point[][] = [];
		const stop = this.index(e);
		for (let j = 0; j < stop; j++) {
			const p = this.path(j);
			if (p) prior.push(p);
		}
		this.routed++;
		return routing.geometry(e, a!, b!, edges, arrowStyle, objects, prior);
	}

	// What the canvas draws for an arrow before its label is placed: the special path, else the plain one.
	base(e: FigEdge): any {
		let g = this.bases.get(e);
		if (g === undefined) {
			g = this.special(e);
			if (!g) {
				const a = this.node(e.from),
					b = this.node(e.to);
				if (a && b) {
					const { special, ...plain } = routing.legacyGeometry(e, a, b, this.input.arrowStyle);
					g = { ...plain, r: this.route(e) };
				} else g = null;
			}
			this.bases.set(e, g);
		}
		return g;
	}
	// The path and the label anchor of an arrow, with the label's position and side applied.
	edge(e: FigEdge): any {
		const G = this.base(e);
		if (!G) return G;
		let label = sideOffset(e, pathLabel(e, G));
		if (e.labelStyle) label = this.label(e)!.p;
		return { ...G, label };
	}
	// Box and position of one label attached to an arrow.
	label(
		e: FigEdge,
		st: LabelStyle = e.labelStyle || {},
		content: string = e.label,
		step: number | undefined = e.style?.step,
	) {
		return attachedLabel(e, this.base(e), this.font, st, content, step, this.input.gap);
	}
}

export function inputOf(fig: Figure): GeometryInput {
	return {
		gap: fig.theme?.kinds?.Shape?.outerGap ?? 1,
		lines: lineItems(fig).map((l) => ({ ...l, hidden: subtreeState(fig, l.id, 'hidden') })),
		nodes: nodes(fig).map((n) => ({ ...n, derivedRect: slotRect(n), hidden: isHidden(fig, n) })),
		edges: edges(fig),
		groups: groups(fig),
		categories: categories(fig),
		font: fontSize(fig),
		arrowStyle: arrowStyle(fig),
	};
}

// A figure changes in place, so its revision is the part of its content geometry depends on.
function revision(fig: Figure): string {
	return JSON.stringify([
		nodes(fig).map((n) => [n, isHidden(fig, n)]),
		lineItems(fig),
		edges(fig),
		groups(fig),
		categories(fig),
		fontSize(fig),
		arrowStyle(fig),
	]);
}

const memo = new WeakMap<Figure, { rev: string; geometry: FigureGeometry }>();

// The geometry of a figure, built again only when its content changed since the last call.
export function geometryOf(fig: Figure): FigureGeometry {
	const rev = revision(fig),
		hit = memo.get(fig);
	if (hit && hit.rev === rev) return hit.geometry;
	const geometry = new FigureGeometry(inputOf(fig));
	memo.set(fig, { rev, geometry });
	return geometry;
}

// Compatibility entry points of the serializer side.
export const routeObjects = (fig: Figure): any[] => geometryOf(fig).objects();
export const specialGeometry = (fig: Figure, e: FigEdge): any => geometryOf(fig).special(e);
