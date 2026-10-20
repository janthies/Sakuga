import { hiddenEnd } from './geometry';
import type { ViewEdge } from '../store/types';
import { geo } from '../store/geometry';

// The path of an arrow as drawn, with its label position; null when its ends are hidden.
export function edgeGeom(e: ViewEdge) {
	return hiddenEnd(e) ? null : geo().edge(e);
}
