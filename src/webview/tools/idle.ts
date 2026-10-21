import * as coreRoutes from '../../core/layout/route';
import { EndpointTool, MidTool, SegmentTool } from './arrows';
import { SelectionMoveTool } from './selection-move';
import { ClickTool } from './click';
import { BandTool } from './band';
import { ConnectTool } from './connect';
import { LabelTool } from './label';
import { PanTool } from './pan';
import { ResizeTool, ScaleTool } from './resize';
import { TextEditTool } from './textedit';
import { fixedUpdate } from './guides';
import { copySel, movable } from './util';
import type { CanvasEvent, Selection, Step, Tool, ToolCtx } from './types';

// No gesture running: a press decides which gesture starts and what is selected; moving only highlights.
export class IdleTool implements Tool {
	constructor(private c: ToolCtx) {}
	private wheelSelection: Selection | null = null;
	down(e: CanvasEvent): Step {
		const c = this.c,
			{ hit, mods, p } = e;
		if (e.button === 2) return { render: false };
		if ('id' in hit) {
			let item = c.items?.find((i) => i.id === hit.id);
			const seen = new Set<string>();
			while (item && !seen.has(item.id)) {
				if (item.locked || item.hidden) return { render: false };
				seen.add(item.id);
				item = c.items?.find((i) => i.id === item!.parent);
			}
		}
		const additive = mods.ctrl || mods.shift;
		let sel = copySel(c.sel());
		if (hit.k !== 'label') sel.label = null;
		if (!additive && hit.k !== 'resize' && hit.k !== 'scale') sel.key = null;
		const step: Step = { clearLayers: e.button !== 1 && !mods.space };
		const start = (next?: Tool): Step => ({ ...step, select: sel, next });
		if (e.button === 1 || mods.space) return start(new PanTool(c, e));
		switch (hit.k) {
			case 'label': {
				if (hit.ref.group) return this.down({ ...e, hit: { k: 'group', id: hit.ref.group } });
				const ref = hit.ref;
				const item = c.items?.find(
					(i) =>
						i.kind === 'Text' &&
						i.parent === c.edges[ref.index!]?.id &&
						i.order === (ref.slot === undefined ? 0 : ref.slot + 1),
				);
				if (item) return this.down({ ...e, hit: { k: 'text', id: item.id, parent: item.parent } });
				sel.nodes.clear();
				sel.edges.clear();
				sel.group = null;
				sel.label = ref;
				return start(new LabelTool(c, e, ref));
			}
			case 'locked':
				return { ...start(), render: false };
			case 'segment':
				return start(new SegmentTool(c, hit.index, hit.j, p, mods.alt));
			case 'endpoint':
				return start(new EndpointTool(c, e, hit.index, hit.end));
			case 'mid':
				return start(new MidTool(c, hit.index));
			case 'group': {
				const already = sel.group === hit.id || sel.nodes.has(hit.id);
				if (!already || additive) {
					if (!additive) {
						sel.nodes.clear();
						sel.edges.clear();
					}
					sel.group = already && additive ? null : hit.id;
					const inside = (parent: string | undefined) => {
						const seen = new Set<string>();
						while (parent && !seen.has(parent)) {
							if (parent === hit.id) return true;
							seen.add(parent);
							parent = c.groups.find((g) => g.id === parent)?.parent;
						}
						return false;
					};
					const members = [...c.nodes, ...(c.lines ?? [])].filter((n) => inside(n.group));
					for (const n of members) {
						if (already && additive) sel.nodes.delete(n.id);
						else sel.nodes.add(n.id);
					}
				}
				const gesture = !additive ? new SelectionMoveTool(c, e, sel) : undefined;
				const narrow = {
					...sel,
					nodes: new Set(
						[...sel.nodes].filter((id) => {
							const n = c.byId(id) || c.lines?.find((l) => l.id === id);
							return n && (n.group === hit.id || c.groups.some((g) => g.id === n.group && g.parent === hit.id));
						}),
					),
					edges: new Set<number>(),
				};
				return start(additive ? undefined : new ClickTool(e, narrow, gesture));
			}
			case 'scale':
				return start(new ScaleTool(c, e, hit.dir, movable(c, sel.nodes)));
			case 'resize':
				return start(new ResizeTool(c, e, hit.id, hit.dir));
			case 'handle':
				return start(new ConnectTool(c, e, hit.id));
			case 'node': {
				let id = hit.id;

				if (additive) {
					if (sel.nodes.has(id)) {
						sel.nodes.delete(id);
						sel.key = null;
					} else {
						sel.nodes.add(id);
						sel.key = id;
					}
				} else if (!sel.nodes.has(id)) {
					sel.group = null;
					sel.nodes = new Set([id]);
					sel.edges = new Set();
				}
				if (additive) return start();
				const narrow = { ...sel, nodes: new Set([id]), edges: new Set<number>(), group: null };
				return {
					...start(new ClickTool(e, narrow, new SelectionMoveTool(c, e, sel))),
					lastCat: c.byId(id)?.cat,
				};
			}
			case 'edge': {
				const i = hit.index,
					selected = sel.edges.has(i);
				if (additive) {
					sel.group = null;
					if (selected) sel.edges.delete(i);
					else sel.edges.add(i);
					return start();
				}
				const before = copySel(sel),
					gesture = this.clickEdge(e, i, sel);
				if (selected) sel = before;
				const drag = sel.nodes.size ? new SelectionMoveTool(c, e, sel) : gesture;
				return start(new ClickTool(e, { ...sel, nodes: new Set(), edges: new Set([i]), group: null }, drag));
			}
			case 'line': {
				if (additive) {
					if (sel.nodes.has(hit.id)) sel.nodes.delete(hit.id);
					else sel.nodes.add(hit.id);
					return start();
				}
				if (!sel.nodes.has(hit.id)) {
					sel.nodes = new Set([hit.id]);
					sel.edges.clear();
					sel.group = null;
				}
				return start(
					new ClickTool(e, { ...sel, nodes: new Set([hit.id]), edges: new Set() }, new SelectionMoveTool(c, e, sel)),
				);
			}
			case 'text': {
				const item = c.items?.find((i) => i.id === hit.id),
					parent = c.items?.find((i) => i.id === hit.parent);
				if (
					item?.kind === 'Text' &&
					item.slot === 'centre' &&
					parent?.kind === 'Shape' &&
					!sel.nodes.has(parent.id) &&
					!sel.nodes.has(item.id)
				)
					return this.down({ ...e, hit: { k: 'node', id: parent.id } });
				if (parent?.kind === 'Frame') return this.down({ ...e, hit: { k: 'group', id: parent.id } });
				if (c.byId(hit.id)) return this.down({ ...e, hit: { k: 'node', id: hit.id } });
				if (additive) {
					if (sel.nodes.has(hit.id)) sel.nodes.delete(hit.id);
					else sel.nodes.add(hit.id);
					return start();
				}
				if (!sel.nodes.has(hit.id)) {
					sel.nodes = new Set([hit.id]);
					sel.edges.clear();
					sel.group = null;
				}
				if (parent?.kind === 'Connector' && sel.nodes.size === 1 && !sel.edges.size)
					sel.label = {
						index: c.edges.findIndex((ed) => ed.id === parent.id),
						...(item && item.order > 0 ? { slot: item.order - 1 } : {}),
					};
				const narrow = { ...sel, nodes: new Set([hit.id]), edges: new Set<number>(), group: null };
				const gesture = new SelectionMoveTool(c, e, sel);
				return start(new ClickTool(e, narrow, gesture));
			}

			default: {
				if (sel.nodes.size || sel.edges.size || sel.group) this.wheelSelection = copySel(sel);
				sel.group = null;
				if (!additive) {
					sel.nodes = new Set();
					sel.edges = new Set();
				}
				return start(new BandTool(c, e, new Set(sel.nodes), new Set(sel.edges)));
			}
		}
	}
	// A click on an arrow selects it; a straight orthogonal arrow can also be dragged by the segment nearest the click.
	private clickEdge(e: CanvasEvent, i: number, sel: Selection): Tool | undefined {
		const c = this.c,
			p = e.p;
		sel.group = null;
		let tool: Tool | undefined;
		if (!e.mods.ctrl) {
			const G = c.edgeGeom(c.edges[i]);
			if (
				G &&
				!G.curve &&
				G.pts.every((q: number[], j: number) => !j || q[0] === G.pts[j - 1][0] || q[1] === G.pts[j - 1][1])
			) {
				let best = Infinity,
					j = 0;
				for (let k = 0; k < G.pts.length - 1; k++) {
					const a = G.pts[k],
						b = G.pts[k + 1],
						x = Math.max(Math.min(a[0], b[0]), Math.min(Math.max(a[0], b[0]), p.x)),
						y = Math.max(Math.min(a[1], b[1]), Math.min(Math.max(a[1], b[1]), p.y)),
						d = Math.hypot(p.x - x, p.y - y);
					if (d < best) {
						best = d;
						j = k;
					}
				}
				tool = new SegmentTool(c, i, j, p, e.mods.alt);
			}
		}
		if (e.mods.ctrl) {
			if (sel.edges.has(i)) sel.edges.delete(i);
			else sel.edges.add(i);
		} else {
			sel.nodes = new Set();
			sel.edges = new Set([i]);
		}
		return tool;
	}
	move(e: CanvasEvent): Step {
		const h = this.c.nodeAt(e.p, 6),
			id = h ? h.id : null;
		return id !== this.c.hover() ? { hover: id } : { render: false };
	}
	up(): Step {
		return {};
	}
	dbl(e: CanvasEvent): Step {
		const c = this.c,
			{ hit, p } = e;
		switch (hit.k) {
			case 'corner': {
				const ed = c.edges[hit.index],
					pts = coreRoutes.removeCorner(c.edgeGeom(ed).pts, hit.j)!;
				return { commit: { op: 'arrow', index: hit.index, ...fixedUpdate(c, ed, pts) }, render: false };
			}
			case 'text':
				return new TextEditTool(c, { kind: 'text', id: hit.id }).open();
			case 'label': {
				const owner = hit.ref.group || c.edges[hit.ref.index!]?.id;
				const item = c.items?.find(
					(i) =>
						i.kind === 'Text' && i.parent === owner && i.order === (hit.ref.slot === undefined ? 0 : hit.ref.slot + 1),
				);
				return item ? new TextEditTool(c, { kind: 'text', id: item.id }).open() : { render: false };
			}
			case 'group':
			case 'locked':
				return { render: false };
			case 'edge':
			case 'mid':
				return this.editEdge(hit.index);
			default: {
				const n = hit.k === 'node' ? c.byId(hit.id) : c.nodeAt(p);
				if (n) return this.editNode(n.id);
				const select = this.wheelSelection ?? undefined;
				this.wheelSelection = null;
				return { wheel: e.screen, select, render: false };
			}
		}
	}
	editNode(id: string): Step {
		const label = this.c.items?.find((i) => i.parent === id && i.kind === 'Text' && i.slot === 'centre');
		return label
			? new TextEditTool(this.c, { kind: 'text', id: label.id }).open()
			: this.c.byId(id)
				? new TextEditTool(this.c, { kind: 'node', id }).open()
				: { render: false };
	}
	editEdge(index: number): Step {
		const ed = this.c.edges[index];
		return ed && this.c.edgeGeom(ed) ? new TextEditTool(this.c, { kind: 'edge', index }).open() : { render: false };
	}
}
