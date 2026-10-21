import type { Point } from '../model/node';
/** Convert a fraction of the whole polyline into the native segment's fraction. */
export function pathPosition(points: Point[], position = 0.5): { segment: number; pos: number } {
	const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
	let distance = Math.max(0, Math.min(1, position)) * lengths.reduce((a, b) => a + b, 0);
	for (let segment = 0; segment < lengths.length; segment++) {
		const length = lengths[segment];
		if (distance <= length || segment === lengths.length - 1) return { segment, pos: length ? distance / length : 0 };
		distance -= length;
	}
	return { segment: 0, pos: 0.5 };
}
