// Queries on a figure: its objects, layers, styles, font and opacity.
import { exportTarget } from './export';
import { itemById, layerOf, subtreeState, descendants, orderedSiblings } from './tree-queries';
import { Category, FigEdge, FigNode, Figure, Layer, StyleKind } from './figure';

export const fontSize = (fig: Figure) =>
	fig.export?.font ||
	fig.theme?.fontSize ||
	fig.lines.flatMap((l) => (l.t === 'raw' && /^% sakuga font /.test(l.text) ? [l.text.slice(14)] : []))[0] ||
	exportTarget(fig).font;

export const smallerFont = (size: string) =>
	({ scriptsize: 'tiny', footnotesize: 'scriptsize', small: 'footnotesize', normalsize: 'small', large: 'normalsize' })[
		size
	] || 'footnotesize';

// Opacity on the command is the rendered product. sg opacity retains the editable
// object value when a layer contributes, so repeated saves never multiply twice.
export const opacity = (value: number | undefined) =>
	value === undefined || !Number.isFinite(value) ? 1 : Math.max(0, Math.min(1, value));

export const nodeOpacity = (fig: Figure, n: FigNode) => opacity(n.style?.opacity) * opacity(nodeLayer(fig, n).opacity);

export const edgeLayerOpacity = (fig: Figure, e: FigEdge) => {
	const source = nodes(fig).find((n) => n.id === e.from);
	return source ? opacity(nodeLayer(fig, source).opacity) : 1;
};

export const styleDefs = (fig: Figure) => fig.lines.flatMap((l) => (l.t === 'style' ? [l.s] : []));

export const findStyle = (fig: Figure, key: string | undefined, kind?: StyleKind) =>
	key ? styleDefs(fig).find((s) => s.key === key && (!kind || s.kind === kind)) : undefined;

// Semantic categories use exactly one marker and independent surface settings.
export const categories = (fig: Figure): Category[] =>
	styleDefs(fig)
		.filter((s) => s.kind === 'box')
		.map((s) => ({
			key: s.key,
			fill: s.fill,
			outlineColor: s.outlineColor,
			outline: s.outline,
			name: s.name,
			...(s.icon ? { icon: s.icon } : { color: s.color || s.props.fill || 'white' }),
			legend: !!s.legend,
		}));

export const nodeStyleKind = (n: FigNode): StyleKind | null =>
	n.kind === 'icon' ? null : n.kind === 'label' ? 'label' : 'box';

export const nodes = (fig: Figure) => orderedSiblings(fig.lines.flatMap((l) => (l.t === 'node' ? [l.n] : [])));

export const edges = (fig: Figure) => fig.lines.flatMap((l) => (l.t === 'edge' ? [l.e] : []));

export const groups = (fig: Figure) => orderedSiblings(fig.lines.flatMap((l) => (l.t === 'group' ? [l.g] : [])));

export const layers = (fig: Figure): Layer[] => {
	const ls = fig.lines.flatMap((l) => (l.t === 'layer' ? [l.layer] : []));
	return ls.length ? ls : [{ id: 'layer1', name: 'Layer 1', hidden: false, locked: false }];
};

export const nodeLayer = (fig: Figure, n: FigNode) =>
	layers(fig).find((l) => l.id === (itemById(fig, n.id) ? layerOf(fig, n.id) : n.layer)) ?? layers(fig)[0];

export const isHidden = (fig: Figure, n: FigNode) =>
	itemById(fig, n.id) ? subtreeState(fig, n.id, 'hidden') : n.hidden || nodeLayer(fig, n).hidden;

export const isLocked = (fig: Figure, n: FigNode) =>
	itemById(fig, n.id) ? subtreeState(fig, n.id, 'locked') : n.locked || nodeLayer(fig, n).locked;

export function groupMembers(fig: Figure, id: string): FigNode[] {
	if (fig.items) {
		const ids = new Set(descendants(fig, id).map((i) => i.id));
		return nodes(fig).filter((n) => ids.has(n.id));
	}
	return nodes(fig).filter((n) => {
		let parent = n.group;
		const seen = new Set<string>();
		while (parent && !seen.has(parent)) {
			if (parent === id) {
				return true;
			}
			seen.add(parent);
			parent = groups(fig).find((g) => g.id === parent)?.parent ?? '';
		}
		return false;
	});
}

export const legendOn = (fig: Figure) => categories(fig).some((c) => c.legend);

export const arrowStyle = (fig: Figure) => {
	const f = fig.lines.find((l) => l.t === 'arrowsflag');
	return f && f.t === 'arrowsflag' ? f.style : 'manhattan';
};
