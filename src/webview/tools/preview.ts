import { releaseGroup } from '../../core/geometry/slot-groups';
import { payload } from '../../core/model/tree';
import { layoutSlots, slotRect } from '../../core/geometry/slot-layout';
import type { Figure } from '../../core/model/figure';
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
	for (const i of m.items || []) {
		if ('node' in i) {
			const n = m.nodes.find((n) => n.id === i.id);
			if (n) i.node = n;
		}
		if (i.kind === 'Frame') {
			const g = m.groups.find((g) => g.id === i.id);
			if (g) i.frame = g;
		}
		if (i.kind === 'Line') {
			const l = m.lines?.find((l) => l.id === i.id);
			if (l) i.line = l;
		}
	}
	for (const v of p.slots || []) {
		const i = m.items?.find((i) => i.id === v.id),
			n = m.nodes.find((n) => n.id === v.id);
		if (i?.kind === 'Frame') releaseGroup({ items: m.items, lines: [] }, i.id);
		if (i) {
			i.slot = v.slot as any;
			payload(i).slot = i.slot;
		}
		if (n) n.slot = v.slot;
		if (i?.kind === 'Text' && !i.node) {
			const l = m.lines?.find((l) => l.id === i.parent),
				[at, side] = v.slot.split('-');
			const st = { ...i.placement, pos: at === 'start' ? 0 : at === 'end' ? 1 : 0.5, side };
			i.placement = st;
			if (l?.labels?.[i.order]) l.labels[i.order].style = st;
		}
	}
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
	if (p.slots?.length || p.place) {
		const shape = m.nodes.find((n) => !n.kind);
		const fig = {
			theme: {
				fontSize: shape?.style?.font,
				kinds: { Shape: { innerPadding: shape?.style?.innerPadding ?? 1.2, outerGap: shape?.style?.outerGap ?? 1 } },
			},
			items: m.items,
			lines: [
				...m.nodes.map((n) => ({ t: 'node', n })),
				...m.groups.map((g) => ({ t: 'group', g })),
				...(m.lines || []).map((line) => ({ t: 'line', line })),
			],
		} as Figure;
		layoutSlots(fig);
	}
}
