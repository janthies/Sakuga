import type { PreviewOp } from './types';

export interface PreviewModel {
	nodes: any[];
	edges: any[];
	groups: any[];
}

/** Show a preview on a model: the fields change in place, exactly as the gesture used to change the store. */
export function applyPreview(m: PreviewModel, p: PreviewOp): void {
	for (const { id, ...fields } of p.nodes ?? []) {
		const n = m.nodes.find((q) => q.id === id);
		if (n) Object.assign(n, fields);
	}
	for (const { index, fields } of p.arrows ?? []) {
		if (m.edges[index]) Object.assign(m.edges[index], fields);
	}
	if (p.label) {
		const { ref, style, titlePosition } = p.label;
		const g = ref.group && m.groups.find((q) => q.id === ref.group),
			e = ref.index === undefined ? null : m.edges[ref.index];
		if (g) {
			if (titlePosition) g.titlePosition = titlePosition;
			g.labelStyle = style;
		} else if (e) {
			if (ref.slot === undefined) e.labelStyle = style;
			else e.labels[ref.slot].style = style;
		}
	}
}
