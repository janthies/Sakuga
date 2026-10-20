import type { CanvasEvent, Step, Tool, ToolCtx } from './types';

// Line labels move by an offset from their line; their parent remains unchanged.
export class InlineTextTool implements Tool {
	private original: any;
	private placement: any;
	constructor(
		private c: ToolCtx,
		private start: CanvasEvent,
		private id: string,
	) {
		const item = c.items?.find((i) => i.id === id);
		this.original = item?.kind === 'Text' ? { ...item.placement } : {};
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		this.placement = {
			...this.original,
			dx: (this.original.dx || 0) + e.p.x - this.start.p.x,
			dy: (this.original.dy || 0) + e.p.y - this.start.p.y,
		};
		return { preview: { texts: [{ id: this.id, placement: this.placement }] } };
	}
	up(): Step {
		return this.placement ? { commit: { op: 'text', id: this.id, placement: this.placement } } : {};
	}
}
