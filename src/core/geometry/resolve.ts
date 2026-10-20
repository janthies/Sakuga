// The shape an arrow between two plain boxes gets.
import { boxHalf } from './boxes';
import { FigEdge, FigNode } from '../model/figure';

// The shape an arrow gets. Manhattan: a straight vertical or horizontal line where the boxes face
// each other, otherwise one jog in the middle.
export function resolveRoute(
	e: FigEdge,
	a: FigNode,
	b: FigNode,
	style: string,
	half: (n: any) => [number, number] = boxHalf,
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
	const [aw, ah] = half(a),
		[bw, bh] = half(b);
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
