import { fine } from './util';
import type { CanvasEvent, Step, Tool, ToolCtx } from './types';

// The corner handles of a multi-selection: scale positions and widths about the opposite corner.
export class ScaleTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		e: CanvasEvent,
		dir: string,
		ids: string[],
	) {
		const orig = new Map(
			ids.map((id) => {
				const n = c.byId(id);
				return [id, { x: n.x, y: n.y, width: n.width, minh: n.minh }];
			}),
		);
		this.overlay = { scale: dir, x: e.p.x, y: e.p.y, b: c.selBox(ids), orig };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const d = this.overlay,
			dir: string = d.scale,
			b = d.b,
			W = b.x1 - b.x0,
			H = b.y1 - b.y0;
		const dx = e.p.x - d.x,
			dy = e.p.y - d.y;
		let sx = 1,
			sy = 1,
			ax = b.x0,
			ay = b.y0;
		if (dir.includes('e')) {
			sx = (W + dx) / W;
			ax = b.x0;
		}
		if (dir.includes('w')) {
			sx = (W - dx) / W;
			ax = b.x1;
		}
		if (dir.includes('n')) {
			sy = (H + dy) / H;
			ay = b.y0;
		}
		if (dir.includes('s')) {
			sy = (H - dy) / H;
			ay = b.y1;
		}
		if (e.mods.shift && dir.length === 2) {
			sx = sy = Math.max(sx, sy);
		}
		sx = Math.max(0.1, sx);
		sy = Math.max(0.1, sy);
		const nodes = [];
		for (const [id, o] of d.orig as Map<string, any>) {
			const item: any = { id, x: ax + (o.x - ax) * sx, y: ay + (o.y - ay) * sy, width: Math.max(6, o.width * sx) };
			if (o.minh) item.minh = o.minh * sy;
			nodes.push(item);
		}
		d.changed = true;
		return { preview: { nodes } };
	}
	up(): Step {
		const d = this.overlay,
			c = this.c;
		if (!d.changed) return {};
		const ops = [];
		for (const id of d.orig.keys()) {
			const n = c.byId(id);
			ops.push(
				{ op: 'node', id, width: fine(n.width), ...(n.minh ? { minh: fine(n.minh) } : {}) },
				{ op: 'move', id, x: fine(n.x), y: fine(n.y) },
			);
		}
		return { commit: { op: 'batch', ops } };
	}
}

// The side and corner handles of one box.
export class ResizeTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		e: CanvasEvent,
		id: string,
		dir: string,
	) {
		const n = c.byId(id);
		this.overlay = { resize: dir, id, x: e.p.x, y: e.p.y, w0: n.width, h0: c.layout(n).h, x0: n.x, y0: n.y };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const d = this.overlay,
			dir: string = d.resize;
		const dx = this.c.snap(e.p.x - d.x),
			dy = this.c.snap(e.p.y - d.y);
		let w = d.w0,
			h = d.h0,
			x = d.x0,
			y = d.y0;
		if (dir.includes('e')) {
			w = Math.max(6, d.w0 + dx);
			x = d.x0 + (w - d.w0) / 2;
		}
		if (dir.includes('w')) {
			w = Math.max(6, d.w0 - dx);
			x = d.x0 - (w - d.w0) / 2;
		}
		if (dir.includes('n')) {
			h = Math.max(4, d.h0 + dy);
			y = d.y0 + (h - d.h0) / 2;
		}
		if (dir.includes('s')) {
			h = Math.max(4, d.h0 - dy);
			y = d.y0 - (h - d.h0) / 2;
		}
		const item: any = { id: d.id, width: w, x, y };
		if (dir.includes('n') || dir.includes('s')) item.minh = h;
		d.changed = true;
		return { preview: { nodes: [item] } };
	}
	up(): Step {
		const d = this.overlay,
			n = this.c.byId(d.id);
		if (!d.changed) return {};
		return {
			commit: {
				op: 'batch',
				ops: [
					{ op: 'node', id: n.id, width: n.width, ...(/[ns]/.test(d.resize) ? { minh: n.minh } : {}) },
					{ op: 'move', id: n.id, x: n.x, y: n.y },
				],
			},
		};
	}
}
