import { byId, groupById } from '../../store/model';
import { labelTarget } from '../../render/labelgeom';
import { show } from '../../store/constants';
import { store } from '../../store/store';
import type { Group, Layer, ViewEdge, ViewNode } from '../../store/types';

export type LabelTarget = NonNullable<ReturnType<typeof labelTarget>>;

// What the inspector is showing, decided from the store's selection. The first match wins, in this order.
export type Mode = 'line' | 'none' | 'box' | 'label' | 'icon' | 'arrow' | 'frame' | 'attached' | 'layer' | 'multi';

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
	const line = count === 1 && store.items.find((i) => i.id === [...store.selN][0] && i.kind === 'Line');
	const text = count === 1 && store.items.find((i) => i.id === [...store.selN][0] && i.kind === 'Text');
	const mode: Mode = line
		? 'line'
		: text && !node
			? 'label'
			: attached
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
		case 'box': {
			const label = store.items.find((i) => i.parent === sel.node!.id && i.slot === 'centre' && i.kind === 'Text');
			return { kind: 'Box', name: flat(label?.kind === 'Text' ? label.text : sel.node!.title) };
		}
		case 'label': {
			const label = store.items.find((i) => i.id === [...store.selN][0] && i.kind === 'Text');
			return { kind: 'Label', name: flat(sel.node?.title || (label?.kind === 'Text' ? label.text : '')) };
		}
		case 'icon':
			return { kind: 'Icon', name: flat(sel.node!.title) || sel.node!.icon || '' };
		case 'arrow':
			return { kind: 'Arrow', name: `${sel.edge!.e.from} → ${sel.edge!.e.to}` };
		case 'line':
			return { kind: 'Line', name: [...store.selN][0] };
		case 'frame':
			return { kind: 'Group', name: flat(sel.group!.name) };
		case 'attached':
			return { kind: 'Label', name: flat(sel.attached!.text) };
		case 'layer':
			return {
				kind: 'Layer',
				name: sel.layers.length > 1 ? plural(sel.layers.length, 'layer', 'layers') : sel.layers[0].name,
			};
		case 'multi':
			return { kind: `${sel.count} items`, name: '' };
		default:
			return null;
	}
}
