// @ts-nocheck
import { geo } from '../store/geometry';
import { byId } from '../store/model';

export const half = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
// An arrow whose end box is hidden is not drawn, but the geometry (the serializer's) still exists.
export const hiddenEnd = (e) => !!(byId(e.from)?.hidden || byId(e.to)?.hidden);
// The path of an arrow from core; null when it is not drawn.
export function baseEdgeGeom(e) {
	return hiddenEnd(e) ? null : geo().base(e);
}
