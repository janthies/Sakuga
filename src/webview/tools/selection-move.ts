import { SlotTool } from './slot';
import { MoveTool } from './move';
import { LabelTool } from './label';
import { InlineTextTool } from './inline-text';
import { movable, origins } from './util';
import type { CanvasEvent, Selection, Step, Tool, ToolCtx } from './types';

// One gesture for a mixed selection. Inline labels have offsets rather than node coordinates.
export class SelectionMoveTool implements Tool {
	readonly overlay: any;
	private tools: Tool[] = [];
	constructor(c: ToolCtx, e: CanvasEvent, selection: Selection) {
		const ids = movable(c, selection.nodes);
		if (selection.nodes.size === 1) {
			const id = [...selection.nodes][0],
				item = c.items?.find((i) => i.id === id),
				parent = c.items?.find((i) => i.id === item?.parent);
			if (parent?.kind === 'Shape' || parent?.kind === 'Line') {
				const tool = new SlotTool(c, id, parent.id);
				this.tools = [tool];
				this.overlay = tool.overlay;
				return;
			}
		}
		if (ids.length) {
			const move = new MoveTool(c, e, origins(c, ids));
			this.tools.push(move);
			this.overlay = move.overlay;
		} else this.overlay = {};
		for (const id of selection.nodes) {
			const item = c.items?.find((i) => i.id === id);
			if (item?.kind !== 'Text' || item.node) continue;
			const parent = c.items?.find((i) => i.id === item.parent);
			if (
				selection.nodes.has(item.parent) ||
				selection.group === item.parent ||
				(parent?.kind === 'Connector' && selection.edges.has(c.edges.findIndex((ed) => ed.id === parent.id)))
			)
				continue;
			if (parent?.kind === 'Connector')
				this.tools.push(
					new LabelTool(c, e, {
						index: c.edges.findIndex((ed) => ed.id === parent.id),
						...(item.order > 0 ? { slot: item.order - 1 } : {}),
					}),
				);
			else if (parent?.kind === 'Line') this.tools.push(new InlineTextTool(c, e, id));
		}
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const preview: NonNullable<Step['preview']> = {};
		for (const tool of this.tools) {
			const p = tool.move(e).preview;
			if (!p) continue;
			if (p.slots) preview.slots = [...(preview.slots || []), ...p.slots];
			if (p.nodes) preview.nodes = [...(preview.nodes || []), ...p.nodes];
			if (p.lines) preview.lines = [...(preview.lines || []), ...p.lines];
			if (p.texts) preview.texts = [...(preview.texts || []), ...p.texts];
			if (p.label) preview.labels = [...(preview.labels || []), p.label];
			if (p.place) preview.place = true;
		}
		return { preview };
	}
	up(e: CanvasEvent): Step {
		const steps = this.tools.map((tool) => tool.up(e)),
			ops = steps.flatMap((s) => (s.commit ? [s.commit] : []));
		if (steps.length === 1) return steps[0];
		return ops.length ? { commit: { op: 'batch', ops } } : {};
	}
}
