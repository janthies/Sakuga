import {
	fontSize,
	arrowStyle,
	categories,
	overrideKeys,
	sharedOverrides,
	styleDefs,
	styleLine,
	DEFAULT_WIDTH,
	edges,
	groups,
	layers,
	isHidden,
	isLocked,
	nodeLayer,
	legendOn,
	nodes,
	PALETTE,
	parse,
} from './tikz';

// The derived snapshot the host sends to the webview (the 'state' message), moved out of extension.ts unchanged so tests can reach it.
export function statePayload(text: string) {
	const fig = parse(text);
	return {
		type: 'state',
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
