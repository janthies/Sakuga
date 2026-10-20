// The shape an arrow gets, and the objects and geometry the serializer hands to the router.
import * as routing from './route';
import { boxHalf, nodeIcon } from './boxes';
import { FigEdge, FigNode, Figure } from '../model/figure';
import { arrowStyle, edges, fontSize, groups, isHidden, nodes } from '../model/queries';

// The shape an arrow gets. Manhattan: a straight vertical or horizontal line where the boxes face
// each other, otherwise one jog in the middle.
export function resolveRoute(
	e: FigEdge,
	a: FigNode,
	b: FigNode,
	style: string,
): { type: string; mid?: number | null; at?: string; bend?: number } {
	let route = e.route === 'auto' ? style : e.route;
	if (route === 'straight') {
		return { type: 'line' };
	}
	if (route === 'curved') {
		return { type: 'bend', bend: 20 };
	}
	if (route === 'hvh' || route === 'vhv') {
		return { type: route, mid: e.mid };
	}
	if (route === 'bend') {
		return { type: 'bend', bend: e.bend };
	}
	const [aw, ah] = boxHalf(a),
		[bw, bh] = boxHalf(b);
	const dx = b.x - a.x,
		dy = b.y - a.y;
	const xOverlap = Math.abs(dx) < aw + bw - 1,
		yOverlap = Math.abs(dy) < ah + bh - 1;
	if (xOverlap && !yOverlap) {
		if (Math.abs(dx) < 0.05) {
			return { type: 'line' };
		}
		if (Math.abs(dx) <= aw - 1) {
			return { type: 'vert', at: 'b' };
		}
		if (Math.abs(dx) <= bw - 1) {
			return { type: 'vert', at: 'a' };
		}
		return { type: 'vhv', mid: Math.round(((a.y + b.y) / 2) * 10) / 10 };
	}
	if (yOverlap && !xOverlap) {
		if (Math.abs(dy) < 0.05) {
			return { type: 'line' };
		}
		if (Math.abs(dy) <= ah - 1) {
			return { type: 'horz', at: 'b' };
		}
		if (Math.abs(dy) <= bh - 1) {
			return { type: 'horz', at: 'a' };
		}
		return { type: 'hvh', mid: Math.round(((a.x + b.x) / 2) * 10) / 10 };
	}
	if (Math.abs(dy) >= Math.abs(dx)) {
		return { type: 'vhv', mid: Math.round(((a.y + b.y) / 2) * 10) / 10 };
	}
	return { type: 'hvh', mid: Math.round(((a.x + b.x) / 2) * 10) / 10 };
}

export function routeObjects(fig: Figure): any[] {
	const ns = nodes(fig).map((n) => {
		const [w, h] = boxHalf({
			...n,
			icon: nodeIcon(fig, n),
			style: { ...n.style, font: n.style?.font || fontSize(fig) },
		});
		return { ...n, w: w * 2, h: h * 2, hidden: isHidden(fig, n) };
	});
	return [
		...ns,
		...groups(fig)
			.filter((g) => g.frame !== 'none' || edges(fig).some((e) => e.from === g.id || e.to === g.id))
			.map((g) => routing.bounds(g.id, ns, groups(fig), new Set(), edges(fig)))
			.filter(Boolean),
	];
}

export function specialGeometry(fig: Figure, e: FigEdge): any {
	if (
		!['auto', 'manhattan', 'fixed', 'loop'].includes(e.route) &&
		e.from !== e.to &&
		!e.labelStyle &&
		!e.labels?.length &&
		!e.fromAnchor &&
		!e.toAnchor &&
		!groups(fig).some((g) => g.id === e.from || g.id === e.to) &&
		!routing.lane(e, edges(fig)) &&
		e.route !== 'u'
	)
		return null;
	const objects = routeObjects(fig);
	const a = objects.find((n) => n.id === e.from),
		b = objects.find((n) => n.id === e.to);
	if (
		!['auto', 'manhattan', 'fixed', 'loop'].includes(e.route) &&
		e.from !== e.to &&
		!e.fromAnchor &&
		!e.toAnchor &&
		!a?.frame &&
		!b?.frame &&
		!routing.lane(e, edges(fig)) &&
		e.route !== 'u'
	)
		return routing.legacyGeometry(e, a, b, arrowStyle(fig));
	const prior = edges(fig)
		.slice(0, edges(fig).indexOf(e))
		.map((o) => {
			const x = objects.find((n) => n.id === o.from),
				y = objects.find((n) => n.id === o.to);
			return x && y ? routing.geometry(o, x, y, edges(fig), arrowStyle(fig), objects)?.pts : null;
		})
		.filter(Boolean);
	return routing.geometry(e, a, b, edges(fig), arrowStyle(fig), objects, prior);
}
