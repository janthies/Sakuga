import { slotAt, LINE_SLOTS } from '../../core/model/slots';
import type { CanvasEvent, ToolCtx, Tool, Step } from './types';

/** A slot drag changes one relation, committed as a single undoable operation. */
export class SlotTool implements Tool {
	readonly overlay: any;
	private slot: string;
	constructor(
		private c: ToolCtx,
		private id: string,
		private parent: string,
	) {
		const item = c.items?.find((i) => i.id === id);
		this.slot = item?.slot || 'centre';
		const p = c.items?.find((i) => i.id === parent),
			node = c.byId(parent);
		this.overlay = {
			slots: {
				parent: node ? { ...node, ...c.layout(node) } : p?.kind === 'Line' ? p.line : undefined,
				line: p?.kind === 'Line',
				slot: this.slot,
			},
		};
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const b = this.overlay.slots.parent;
		if (!b) return {};
		if (this.overlay.slots.line) {
			const dx = b.end[0] - b.start[0],
				dy = b.end[1] - b.start[1],
				len = dx * dx + dy * dy || 1;
			const t = ((e.p.x - b.start[0]) * dx + (e.p.y - b.start[1]) * dy) / len;
			const below = dx * (e.p.y - b.start[1]) - dy * (e.p.x - b.start[0]) < 0;
			this.slot = LINE_SLOTS[(below ? 3 : 0) + (t < 1 / 3 ? 0 : t > 2 / 3 ? 2 : 1)];
		} else this.slot = slotAt(b, e.p);
		this.overlay.slots.slot = this.slot;
		return { preview: { slots: [{ id: this.id, slot: this.slot }] } };
	}
	up(e: CanvasEvent): Step {
		if (e.mods.alt) {
			const target = this.c.dropAnchor(e.p, [this.id]);
			if (target && target.parent.id !== this.parent)
				return {
					commit: {
						op: 'batch',
						ops: [
							{ op: 'reparent', id: this.id, newParent: target.parent.id },
							{ op: 'slot', id: this.id, slot: slotAt({ ...target.parent, ...this.c.layout(target.parent) }, e.p) },
						],
					},
				};
			if (!target)
				return {
					commit: {
						op: 'batch',
						ops: [
							{ op: 'detach', id: this.id },
							{ op: 'move', id: this.id, x: e.p.x, y: e.p.y },
						],
					},
				};
		}
		return { commit: { op: 'slot', id: this.id, slot: this.slot } };
	}
}
