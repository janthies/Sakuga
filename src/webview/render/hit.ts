// A HitRef is written on the element as data-* attributes (as before) and read back from an event target.
import type { HitRef } from '../../core/scene';

export function hitAttrs(h: HitRef | undefined): Record<string, string> {
	if (!h) return {};
	switch (h.k) {
		case 'node':
			return { 'data-node': h.id };
		case 'edge':
			return { 'data-edge': String(h.index) };
		case 'mid':
			return { 'data-mid': String(h.index) };
		case 'segment':
			return { 'data-segment': `${h.index}:${h.j}` };
		case 'corner':
			return { 'data-corner': `${h.index}:${h.j}` };
		case 'endpoint':
			return { 'data-endpoint': `${h.index}:${h.end}` };
		case 'group':
			return { 'data-group': h.id };
		case 'label':
			return { 'data-label': JSON.stringify(h.ref) };
		case 'scale':
			return { 'data-scale': h.dir };
		case 'resize':
			return { 'data-resize': `${h.id}:${h.dir}` };
		case 'handle':
			return { 'data-handle': h.id };
		case 'locked':
			return {}; // marked by its class
	}
}

// What an event target is, or null when it is nothing the tools care about (the background).
export function hitOf(target: EventTarget | null): HitRef | null {
	const t = target as (Element & { dataset?: DOMStringMap }) | null;
	if (!t || !t.dataset) return null;
	const d = t.dataset;
	const pair = (v: string) => {
		const i = v.lastIndexOf(':');
		return [v.slice(0, i), v.slice(i + 1)] as const;
	};
	if (d.label) return { k: 'label', ref: JSON.parse(d.label) };
	if (t.classList.contains('locked-node')) return { k: 'locked' };
	if (d.segment !== undefined) {
		const [a, b] = pair(d.segment);
		return { k: 'segment', index: +a, j: +b };
	}
	if (d.corner !== undefined) {
		const [a, b] = pair(d.corner);
		return { k: 'corner', index: +a, j: +b };
	}
	if (d.endpoint) {
		const [a, b] = pair(d.endpoint);
		return { k: 'endpoint', index: +a, end: b };
	}
	if (d.mid !== undefined) return { k: 'mid', index: +d.mid };
	if (d.group) return { k: 'group', id: d.group };
	if (d.scale) return { k: 'scale', dir: d.scale };
	if (d.resize) {
		const [a, b] = pair(d.resize);
		return { k: 'resize', id: a, dir: b };
	}
	if (d.handle) return { k: 'handle', id: d.handle };
	if (d.node) return { k: 'node', id: d.node };
	if (d.edge !== undefined) return { k: 'edge', index: +d.edge };
	return null;
}
