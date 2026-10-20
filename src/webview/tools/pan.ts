import type { CanvasEvent, Step, Tool, ToolCtx } from './types';

// Space+drag or the middle button: move the view.
export class PanTool implements Tool {
	overlay: any;
	constructor(c: ToolCtx, e: CanvasEvent) {
		const v = c.view();
		this.overlay = { pan: true, sx: e.screen.x, sy: e.screen.y, ox: v.ox, oy: v.oy };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const d = this.overlay;
		return { view: { ox: d.ox + e.screen.x - d.sx, oy: d.oy + e.screen.y - d.sy } };
	}
	up(): Step {
		return {};
	}
}
