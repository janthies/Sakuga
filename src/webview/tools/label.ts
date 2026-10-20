import { fine } from './util';
import type { CanvasEvent, LabelRef, Step, Tool, ToolCtx } from './types';

const TITLE_POSITIONS = ['above-left', 'above-center', 'inside-top-left', 'inside-top-right', 'below-left'];

// Drag an arrow label along its arrow, or a frame title around its frame.
export class LabelTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		e: CanvasEvent,
		ref: LabelRef,
	) {
		const target = c.labelTarget(ref);
		const geom = target.g
			? c.frameTitleGeom(target.g)
			: c.arrowLabelGeom(target.e, target.style, target.text, target.step);
		this.overlay = { label: ref, orig: { ...target.style }, start: e.p, point: geom.p };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const d = this.overlay,
			c = this.c,
			ref: LabelRef = d.label;
		const target = c.labelTarget(ref),
			p2 = { x: d.point[0] + e.p.x - d.start.x, y: d.point[1] + e.p.y - d.start.y };
		let st: any, titlePosition: string | undefined;
		if (target.g) {
			const base = c.frameTitleGeom({ ...target.g, labelStyle: {} });
			st = { ...d.orig, dx: fine(p2.x - base.p[0]), dy: fine(p2.y - base.p[1]) };
			for (const pos of TITLE_POSITIONS) {
				const q = c.frameTitleGeom({ ...target.g, titlePosition: pos, labelStyle: {} });
				if (Math.hypot(p2.x - q.p[0], p2.y - q.p[1]) < 2) {
					titlePosition = pos;
					st.dx = 0;
					st.dy = 0;
					break;
				}
			}
		} else st = { ...d.orig, ...c.projectLabel(target.e, p2, target.text, target.step) };
		d.changed = true;
		return { preview: { label: { ref, style: st, titlePosition } } };
	}
	up(): Step {
		const d = this.overlay;
		if (!d.changed) return {};
		const target = this.c.labelTarget(d.label);
		return {
			commit: target.g
				? {
						op: 'batch',
						ops: [
							{ op: 'label', ...d.label, style: target.style },
							{ op: 'groupProps', id: target.g.id, titlePosition: target.g.titlePosition },
						],
					}
				: { op: 'label', ...d.label, style: target.style },
		};
	}
}
