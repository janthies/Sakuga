import { byId, groupById } from '../../store/model';
import { labelTarget } from '../../render/labelgeom';
import { show } from '../../store/constants';
import { store } from '../../store/store';
import type { Group, Layer, ViewEdge, ViewNode } from '../../store/types';

export type LabelTarget = NonNullable<ReturnType<typeof labelTarget>>;

// What the inspector is showing, decided from the store's selection. The first match wins, in this order.
export type Mode = 'none' | 'box' | 'label' | 'icon' | 'arrow' | 'frame' | 'attached' | 'layer' | 'multi';

export interface Selection {
	mode: Mode;
	nodes: ViewNode[];
	edges: { e: ViewEdge; i: number }[];
	group?: Group;
	layers: Layer[];
	attached: LabelTarget | null;
	// Boxes, arrows and the like in the selection.
	count: number;
	// The one selected node or arrow, when exactly one object is selected.
	node?: ViewNode;
	edge?: { e: ViewEdge; i: number };
}

export function currentSelection(): Selection {
	const nodes = [...store.selN].map(byId).filter((n): n is ViewNode => !!n);
	const edges = [...store.selE].flatMap((i) => (store.edges[i] ? [{ e: store.edges[i], i }] : []));
	const count = store.selN.size + store.selE.size;
	const node = count === 1 && nodes.length === 1 ? nodes[0] : undefined;
	const edge = count === 1 && edges.length === 1 ? edges[0] : undefined;
	const group = groupById(store.selG);
	const layers = store.selectedLayers.size ? store.layers.filter((l) => store.selectedLayers.has(l.id)) : [];
	const attached = store.selN.label ? labelTarget() : null;
	const mode: Mode = attached
		? 'attached'
		: layers.length
			? 'layer'
			: group
				? 'frame'
				: node
					? node.kind === 'icon'
						? 'icon'
						: node.kind === 'label'
							? 'label'
							: 'box'
					: edge
						? 'arrow'
						: count > 1
							? 'multi'
							: 'none';
	return { mode, nodes, edges, group, layers, attached, count, node, edge };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const flat = (t: string) => show(t).replace(/\\\\/g, ' / ');

// The header line: the kind and the name, e.g. "Box · Application" or "3 boxes".
export function header(sel: Selection): { kind: string; name: string } | null {
	switch (sel.mode) {
		case 'box':
			return { kind: 'Box', name: flat(sel.node!.title) };
		case 'label':
			return { kind: 'Label', name: flat(sel.node!.title) };
		case 'icon':
			return { kind: 'Icon', name: flat(sel.node!.title) || sel.node!.icon || '' };
		case 'arrow':
			return { kind: 'Arrow', name: `${sel.edge!.e.from} → ${sel.edge!.e.to}` };
		case 'frame':
			return { kind: 'Frame', name: flat(sel.group!.name) };
		case 'attached':
			return { kind: sel.attached!.g ? 'Frame title' : 'Arrow label', name: flat(sel.attached!.text) };
		case 'layer':
			return {
				kind: 'Layer',
				name: sel.layers.length > 1 ? plural(sel.layers.length, 'layer', 'layers') : sel.layers[0].name,
			};
		case 'multi': {
			const of = (kind: string) => sel.nodes.filter((n) => (n.kind || 'box') === kind).length;
			const parts = [
				plural(of('box'), 'box', 'boxes'),
				plural(of('label'), 'label', 'labels'),
				plural(of('icon'), 'icon', 'icons'),
				plural(sel.edges.length, 'arrow', 'arrows'),
			].filter((p) => !p.startsWith('0 '));
			return { kind: parts.join(', '), name: '' };
		}
		default:
			return null;
	}
}
