import { slotAt } from '../../core/model/slots';
import { guides } from './guides';
import { fine } from './util';
import type { CanvasEvent, Op, Step, Tool, ToolCtx } from './types';

// Drag boxes: grid snap, Shift locks the axis, Ctrl turns grid and guides off; drops choose parent slots.
export class MoveTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		e: CanvasEvent,
		orig: Map<string, any>,
	) {
		this.overlay = { move: true, x: e.p.x, y: e.p.y, orig, dx: 0, dy: 0, copy: false, target: null };
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
		if (!free && c.snapping !== false) {
			const g = guides(c, d.orig, dx, dy, lockX, lockY);
			dx += g.dx;
			dy += g.dy;
			d.guides = g.lines;
		}
		d.dx = dx;
		d.dy = dy;
		d.target = c.dropAnchor(p, [...d.orig.keys()]);
		const nodes: any[] = [],
			lines: any[] = [],
			slots: any[] = [];
		for (const [id, o] of d.orig as Map<string, any>) {
			const n = c.byId(id);
			const item = c.items?.find((i) => i.id === id),
				parent = c.items?.find((i) => i.id === item?.parent);
			const parentSelected = [...d.orig.keys()].some((other) => c.descendant(id, other));
			if (parent?.kind === 'Shape' && !parentSelected) {
				const p = c.byId(parent.id);
				slots.push({ id, slot: slotAt({ ...p, ...c.layout(p) }, { x: o.x + dx, y: o.y + dy }) });
				continue;
			}
			if (o.line) {
				lines.push({ id, start: [o.x + dx, o.y + dy], end: [o.line.end[0] + dx, o.line.end[1] + dy] });
				continue;
			}
			if (!n) continue;
			const previewNode: any = { id, x: d.copy ? o.x : o.x + dx, y: d.copy ? o.y : o.y + dy };

			nodes.push(previewNode);
		}
		return { preview: { nodes, lines, slots, place: true } };
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
		const roots = ids.filter((id) => !ids.some((parent) => c.descendant(id, parent)));
		const ops: Op[] = roots.map((id) => {
			const n = c.byId(id),
				item = c.items?.find((i) => i.id === id),
				parent = c.items?.find((i) => i.id === item?.parent);
			if (parent?.kind === 'Shape') return { op: 'slot', id, slot: item?.slot };
			return {
				op: 'move',
				id,
				x: n?.x ?? c.lines!.find((l) => l.id === id)!.start[0],
				y: n?.y ?? c.lines!.find((l) => l.id === id)!.start[1],
			};
		});
		let target = d.target;
		if (!e.mods.alt && d.orig.size === 1 && c.byId(ids[0])) {
			const id = ids[0],
				drop = c.labelDrop(e.p, c.byId(id));
			if (drop) {
				ops.push({ op: 'attachLabel', id, ...drop });
				target = null;
			}
		}
		if (target) {
			for (const id of ids) {
				if (
					!c.byId(id) ||
					(!e.mods.alt && c.items?.find((i) => i.id === c.items?.find((i) => i.id === id)?.parent)?.kind === 'Shape') ||
					c.items?.find((i) => i.id === id)?.parent === target.parent.id ||
					ids.some((parent) => c.descendant(id, parent))
				) {
					continue;
				}
				ops.push(
					{ op: 'reparent', id, newParent: target.parent.id },
					{ op: 'slot', id, slot: slotAt({ ...target.parent, ...c.layout(target.parent) }, e.p) },
				);
			}
		}
		return { commit: { op: 'batch', ops } };
	}
}
