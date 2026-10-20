import { items, subtreeState } from '../model/tree-queries';
import { lineItems } from '../model/tree';
import { PALETTE } from '../model/colour';
import { DEFAULT_WIDTH } from '../model/constants';
import {
	arrowStyle,
	categories,
	edges,
	fontSize,
	groups,
	isHidden,
	isLocked,
	layers,
	legendOn,
	nodeLayer,
	nodes,
	styleDefs,
} from '../model/queries';
import { styleLine } from '../codec/style-line';
import { overrideKeys, sharedOverrides } from '../styles/resolve';
import { parse } from '../codec/parse';

// The derived snapshot the host sends to the webview (the 'state' message): pure, text in, plain data out.
export function viewModel(text: string) {
	const fig = parse(text);
	return {
		type: 'state' as const,
		text,
		items: items(fig),
		lines: lineItems(fig).map((l) => ({
			...l,
			hidden: subtreeState(fig, l.id, 'hidden'),
			locked: subtreeState(fig, l.id, 'locked'),
		})),
		nodes: layers(fig)
			.flatMap((l) => nodes(fig).filter((n) => nodeLayer(fig, n).id === l.id))
			.map((n) => ({
				...n,
				layer: nodeLayer(fig, n).id,
				hidden: isHidden(fig, n),
				locked: isLocked(fig, n),
				overrides: overrideKeys(fig, n),
			})),
		edges: edges(fig).map((x) => ({
			...x,
			hidden: subtreeState(fig, x.id!, 'hidden') || [x.from, x.to].some((id) => subtreeState(fig, id, 'hidden')),
			locked: subtreeState(fig, x.id!, 'locked'),
			overrides: overrideKeys(fig, x),
		})),
		categories: categories(fig),
		styles: styleDefs(fig).map((s) => ({ ...s, line: styleLine(s) })),
		shared: sharedOverrides(fig),
		groups: groups(fig).map((g) => ({
			...g,
			hidden: subtreeState(fig, g.id, 'hidden'),
			locked: subtreeState(fig, g.id, 'locked'),
		})),
		layers: layers(fig),
		font: fontSize(fig),
		legend: legendOn(fig),
		arrows: arrowStyle(fig),
		palette: PALETTE,
		defaultWidth: DEFAULT_WIDTH,
	};
}
