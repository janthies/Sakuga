import type { CanvasEvent, Step, Tool, ToolCtx } from './types';

// Drag the dot of a box: onto another box or an edge port for an arrow, onto empty space for a new connected box.
export class ConnectTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		e: CanvasEvent,
		id: string,
	) {
		const n = c.byId(id),
			d = [e.p.x - n.x, e.p.y - n.y];
		const startAnchor = Math.abs(d[0]) > Math.abs(d[1]) ? (d[0] > 0 ? 'east' : 'west') : d[1] > 0 ? 'north' : 'south';
		this.overlay = { connect: id, x: e.p.x, y: e.p.y, startX: e.p.x, startY: e.p.y, startAnchor };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		this.overlay.x = e.p.x;
		this.overlay.y = e.p.y;
		return {};
	}
	up(e: CanvasEvent): Step {
		const d = this.overlay,
			c = this.c;
		const from = c.byId(d.connect);
		const endpoint = c.endpointTarget(e.p);
		if (endpoint && endpoint.id === from.id) {
			return { commit: { op: 'addEdge', from: from.id, to: from.id, route: 'loop', loopSide: endpoint.anchor } };
		}
		if (endpoint) {
			const start = c.endpointTarget({ x: d.startX ?? from.x, y: d.startY ?? from.y });
			return {
				commit: {
					op: 'addEdge',
					from: from.id,
					to: endpoint.id,
					fromAnchor: d.startAnchor || start?.anchor,
					toAnchor: endpoint.anchor,
					fromOffset: start?.offset ?? 0,
					toOffset: endpoint.offset ?? 0,
				},
			};
		}
		const target = c.nodeAt(e.p);
		if (target && target.kind !== 'icon' && target.id !== from.id) {
			return { commit: { op: 'addEdge', from: from.id, to: target.id } };
		}
		if (!target) {
			const id = c.newId();
			return {
				pendingEdit: id,
				commit: {
					op: 'addNode',
					id,
					x: c.snap(d.x),
					y: c.snap(d.y),
					title: 'Box',
					cat: from.cat,
					width: from.width,
					from: from.id,
				},
			};
		}
		return {};
	}
}
