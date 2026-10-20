// @ts-nocheck
import type { HitRef } from '../types';

// The renderer marks what it draws with data attributes; this reads them into a HitRef.
export function hitOf(t: any): HitRef {
	const d = t.dataset ?? {};
	const pair = (s: string) => s.split(':');
	if (d.corner !== undefined) {
		const [index, j] = pair(d.corner).map(Number);
		return { k: 'corner', index, j };
	}
	if (d.label) return { k: 'label', ref: JSON.parse(d.label) };
	if (t.classList?.contains('locked-node')) return { k: 'locked' };
	if (d.segment !== undefined) {
		const [index, j] = pair(d.segment).map(Number);
		return { k: 'segment', index, j };
	}
	if (d.endpoint) {
		const [index, end] = pair(d.endpoint);
		return { k: 'endpoint', index: +index, end: end as 'from' | 'to' };
	}
	if (d.mid !== undefined) return { k: 'mid', index: +d.mid };
	if (d.group) return { k: 'group', id: d.group };
	if (d.scale) return { k: 'scale', dir: d.scale };
	if (d.resize) {
		const [id, dir] = pair(d.resize);
		return { k: 'resize', id, dir };
	}
	if (d.handle) return { k: 'handle', id: d.handle };
	if (d.node) return { k: 'node', id: d.node };
	if (d.edge !== undefined) return { k: 'edge', index: +d.edge };
	return { k: 'none' };
}
