// @ts-nocheck
import * as coreText from '../../core/text';
import { store } from './store';
import { sizes } from './constants';
import { vscode } from '../platform/host';
import { measure, svg } from '../platform/dom';

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
	const { w, h } = layout(n);
	return {
		x: n.x + (a.includes('west') ? -w / 2 : a.includes('east') ? w / 2 : 0),
		y: n.y + (a.includes('north') ? h / 2 : a.includes('south') ? -h / 2 : 0),
	};
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
	const done = new Set(),
		visiting = new Set();
	const visit = (n) => {
		if (done.has(n.id) || visiting.has(n.id)) {
			return;
		}
		visiting.add(n.id);
		const a = n.attachment,
			p = a && byId(a.parent);
		if (p && !visiting.has(p.id)) {
			visit(p);
			const pt = anchorPoint(p, a.anchor),
				own = anchorPoint({ ...n, x: 0, y: 0 }, a.ownAnchor);
			n.x = pt.x + a.dx - own.x;
			n.y = pt.y + a.dy - own.y;
		}
		visiting.delete(n.id);
		done.add(n.id);
	};
	store.nodes.forEach(visit);
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
function titleLines(n) {
	return coreText.lines({ ...n, icon: effectiveIcon(n) }, store.figureFont);
}
export function layout(n) {
	return coreText.layout({ ...n, icon: effectiveIcon(n) }, store.figureFont);
}
export const effectiveIcon = (n) => {
	const c = catOf(n.cat);
	return n.icon === 'none' ? '' : n.icon === 'category' || (!n.icon && c?.boxes) ? c?.icon : n.icon;
};
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
export function textMm(t, pt, family, style = {}) {
	measure.font = `${`${style.text?.startsWith('bold') ? 'bold ' : ''}${style.text?.includes('italic') ? 'italic ' : ''}`}${(pt * 96) / 72.27}px '${family}'`;
	return (measure.measureText(t).width * 25.4) / 96;
}
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
