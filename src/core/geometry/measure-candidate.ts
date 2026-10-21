import type { FigNode, Group, Figure } from '../model/figure';
import { syncTree } from '../model/tree';
import { layoutSlots, slotRect } from './slot-layout';
/** Measure an arrange/tidy candidate with its real children using the same slot layout. */
export function measureCandidate(nodes: FigNode[], groups: Group[], candidate: FigNode, font: string, gap = 1) {
	const copies = nodes.map((n) => ({ ...n, ...(n.id === candidate.id ? candidate : {}), derivedRect: undefined }));
	const fig: Figure = {
		theme: {
			fontSize: font,
			kinds: {
				Shape: { outerGap: gap, innerPadding: (nodes.find((n) => !n.kind)?.style as any)?.innerPadding ?? 1.2 },
			},
		},
		lines: [
			...copies.map((n) => ({ t: 'node' as const, n })),
			...groups.map((g) => ({ t: 'group' as const, g: { ...g } })),
			...[...new Set(nodes.map((n) => n.layer || 'layer1'))].map((id) => ({
				t: 'layer' as const,
				layer: { id, name: id, hidden: false, locked: false },
			})),
		],
	};
	syncTree(fig);
	layoutSlots(fig);
	return slotRect(copies.find((n) => n.id === candidate.id)!);
}
