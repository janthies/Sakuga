// @ts-nocheck
import * as coreSketch from '../../core/layout/sketch';
import { store } from '../store/store';
import { byId, descendant, fine, fontPt, isBox, layout, paintOrder, post, px, py, textMm } from '../store/model';
import { ANCHORS, CODE_PT, PT, TITLE_PT, show, tex } from '../store/constants';
import { frameTitleGeom, labelPoint, projectLabel } from '../render/labelgeom';
import { baseEdgeGeom } from '../render/geometry';
import { frameRect } from '../render/anchors';
import { newId } from '../store/layers';
import { etools, input, svg } from '../platform/dom';
import { render } from '../render/scene';
import { edgeGeom } from '../render/edges';

export function startEdit(id) {
	const n = byId(id);
	if (!n) {
		return;
	}
	store.editing = id;
	const { w, h } = layout(n);
	const r = svg.getBoundingClientRect();
	Object.assign(input.style, {
		display: 'block',
		left: `${r.left + px(n.x - w / 2)}px`,
		top: `${r.top + py(n.y + h / 2)}px`,
		width: `${w * store.view.s}px`,
		height: `${h * store.view.s}px`,
		fontSize: `${TITLE_PT * PT * store.view.s}px`,
	});
	if (n.kind === 'icon') {
		Object.assign(input.style, {
			left: `${r.left + px(n.x + w / 2 + 1)}px`,
			top: `${r.top + py(n.y + 3)}px`,
			width: `${Math.max(25, textMm(show(n.title), fontPt(n), 'Sakuga Sans') + 4) * store.view.s}px`,
			height: `${6 * store.view.s}px`,
		});
	}
	input.value = show(n.title.split('\\\\').join(' / '));
	render();
	input.focus();
	input.select();
}
export function startEdgeEdit(i) {
	const G = store.edges[i] && edgeGeom(store.edges[i]);
	if (!G) {
		return;
	}
	store.editing = `edge:${i}`;
	const r = svg.getBoundingClientRect(),
		w = 40;
	Object.assign(input.style, {
		display: 'block',
		left: `${r.left + px(G.label[0]) - (w * store.view.s) / 2}px`,
		top: `${r.top + py(G.label[1]) - 3 * store.view.s}px`,
		width: `${w * store.view.s}px`,
		height: `${6 * store.view.s}px`,
		fontSize: `${CODE_PT * PT * store.view.s}px`,
	});
	input.value = show(store.edges[i].label);
	etools.style.display = 'none';
	input.focus();
	input.select();
}
export function endEdit(commit) {
	if (!store.editing) {
		return;
	}
	const id = store.editing;
	store.editing = null;
	input.style.display = 'none';
	if (store.freshBox && store.freshBox.node.id === id) {
		const draft = store.freshBox;
		store.freshBox = null;
		store.nodes = store.nodes.filter((n) => n.id !== id);
		store.edges = store.edges.filter((e) => e !== draft.edge);
		if (commit || input.value.trim()) {
			draft.batch.ops[0].title = input.value.split(' / ').map(tex).join('\\\\');
			store.selN = new Set([draft.edge.from]);
			store.pendingSelect = [id];
			post(draft.batch);
		} else {
			store.selN = new Set([draft.edge.from]);
		}
	} else if (commit && id.startsWith('edge:')) {
		post({ op: 'arrow', index: +id.slice(5), label: tex(input.value) });
	} else if (commit) {
		post({ op: 'batch', ops: [{ op: 'node', id, title: input.value.split(' / ').map(tex).join('\\\\') }] });
	}
	render();
}
export function nextConnectedBox(below) {
	const n = store.selN.size === 1 && !store.selE.size && byId([...store.selN][0]);
	if (!isBox(n) || n.locked || n.hidden) return false;
	store.activeLayer = n.layer || store.activeLayer;
	const draft = coreSketch.nextBox(
		store.nodes,
		store.edges,
		{ ...n, style: withoutOverrides(n) },
		newId(),
		below,
		layout,
	);
	store.freshBox = draft;
	store.nodes.push(draft.node);
	store.edges.push(draft.edge);
	store.selG = null;
	store.keyObject = null;
	store.selN = new Set([draft.node.id]);
	store.selE.clear();
	startEdit(draft.node.id);
	return true;
}
// The style of a box without the properties that differ from it.
function withoutOverrides(n) {
	const def = store.styles.find((s) => s.key === n.cat),
		st = { ...n.style };
	for (const k of n.overrides || []) {
		if (def && def.props[k] !== undefined) {
			st[k] = def.props[k];
		} else {
			delete st[k];
		}
	}
	return st;
}
export function dropAnchor(p, ids) {
	const parent = paintOrder()
		.reverse()
		.find(
			(n) =>
				isBox(n) &&
				!n.hidden &&
				!n.locked &&
				!ids.includes(n.id) &&
				!ids.some((id) => descendant(n.id, id)) &&
				Math.abs(p.x - n.x) <= layout(n).w / 2 &&
				Math.abs(p.y - n.y) <= layout(n).h / 2,
		);
	if (!parent) {
		return null;
	}
	const { w, h } = layout(parent),
		col = Math.max(0, Math.min(2, Math.floor(((p.x - parent.x + w / 2) / w) * 3))),
		row = Math.max(0, Math.min(2, Math.floor(((parent.y + h / 2 - p.y) / h) * 3)));
	return { parent, anchor: ANCHORS[row * 3 + col] };
}
export function labelDrop(p, n) {
	if (n.kind !== 'label') return null;
	for (let i = store.edges.length - 1; i >= 0; i--) {
		const st = projectLabel(store.edges[i], p),
			a = labelPoint(baseEdgeGeom({ ...store.edges[i], labelStyle: st }), st);
		if (Math.hypot(a[0] - p.x, a[1] - p.y) < 3) return { index: i, style: st };
	}
	for (const g of typeof store.groups === 'undefined' ? [] : store.groups) {
		const b = frameRect(g.id);
		if (b && Math.abs(p.x - b.x) < b.w / 2 + 3 && Math.abs(p.y - b.y - b.h / 2) < 3) {
			const G = frameTitleGeom(g);
			return { group: g.id, style: { dx: fine(p.x - G.p[0]), dy: fine(p.y - G.p[1]) } };
		}
	}
	return null;
}

export function initToolsEdit() {
	input.addEventListener('keydown', (ev) => {
		if (ev.key === 'Enter') {
			endEdit(true);
			ev.preventDefault();
		}
		if (ev.key === 'Escape') {
			endEdit(false);
			ev.preventDefault();
		}
		ev.stopPropagation();
	});
	input.addEventListener('blur', () => endEdit(true));
}
