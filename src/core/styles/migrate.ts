// Legacy named styles are input only; box definitions remain the category adapter for the old panel.
import type { Figure } from '../model/figure';
import { nodes, edges, styleDefs } from '../model/queries';
import { mergeStyle } from './resolve';
export function migrateLooks(fig: Figure) {
	for (const d of styleDefs(fig)) {
		if (d.kind === 'box') continue;
		for (const n of nodes(fig).filter((n) => n.cat === d.key)) {
			n.style = mergeStyle(d.kind, d.props, n.style || {});
			n.cat = '';
		}
		for (const e of edges(fig).filter((e) => e.styleKey === d.key)) {
			e.style = mergeStyle(d.kind, d.props, e.style || {});
			delete e.styleKey;
		}
	}
	fig.lines = fig.lines.filter((l) => l.t !== 'style' || l.s.kind === 'box');
}
