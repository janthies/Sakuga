import { geo } from '../store/geometry';
import { byId } from '../store/model';
import type { ViewEdge } from '../store/types';

export const half = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
// An arrow whose end box is hidden is not drawn, but the geometry (the serializer's) still exists.
export const hiddenEnd = (e: ViewEdge) => !!(byId(e.from)?.hidden || byId(e.to)?.hidden);
// The path of an arrow from core; null when it is not drawn.
export function baseEdgeGeom(e: ViewEdge) {
	return hiddenEnd(e) ? null : geo().base(e);
}
