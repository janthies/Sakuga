import type { PreviewOp } from './types';

export interface PreviewModel {
	nodes: any[];
	items?: import('../../core/model/item').Item[];
	lines?: import('../../core/model/item').FigLine[];
	edges: any[];
	groups: any[];
}

/** Show a preview on a model: the fields change in place, exactly as the gesture used to change the store. */
export function applyPreview(m: PreviewModel, p: PreviewOp): void {
	for (const text of p.texts ?? []) {
		const item = m.items?.find((i) => i.id === text.id);
		if (item?.kind !== 'Text') continue;
		item.placement = text.placement;
		const line = m.lines?.find((l) => l.id === item.parent);
		if (line?.labels?.[item.order]) line.labels[item.order].style = text.placement;
	}
	for (const line of p.lines ?? []) {
		const target = m.lines?.find((l) => l.id === line.id);
		if (target) Object.assign(target, line);
	}
	for (const { id, ...fields } of p.nodes ?? []) {
		const n = m.nodes.find((q) => q.id === id);
		if (n) Object.assign(n, fields);
	}
	for (const { index, fields } of p.arrows ?? []) {
		if (m.edges[index]) Object.assign(m.edges[index], fields);
	}
	for (const label of [...(p.labels || []), ...(p.label ? [p.label] : [])]) {
		const { ref, style, titlePosition } = label;
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
