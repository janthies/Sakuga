import { guides } from './guides';
import { fine } from './util';
import type { CanvasEvent, Op, Step, Tool, ToolCtx } from './types';

// Drag boxes: grid snap, Shift locks the axis, Ctrl turns grid and guides off, Alt copies.
export class MoveTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		e: CanvasEvent,
		orig: Map<string, any>,
	) {
		this.overlay = { move: true, x: e.p.x, y: e.p.y, orig, dx: 0, dy: 0, copy: e.mods.alt };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const d = this.overlay,
			c = this.c,
			p = e.p;
		const free = e.mods.ctrl;
		let dx = free ? fine(p.x - d.x) : c.snap(p.x - d.x),
			dy = free ? fine(p.y - d.y) : c.snap(p.y - d.y);
		let lockX = false,
			lockY = false;
		if (e.mods.shift) {
			if (Math.abs(dx) > Math.abs(dy)) {
				dy = 0;
				lockY = true;
			} else {
				dx = 0;
				lockX = true;
			}
		}
		d.guides = [];
		if (!free) {
			const g = guides(c, d.orig, dx, dy, lockX, lockY);
			dx += g.dx;
			dy += g.dy;
			d.guides = g.lines;
		}
		d.dx = dx;
		d.dy = dy;
		d.target = e.mods.alt || d.copy ? null : c.dropAnchor(p, [...d.orig.keys()]);
		const nodes: any[] = [];
		for (const [id, o] of d.orig as Map<string, any>) {
			const n = c.byId(id);
			if (!n) continue;
			const item: any = { id, x: d.copy ? o.x : o.x + dx, y: d.copy ? o.y : o.y + dy };
			if (o.attachment && !d.copy) {
				const parentSelected = [...d.orig.keys()].some((other) => c.descendant(n.id, other));
				item.attachment = {
					...o.attachment,
					dx: o.attachment.dx + (parentSelected ? 0 : dx),
					dy: o.attachment.dy + (parentSelected ? 0 : dy),
				};
			}
			nodes.push(item);
		}
		return { preview: { nodes, place: true } };
	}
	up(e: CanvasEvent): Step {
		const d = this.overlay,
			c = this.c;
		if (!d.dx && !d.dy) return {};
		const ids: string[] = [...d.orig.keys()];
		if (d.copy) {
			const dup = c.duplicateOp(ids, d.dx, d.dy);
			return { commit: dup.op, pendingSelect: dup.select };
		}
		const ops: Op[] = ids.map((id) => ({ op: 'move', id, x: c.byId(id).x, y: c.byId(id).y }));
		let target = d.target;
		if (!e.mods.alt && d.orig.size === 1) {
			const id = ids[0],
				drop = c.labelDrop(e.p, c.byId(id));
			if (drop) {
				ops.push({ op: 'attachLabel', id, ...drop });
				target = null;
			}
		}
		if (target && !e.mods.alt) {
			for (const id of ids) {
				if (c.byId(id).attachment?.parent === target.parent.id || ids.some((parent) => c.descendant(id, parent))) {
					continue;
				}
				ops.push({ op: 'attach', id, attachment: c.attachmentFor(c.byId(id), target.parent, target.anchor) });
			}
		}
		return { commit: { op: 'batch', ops } };
	}
}
