import type { CanvasEvent, Selection, Step, Tool } from './types';

// Preserve a multi-selection while pressing; narrow it only after an actual click.
export class ClickTool implements Tool {
	readonly overlay: any;
	private dragged = false;
	constructor(
		private start: CanvasEvent,
		private selection: Selection,
		private gesture?: Tool,
	) {
		this.overlay = gesture?.overlay;
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		if (Math.hypot(e.screen.x - this.start.screen.x, e.screen.y - this.start.screen.y) > 3) this.dragged = true;
		return this.dragged ? (this.gesture?.move(e) ?? { render: false }) : { render: false };
	}
	up(e: CanvasEvent): Step {
		return this.dragged ? (this.gesture?.up(e) ?? {}) : { select: this.selection };
	}
}
