// Pasting a TikZ snippet as operations.
import { lineItems } from '../model/tree';
import { parse } from '../codec/parse';
import { specialGeometry } from '../geometry/figure-geometry';
import { Figure } from '../model/figure';
import { edges, groups, nodes, styleDefs } from '../model/queries';
import { Op } from './types';

// Operations that add the boxes, arrows and categories of a pasted TikZ snippet, with fresh ids,
// shifted by (dx, dy). Lines that are not Sakuga boxes or arrows are ignored.
export function pasteOps(
	fig: Figure,
	text: string,
	dx: number,
	dy: number,
	parent?: string,
): { ops: Op[]; ids: string[] } {
	const src = parse(text);
	const ops: Op[] = [];
	const have = new Set(styleDefs(fig).map((d) => d.key));
	for (const d of styleDefs(src)) {
		if (!have.has(d.key)) {
			ops.push({
				op: 'categoryAdd',
				category: {
					key: d.key,
					name: d.name,
					...(d.icon ? { icon: d.icon } : { color: d.color || 'white' }),
					fill: d.fill,
					outline: d.outline,
					outlineColor: d.outlineColor,
					legend: d.legend,
				},
			});
			have.add(d.key);
		}
	}
	const used = new Set([
		...nodes(fig).map((n) => n.id),
		...groups(fig).map((g) => g.id),
		...lineItems(fig).map((l) => l.id),
	]);
	let next = 1;
	const fresh = () => {
		while (used.has(`n${next}`)) {
			next++;
		}
		used.add(`n${next}`);
		return `n${next}`;
	};
	const map = new Map<string, string>();
	for (const g of groups(src)) map.set(g.id, fresh());
	for (const g of groups(src))
		ops.push({
			op: 'addGroup',
			...g,
			id: map.get(g.id)!,
			parent: map.get(g.parent) || '',
			titlePosition: g.titlePosition || 'legacy',
			titleBold: g.titleBold ?? false,
		});
	for (const n of nodes(src)) {
		const id = fresh();
		map.set(n.id, id);
		ops.push({
			op: 'addNode',
			parent: undefined,
			categoryMarker: n.categoryMarker,
			id,
			x: n.x + dx,
			y: n.y + dy,
			title: n.title,
			icon: n.icon,
			iconPosition: n.iconPosition,
			kind: n.kind,
			code: n.code,
			wantWidth: n.wantWidth,
			codeFont: n.codeFont,
			style: n.look?.own || n.style,
			extra: n.extra,
			cat: have.has(n.cat) ? n.cat : '',
			width: n.width,
			minh: n.minh,
		});
	}
	for (const l of lineItems(src)) {
		const id = fresh();
		map.set(l.id, id);
		ops.push({
			op: 'addLine',
			id,
			start: [l.start[0] + dx, l.start[1] + dy],
			end: [l.end[0] + dx, l.end[1] + dy],
			parent: map.get(l.treeParent || ''),
			style: l.look?.own || l.style,
			labels: l.labels?.map((v) => ({ ...v, id: undefined })),
		});
	}
	for (const i of src.items || []) {
		const id = map.get(i.id);
		if (!id) continue;
		const target = map.get(i.parent) || parent;
		if (target) ops.push({ op: 'reparent', id, newParent: target });
		if (i.slot && map.has(i.parent)) ops.push({ op: 'slot', id, slot: i.slot });
	}

	for (const e of edges(src)) {
		const a = map.get(e.from),
			b = map.get(e.to);
		if (a && b) {
			ops.push({
				op: 'addEdge',
				fromOffset: e.fromOffset,
				toOffset: e.toOffset,
				loopSide: e.loopSide,
				loopSize: e.loopSize,
				loopOut: e.loopOut,
				loopIn: e.loopIn,
				looseness: e.looseness,
				loopMax: e.loopMax,
				...(e.route === 'fixed'
					? {
							waypoints: specialGeometry(src, e)
								?.pts.slice(1, -1)
								.map((p: number[]) => [p[0] + dx, p[1] + dy]),
						}
					: {}),
				fromAnchor: e.fromAnchor,
				toAnchor: e.toAnchor,
				lane: e.lane,
				styleKey: e.styleKey && have.has(e.styleKey) ? e.styleKey : undefined,
				labelStyle: e.labelStyle,
				labels: e.labels?.map((v) => ({ ...v, id: undefined })),
				style: e.style,
				extra: e.extra,
				from: a,
				to: b,
				kind: e.kind,
				route: e.route,
				mid:
					e.mid === null
						? null
						: e.mid + (e.route === 'hvh' || (e.route === 'u' && /east|west/.test(e.fromAnchor || '')) ? dx : dy),
				bend: e.bend,
				head: e.head,
				label: e.label,
			});
		}
	}
	return {
		ops,
		ids: [...(src.items || [])].filter((i) => map.has(i.id) && !map.has(i.parent)).map((i) => map.get(i.id)!),
	};
}
