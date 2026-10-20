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
		nodes: layers(fig)
			.flatMap((l) => nodes(fig).filter((n) => nodeLayer(fig, n).id === l.id))
			.map((n) => ({
				...n,
				layer: nodeLayer(fig, n).id,
				hidden: isHidden(fig, n),
				locked: isLocked(fig, n),
				overrides: overrideKeys(fig, n),
			})),
		edges: edges(fig).map((x) => ({ ...x, overrides: overrideKeys(fig, x) })),
		categories: categories(fig),
		styles: styleDefs(fig).map((s) => ({ ...s, line: styleLine(s) })),
		shared: sharedOverrides(fig),
		groups: groups(fig),
		layers: layers(fig),
		font: fontSize(fig),
		legend: legendOn(fig),
		arrows: arrowStyle(fig),
		palette: PALETTE,
		defaultWidth: DEFAULT_WIDTH,
	};
}
