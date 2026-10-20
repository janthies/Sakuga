// @ts-nocheck
import { hiddenEnd } from './geometry';
import { geo } from '../store/geometry';

// The path of an arrow as drawn, with its label position; null when its ends are hidden.
export function edgeGeom(e) {
	return hiddenEnd(e) ? null : geo().edge(e);
}
