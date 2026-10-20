// Align, distribute and same-size operations on selected boxes. Bounding-box translation and equal-gap
// accumulation adapted from Excalidraw's packages/element/src/{align,distribute}.ts (MIT), see media/sketch.LICENSE.txt.
// Sakuga uses centre coordinates in mm, y upwards, and emits existing operations.
import type { GroupLike, Layout, NodeLike, OpLike } from '../model/node';

export const bounds = (ns: any, layout: any): Record<string, number> => {
	const bs = ns.map((n: any) => {
		const { w, h } = layout(n);
		return { x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - h / 2, y1: n.y + h / 2 };
	});
	return {
		x0: Math.min(...bs.map((b: any) => b.x0)),
		x1: Math.max(...bs.map((b: any) => b.x1)),
		y0: Math.min(...bs.map((b: any) => b.y0)),
		y1: Math.max(...bs.map((b: any) => b.y1)),
	};
};
export function units(nodes: any, groups: any, ids: any, layout: any) {
	const selected = new Set(ids),
		used = new Set(),
		result: any[] = [];
	const inside = (n: any, id: any) => {
		let p = n.group;
		const seen = new Set();
		while (p && !seen.has(p)) {
			if (p === id) return true;
			seen.add(p);
			p = groups.find((g: any) => g.id === p)?.parent;
		}
		return false;
	};
	// Collapse wholly selected groups, outermost first, so members remain rigid.
	const depth = (g: any) => {
		let d = 0,
			p = g.parent;
		const seen = new Set();
		while (p && !seen.has(p)) {
			seen.add(p);
			d++;
			p = groups.find((g: any) => g.id === p)?.parent;
		}
		return d;
	};
	const add = (ns: any) => {
		ns.forEach((n: any) => used.add(n.id));
		if (ns.every((n: any) => !n.hidden && !n.locked)) result.push({ ns, b: bounds(ns, layout) });
	};
	for (const g of [...groups].sort((a, b) => depth(a) - depth(b))) {
		const ns = nodes.filter((n: any) => inside(n, g.id));
		if (ns.length && ns.every((n: any) => selected.has(n.id) && !used.has(n.id))) add(ns);
	}
	for (const n of nodes) if (selected.has(n.id) && !used.has(n.id)) add([n]);
	return result;
}
export function arrange(nodes: any, groups: any, ids: any, key: any, command: any, layout: any) {
	const us = units(nodes, groups, ids, layout),
		ops: OpLike[] = [];
	if (us.length < 2) return { op: 'batch', ops };
	const move = (u: any, axis: any, delta: any) => {
		if (Math.abs(delta) < 1e-8) return;
		for (const n of u.ns)
			ops.push({ op: 'move', id: n.id, x: n.x + (axis === 'x' ? delta : 0), y: n.y + (axis === 'y' ? delta : 0) });
	};
	const ref = us.find((u) => u.ns.some((n: any) => n.id === key));
	const b = ref
		? ref.b
		: bounds(
				us.flatMap((u) => u.ns),
				layout,
			);
	if (command.startsWith('distribute')) {
		const axis = command.endsWith('X') ? 'x' : 'y',
			lo = axis + '0',
			hi = axis + '1';
		us.sort((a: any, b: any) => a.b[lo] + a.b[hi] - (b.b[lo] + b.b[hi]));
		const extent = us.reduce((s, u) => s + u.b[hi] - u.b[lo], 0);
		const all = bounds(
				us.flatMap((u) => u.ns),
				layout,
			),
			gap = (all[hi] - all[lo] - extent) / (us.length - 1);
		let pos = all[lo];
		// Keep equal edge gaps even when negative (overlap), rather than switching to centres.
		for (const u of us) {
			move(u, axis, pos - u.b[lo]);
			pos += u.b[hi] - u.b[lo] + gap;
		}
	} else {
		const [axis, position] = (
			{
				left: ['x', 0],
				centerX: ['x', 0.5],
				right: ['x', 1],
				bottom: ['y', 0],
				centerY: ['y', 0.5],
				top: ['y', 1],
			} as Record<string, [string, number]>
		)[command]!;
		const at = (box: any) => box[axis + '0'] + (box[axis + '1'] - box[axis + '0']) * position;
		for (const u of us) move(u, axis, at(b) - at(u.b));
	}
	return { op: 'batch', ops };
}
export function sameSize(nodes: any, ids: any, key: any, axis: any, layout: any) {
	const ns = nodes.filter((n: any) => ids.includes(n.id) && !n.hidden && !n.locked),
		prop = axis === 'w' ? 'width' : 'minh';
	const target = ns.find((n: any) => n.id === key),
		size = target ? layout(target)[axis] : Math.max(...ns.map((n: any) => layout(n)[axis]));
	const ops = [];
	for (const n of ns) {
		if (n === target) continue;
		// Invert the existing rendered geometry, including padding and shape expansion.
		let lo = 0,
			hi = Math.max(size * 2, n[prop] || 0, 1);
		if (layout({ ...n, [prop]: lo })[axis] > size + 1e-6) continue; // intrinsic text/shape minimum
		for (let i = 0; i < 50; i++) {
			const mid = (lo + hi) / 2;
			if (layout({ ...n, [prop]: mid })[axis] < size) lo = mid;
			else hi = mid;
		}
		ops.push({ op: 'node', id: n.id, [prop]: (lo + hi) / 2 });
	}
	return { op: 'batch', ops };
}
