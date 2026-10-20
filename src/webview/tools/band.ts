import { edgeInside, nodeInside } from './guides';
import type { CanvasEvent, Step, Tool, ToolCtx } from './types';

// Drag on empty space: select what the rectangle encloses, added to what was selected before.
export class BandTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		e: CanvasEvent,
		baseN: Set<string>,
		baseE: Set<number>,
	) {
		this.overlay = { band: true, x0: e.p.x, y0: e.p.y, x1: e.p.x, y1: e.p.y, baseN, baseE };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const d = this.overlay,
			c = this.c;
		d.x1 = e.p.x;
		d.y1 = e.p.y;
		const x0 = Math.min(d.x0, d.x1),
			x1 = Math.max(d.x0, d.x1);
		const y0 = Math.min(d.y0, d.y1),
			y1 = Math.max(d.y0, d.y1);
		const nodes = new Set<string>([
			...d.baseN,
			...(c.items ?? [])
				.filter((i) => {
					const r = c.itemRect?.(i.id);
					return (
						!i.hidden &&
						!i.locked &&
						r &&
						r.x - r.w / 2 >= x0 &&
						r.x + r.w / 2 <= x1 &&
						r.y - r.h / 2 >= y0 &&
						r.y + r.h / 2 <= y1
					);
				})
				.map((i) => i.id),
			...c.nodes.filter((n) => nodeInside(c, n, x0, x1, y0, y1)).map((n) => n.id),
			...(c.lines ?? [])
				.filter(
					(l) => !l.hidden && !l.locked && [l.start, l.end].every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1),
				)
				.map((l) => l.id),
		]);
		const edges = new Set<number>([
			...d.baseE,
			...c.edges.map((ed, i) => (edgeInside(c, nodes, ed, x0, x1, y0, y1) ? i : -1)).filter((i) => i >= 0),
		]);
		return { select: { ...c.sel(), nodes, edges } };
	}
	up(): Step {
		return {};
	}
}
