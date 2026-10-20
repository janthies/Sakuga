import { loadIcons } from './env';

const t = loadIcons();

// A figure built from ops, for tests that need a specific starting document: nodes are [id, x, y, extra], edges are addEdge ops.
export function figure(
	nodes: [string, number, number, Record<string, unknown>?][],
	edges: Record<string, unknown>[] = [],
	more: Record<string, unknown>[] = [],
): string {
	const fig = t.parse(t.TEMPLATE);
	for (const [id, x, y, extra] of nodes) {
		t.apply(fig, { op: 'addNode', id, x, y, title: id, cat: '', ...extra });
	}
	for (const e of edges) {
		t.apply(fig, { op: 'addEdge', ...e });
	}
	for (const o of more) {
		t.apply(fig, o);
	}
	return t.serialize(fig);
}
