import * as coreRoutes from '../../core/layout/route';
import { EndpointTool, MidTool, SegmentTool } from './arrows';
import { BandTool } from './band';
import { ConnectTool } from './connect';
import { LabelTool } from './label';
import { MoveTool } from './move';
import { PanTool } from './pan';
import { ResizeTool, ScaleTool } from './resize';
import { TextEditTool } from './textedit';
import { fixedUpdate } from './guides';
import { copySel, movable, origins } from './util';
import type { CanvasEvent, Selection, Step, Tool, ToolCtx } from './types';

// No gesture running: a press decides which gesture starts and what is selected; moving only highlights.
export class IdleTool implements Tool {
	constructor(private c: ToolCtx) {}
	down(e: CanvasEvent): Step {
		const c = this.c,
			{ hit, mods, p } = e;
		const additive = mods.ctrl || mods.shift;
		let sel = copySel(c.sel());
		if (hit.k !== 'label') sel.label = null;
		if (!additive && hit.k !== 'resize' && hit.k !== 'scale') sel.key = null;
		const step: Step = { clearLayers: e.button !== 1 && !mods.space };
		const start = (next?: Tool): Step => ({ ...step, select: sel, next });
		if (e.button === 1 || mods.space) return start(new PanTool(c, e));
		switch (hit.k) {
			case 'label': {
				sel.nodes.clear();
				sel.edges.clear();
				sel.group = null;
				sel.label = hit.ref;
				return start(new LabelTool(c, e, hit.ref));
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
				sel = c.clickLayer(hit.id, additive);
				sel.label = null;
				sel.nodes = new Set(movable(c, sel.nodes));
				const orig = origins(c, [...sel.nodes]);
				return start(!mods.ctrl && orig.size ? new MoveTool(c, e, orig) : undefined);
			}
			case 'scale':
				return start(new ScaleTool(c, e, hit.dir, movable(c, sel.nodes)));
			case 'resize':
				return start(new ResizeTool(c, e, hit.id, hit.dir));
			case 'handle':
				return start(new ConnectTool(c, e, hit.id));
			case 'node': {
				const id = hit.id;
				sel.group = null;
				if (additive) {
					if (sel.nodes.has(id) && !mods.shift) {
						sel.nodes.delete(id);
						sel.key = null;
					} else {
						sel.nodes.add(id);
						sel.key = id;
					}
				} else if (!sel.nodes.has(id)) {
					sel.nodes = new Set([id]);
					sel.edges = new Set();
				}
				if (mods.ctrl) return start();
				return { ...start(new MoveTool(c, e, origins(c, movable(c, sel.nodes)))), lastCat: c.byId(id).cat };
			}
			case 'edge':
				return start(this.clickEdge(e, hit.index, sel));
			default: {
				sel.group = null;
				if (!mods.ctrl) {
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
			case 'label':
				return { select: { ...copySel(c.sel()), label: hit.ref } };
			case 'group':
			case 'locked':
				return { render: false };
			case 'edge':
			case 'mid':
				return this.editEdge(hit.index);
			default: {
				const n = hit.k === 'node' ? c.byId(hit.id) : c.nodeAt(p);
				if (n) return this.editNode(n.id);
				const id = c.newId();
				return {
					pendingEdit: id,
					render: false,
					commit: { op: 'addNode', id, x: c.snap(p.x), y: c.snap(p.y), title: 'Box', cat: c.lastCat() },
				};
			}
		}
	}
	editNode(id: string): Step {
		return this.c.byId(id) ? new TextEditTool(this.c, { kind: 'node', id }).open() : { render: false };
	}
	editEdge(index: number): Step {
		const ed = this.c.edges[index];
		return ed && this.c.edgeGeom(ed) ? new TextEditTool(this.c, { kind: 'edge', index }).open() : { render: false };
	}
}
