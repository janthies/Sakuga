import { slotAt } from '../../core/model/slots';
import type { CanvasEvent, Selection, Step, Tool, ToolCtx, Op } from './types';

/** Alt-drag changes the parent relation for the selected roots in one undo step. */
export class ReparentTool implements Tool {
	readonly overlay: any = {};
	private ids: string[];
	private origins = new Map<string, { x: number; y: number }>();
	private target: { id: string; kind: string; x: number; y: number; w: number; h: number } | undefined;
	constructor(
		private c: ToolCtx,
		private start: CanvasEvent,
		selection: Selection,
	) {
		const selected = new Set([
			...selection.nodes,
			...(selection.group ? [selection.group] : []),
			...[...selection.edges].map((i) => c.edges[i]?.id).filter(Boolean),
		]);
		this.ids = [...selected].filter(
			(id) =>
				c.items?.find((i) => i.id === id)?.kind !== 'Connector' &&
				![...selected].some((p) => p !== id && c.descendant(id, p)),
		);
		for (const id of this.ids) {
			const n = c.byId(id),
				item = c.items?.find((i) => i.id === id);
			const rect = c.itemRect?.(id);
			const point = n || rect || (item?.kind === 'Line' ? { x: item.line.start[0], y: item.line.start[1] } : start.p);
			this.origins.set(id, { x: point.x, y: point.y });
		}
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const candidates = (this.c.items || []).filter(
			(i) =>
				['Shape', 'Frame'].includes(i.kind) &&
				!i.hidden &&
				!i.locked &&
				!this.ids.includes(i.id) &&
				!this.ids.some((id) => this.c.descendant(i.id, id)),
		);
		this.target = candidates
			.map((i) => {
				const n = this.c.byId(i.id),
					b = n ? { ...n, ...this.c.layout(n) } : this.c.itemRect?.(i.id);
				return b ? { id: i.id, kind: i.kind, x: b.x, y: b.y, w: b.w, h: b.h } : undefined;
			})
			.filter(
				(b): b is NonNullable<typeof b> =>
					!!b && Math.abs(e.p.x - b.x) <= b.w / 2 + 3 && Math.abs(e.p.y - b.y) <= b.h / 2 + 3,
			)
			.sort((a, b) => a.w * a.h - b.w * b.h)[0];
		const b = this.target;
		this.overlay.slots = b?.kind === 'Shape' ? { parent: b, slot: slotAt(b, e.p) } : undefined;
		this.overlay.parentTarget = b;
		this.overlay.reparentGhosts = this.ids
			.map((id) => {
				const n = this.c.byId(id),
					rect = n ? { ...n, ...this.c.layout(n) } : this.c.itemRect?.(id);
				return rect && { ...rect, x: rect.x + e.p.x - this.start.p.x, y: rect.y + e.p.y - this.start.p.y };
			})
			.filter(Boolean);
		return {};
	}
	up(e: CanvasEvent): Step {
		this.move(e);
		if (Math.hypot(e.p.x - this.start.p.x, e.p.y - this.start.p.y) < 0.1) return {};
		const ops: Op[] = [];
		for (const id of this.ids) {
			if (this.target) {
				ops.push({ op: 'reparent', id, newParent: this.target.id });
				if (this.target.kind === 'Shape') ops.push({ op: 'slot', id, slot: slotAt(this.target, e.p) });
				else {
					const origin = this.origins.get(id)!;
					ops.push({ op: 'move', id, x: origin.x + e.p.x - this.start.p.x, y: origin.y + e.p.y - this.start.p.y });
				}
			} else {
				const item = this.c.items?.find((i) => i.id === id);
				if (this.c.items?.some((i) => i.id === item?.parent)) ops.push({ op: 'detach', id });
				const origin = this.origins.get(id)!;
				ops.push({ op: 'move', id, x: origin.x + e.p.x - this.start.p.x, y: origin.y + e.p.y - this.start.p.y });
			}
		}
		return { commit: { op: 'batch', ops } };
	}
}
