import * as coreRoutes from '../../core/layout/route';
import { fixedUpdate } from './guides';
import { fine } from './util';
import type { CanvasEvent, Point, Step, Tool, ToolCtx } from './types';

// Drag one segment of an orthogonal arrow. Alt on the segment inserts a bump; the first and last segment slide the port.
export class SegmentTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		index: number,
		j: number,
		start: Point,
		alt: boolean,
	) {
		const pts = c.edgeGeom(c.edges[index]).pts.map((p: number[]) => p.slice());
		this.overlay = { segment: index, j, pts, start, alt };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const d = this.overlay,
			c = this.c,
			p = e.p;
		if (!d.changed && Math.hypot(p.x - d.start.x, p.y - d.start.y) < 0.4) return { render: false };
		const ed = c.edges[d.segment],
			j: number = d.j;
		let pts: number[][] = d.pts.map((q: number[]) => q.slice());
		const last = pts.length - 2,
			h = Math.abs(pts[j][1] - pts[j + 1][1]) < 0.001;
		if (d.alt) {
			const a = pts[j],
				b = pts[j + 1],
				axis = h ? 0 : 1,
				other = 1 - axis,
				cp = a.map((v, k) => v + (b[k] - v) / 3),
				dp = a.map((v, k) => v + (2 * (b[k] - v)) / 3),
				cc = cp.slice(),
				dd = dp.slice();
			cc[other] = dd[other] = h ? p.y : p.x;
			pts.splice(j + 1, 0, cp, cc, dd, dp);
		} else if (j === 0 || j === last) {
			const end = j === 0 ? 'from' : 'to',
				n = c.endpointObject(ed[end]),
				box = { ...n, ...(n.frame ? {} : c.layout(n)) },
				side =
					ed[end + 'Anchor'] ||
					(h
						? j === 0
							? pts[1][0] > pts[0][0]
								? 'east'
								: 'west'
							: pts[pts.length - 2][0] > pts[pts.length - 1][0]
								? 'east'
								: 'west'
						: j === 0
							? pts[1][1] > pts[0][1]
								? 'north'
								: 'south'
							: pts[pts.length - 2][1] > pts[pts.length - 1][1]
								? 'north'
								: 'south'),
				off = coreRoutes.snapPort(box, side, p, e.mods.alt).offset,
				point = coreRoutes.port(box, side, off),
				axis = h ? 1 : 0;
			if (pts.length === 2) {
				const tail = pts[1],
					mid = h ? (point[0] + tail[0]) / 2 : (point[1] + tail[1]) / 2;
				pts = h ? [point, [mid, point[1]], [mid, tail[1]], tail] : [point, [point[0], mid], [tail[0], mid], tail];
			} else {
				pts[j === 0 ? 0 : pts.length - 1] = point;
				pts[j === 0 ? 1 : pts.length - 2][axis] = point[axis];
			}
		} else {
			const axis = h ? 1 : 0;
			pts[j][axis] = pts[j + 1][axis] = fine(h ? p.y : p.x);
		}
		d.changed = true;
		return { preview: { arrows: [{ index: d.segment, fields: fixedUpdate(c, ed, pts) }] } };
	}
	up(): Step {
		const d = this.overlay,
			c = this.c;
		if (!d.changed) return {};
		const ed = c.edges[d.segment];
		return { commit: { op: 'arrow', index: d.segment, ...fixedUpdate(c, ed, c.edgeGeom(ed).pts) } };
	}
}

// Drag an end of an arrow onto another box, frame or port.
export class EndpointTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		e: CanvasEvent,
		index: number,
		end: 'from' | 'to',
	) {
		this.overlay = { endpoint: index, end, x: e.p.x, y: e.p.y };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		this.overlay.x = e.p.x;
		this.overlay.y = e.p.y;
		this.overlay.target = this.c.endpointTarget(e.p, e.mods.alt);
		return {};
	}
	up(e: CanvasEvent): Step {
		const d = this.overlay,
			target = this.c.endpointTarget(e.p, e.mods.alt);
		if (!target) return {};
		return {
			commit: {
				op: 'arrow',
				index: d.endpoint,
				[d.end]: target.id,
				[d.end + 'Anchor']: target.anchor,
				[d.end + 'Offset']: target.offset ?? 0,
			},
		};
	}
}

// The handle in the middle of an arrow: move the middle segment, bend the line or size a loop.
export class MidTool implements Tool {
	overlay: any;
	constructor(
		private c: ToolCtx,
		private i: number,
	) {
		const e = c.edges[i];
		this.overlay = { mid: i, orig: { route: e.route, mid: e.mid, bend: e.bend }, r: c.edgeGeom(e).r };
	}
	down(): Step {
		return {};
	}
	move(e: CanvasEvent): Step {
		const c = this.c,
			p = e.p,
			d = this.overlay;
		const ed = c.edges[this.i],
			a = c.endpointObject(ed.from),
			b = c.endpointObject(ed.to),
			t = d.r.type;
		const fields: Record<string, any> = {};
		if (ed.from === ed.to) {
			const side = ed.loopSide || 'north',
				h = /north|south/.test(side),
				sign = /north|east/.test(side) ? 1 : -1,
				n = { ...a, ...c.layout(a) },
				border = (h ? a.y : a.x) + (sign * (h ? n.h : n.w)) / 2;
			fields.loopSize = Math.max(1, Math.abs((h ? p.y : p.x) - border) / 0.75);
		} else if (t === 'hvh') {
			fields.route = 'hvh';
			fields.mid = c.snap(p.x);
		} else if (t === 'vhv') {
			fields.route = 'vhv';
			fields.mid = c.snap(p.y);
		} else {
			const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
			const nx = -(b.y - a.y) / len,
				ny = (b.x - a.x) / len;
			const off = (p.x - (a.x + b.x) / 2) * nx + (p.y - (a.y + b.y) / 2) * ny;
			const sn = Math.max(-0.95, Math.min(0.95, off / (0.294 * len)));
			fields.route = 'bend';
			fields.bend = Math.round((Math.asin(sn) * 180) / Math.PI);
		}
		d.changed = true;
		return { preview: { arrows: [{ index: this.i, fields }] } };
	}
	up(): Step {
		const d = this.overlay;
		if (!d.changed) return {};
		const e = this.c.edges[d.mid];
		return {
			commit: {
				op: 'arrow',
				index: d.mid,
				route: e.route,
				mid: e.mid,
				bend: e.bend,
				...(e.from === e.to ? { loopSize: e.loopSize } : {}),
			},
		};
	}
}
