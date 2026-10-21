import { mm } from '../../core/text';
import { store } from './store';
import { geo, touch } from './geometry';
import { sizes } from './constants';
import { vscode } from '../platform/host';
import { svg } from '../platform/dom';
import type { ViewNode, ViewStyle } from './types';
import type { OpLike as Op } from '../../core/model/node';

type At = { x: number; y: number };

export const byId = (id: string) => store.nodes.find((n) => n.id === id);
export const catOf = (key: string) => store.cats.find((c) => c.key === key);
export const snap = (v: number) => (store.grid > 0 ? Math.round(v / store.grid) * store.grid : v);
export const fine = (v: number) => Math.round(v * 10) / 10;
export const px = (x: number) => store.view.ox + x * store.view.s;
export const py = (y: number) => store.view.oy - y * store.view.s;
export const post = (op: Op) => {
	const assign = (o: Op): Op =>
		o.op === 'batch'
			? { ...o, ops: (o.ops as Op[]).map(assign) }
			: o.op === 'addNode'
				? { ...o, layer: store.activeLayer }
				: o;
	vscode.postMessage({ type: 'op', op: assign(op) });
};
export const isBox = (n?: ViewNode) => !!n && !n.kind;
export function anchorPoint(n: ViewNode, a: string) {
	const [x, y] = geo().anchor(n, a);
	return { x, y };
}
export function descendant(id: string, parent: string) {
	const seen = new Set<string>();
	let item = store.items.find((i) => i.id === id);
	while (item && !seen.has(item.id)) {
		seen.add(item.id);
		if (item.parent === parent) return true;
		item = store.items.find((i) => i.id === item!.parent);
	}
	return false;
}
export function resolveAttached() {
	touch();
}
export const fontPt = (n?: ViewNode) => sizes[(n?.style?.font || store.figureFont) as keyof typeof sizes] || 10;
export const groupById = (id?: string | null) => store.groups.find((g) => g.id === id);
export function inGroup(n: { group: string }, id: string, gs = store.groups) {
	let parent: string | undefined = n.group,
		seen = new Set<string>();
	while (parent && !seen.has(parent)) {
		if (parent === id) {
			return true;
		}
		seen.add(parent);
		parent = gs.find((g) => g.id === parent)?.parent;
	}
	return false;
}
export const members = (id: string) => store.nodes.filter((n) => inGroup(n, id)).map((n) => n.id);
export const layout = (n: ViewNode) => geo().size(n);
export const effectiveIcon = (n: ViewNode) => geo().icon(n) ?? '';
export function nodeAt(p: At, margin = 0) {
	return paintOrder()
		.reverse()
		.find((n) => {
			if (n.hidden || n.locked) {
				return false;
			}
			const { w, h } = layout(n);
			return Math.abs(p.x - n.x) <= w / 2 + margin && Math.abs(p.y - n.y) <= h / 2 + margin;
		});
}
export function toMm(ev: { clientX: number; clientY: number }) {
	const r = svg.getBoundingClientRect();
	return {
		x: (ev.clientX - r.left - store.view.ox) / store.view.s,
		y: (store.view.oy - (ev.clientY - r.top)) / store.view.s,
	};
}
// Text width in mm from the advance tables, so the canvas measures what TeX sets.
export const textMm = (t: string, pt: number, family = 'Sakuga Sans') =>
	mm(t, pt, family === 'Sakuga Mono' ? 'mono' : 'sans');
export const styleDef = (key: string) => store.styles.find((s) => s.key === key);
export const nodeStyleKind = (n: ViewNode) => (n.kind === 'label' ? 'label' : n.kind ? '' : 'box');
export const styleUsers = (def: ViewStyle) =>
	def.kind === 'arrow'
		? store.edges.filter((e) => e.styleKey === def.key).length
		: store.nodes.filter((n) => n.cat === def.key && nodeStyleKind(n) === def.kind).length;
export const isOverride = (o: { overrides?: string[] }, prop: string) =>
	(o.overrides || []).includes(prop) || (prop === 'weight' && (o.overrides || []).includes('lineWidth'));
export function paintOrder() {
	const ordered: ViewNode[] = [],
		seen = new Set<string>();
	const visit = (n: ViewNode) => {
		if (seen.has(n.id)) {
			return;
		}
		seen.add(n.id);
		const parent = n.attachment && byId(n.attachment.parent);
		if (parent) {
			visit(parent);
		}
		ordered.push(n);
	};
	store.nodes.forEach(visit);
	return ordered;
}
