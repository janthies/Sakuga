// @ts-nocheck
import { mm } from '../../core/text';
import { store } from './store';
import { geo, touch } from './geometry';
import { sizes } from './constants';
import { vscode } from '../platform/host';
import { svg } from '../platform/dom';

export const byId = (id) => store.nodes.find((n) => n.id === id);
export const catOf = (key) => store.cats.find((c) => c.key === key);
export const snap = (v) => Math.round(v / store.grid) * store.grid;
export const fine = (v) => Math.round(v * 10) / 10;
export const px = (x) => store.view.ox + x * store.view.s;
export const py = (y) => store.view.oy - y * store.view.s;
export const post = (op) => {
	const assign = (o) =>
		o.op === 'batch' ? { ...o, ops: o.ops.map(assign) } : o.op === 'addNode' ? { ...o, layer: store.activeLayer } : o;
	vscode.postMessage({ type: 'op', op: assign(op) });
};
export const isBox = (n) => n && !n.kind;
export function anchorPoint(n, a) {
	const [x, y] = geo().anchor(n, a);
	return { x, y };
}
export function descendant(id, parent) {
	const seen = new Set();
	let n = byId(id);
	while (n?.attachment && !seen.has(n.id)) {
		seen.add(n.id);
		if (n.attachment.parent === parent) {
			return true;
		}
		n = byId(n.attachment.parent);
	}
	return false;
}
export function attachmentFor(n, parent, anchor, ownAnchor = anchor) {
	const p = anchorPoint(parent, anchor),
		o = anchorPoint(n, ownAnchor);
	return { parent: parent.id, anchor, ownAnchor, dx: fine(o.x - p.x), dy: fine(o.y - p.y) };
}
export function resolveAttached() {
	geo().place(store.nodes);
	touch();
}
export const fontPt = (n) => sizes[n?.style?.font || store.figureFont] || 10;
export const groupById = (id) => store.groups.find((g) => g.id === id);
export function inGroup(n, id, gs = store.groups) {
	let parent = n.group,
		seen = new Set();
	while (parent && !seen.has(parent)) {
		if (parent === id) {
			return true;
		}
		seen.add(parent);
		parent = gs.find((g) => g.id === parent)?.parent;
	}
	return false;
}
export const members = (id) => store.nodes.filter((n) => inGroup(n, id)).map((n) => n.id);
export const layout = (n) => geo().size(n);
export const effectiveIcon = (n) => geo().icon(n) ?? '';
export function nodeAt(p, margin = 0) {
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
export function toMm(ev) {
	const r = svg.getBoundingClientRect();
	return {
		x: (ev.clientX - r.left - store.view.ox) / store.view.s,
		y: (store.view.oy - (ev.clientY - r.top)) / store.view.s,
	};
}
// Text width in mm from the advance tables, so the canvas measures what TeX sets.
export const textMm = (t, pt, family = 'Sakuga Sans') => mm(t, pt, family === 'Sakuga Mono' ? 'mono' : 'sans');
export const styleDef = (key) => store.styles.find((s) => s.key === key);
export const nodeStyleKind = (n) => (n.kind === 'label' ? 'label' : n.kind ? '' : 'box');
export const styleUsers = (def) =>
	def.kind === 'arrow'
		? store.edges.filter((e) => e.styleKey === def.key).length
		: store.nodes.filter((n) => n.cat === def.key && nodeStyleKind(n) === def.kind).length;
export const isOverride = (o, prop) =>
	(o.overrides || []).includes(prop) || (prop === 'weight' && (o.overrides || []).includes('lineWidth'));
export function paintOrder() {
	const ordered = [],
		seen = new Set();
	const visit = (n) => {
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
