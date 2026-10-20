// Placing the next box beside a source box, at the figure's typical gap.
import type { EdgeLike, Layout, NodeLike } from '../model/node';

export function typicalGap(nodes: any, layout: any) {
	const boxes = nodes.filter((n: any) => !n.kind && !n.hidden),
		gaps = [];
	for (const a of boxes)
		for (const axis of ['x', 'y']) {
			const other = axis === 'x' ? 'y' : 'x',
				size = axis === 'x' ? 'w' : 'h',
				cross = axis === 'x' ? 'h' : 'w',
				la = layout(a);
			const candidates = boxes
				.filter(
					(b: any) =>
						b !== a && b[axis] > a[axis] && Math.abs(b[other] - a[other]) < (la[cross] + layout(b)[cross]) / 2,
				)
				.map((b: any) => b[axis] - a[axis] - (la[size] + layout(b)[size]) / 2)
				.filter((g: any) => g >= 0);
			if (candidates.length) gaps.push(Math.min(...candidates));
		}
	gaps.sort((a, b) => a - b);
	const m = Math.floor(gaps.length / 2);
	return gaps.length ? (gaps.length % 2 ? gaps[m] : (gaps[m - 1] + gaps[m]) / 2) : 8;
}
export function nextBox(nodes: any, edges: any, source: any, id: any, below: any, layout: any) {
	const incoming = [...edges].reverse().find((e) => e.to === source.id),
		prev = incoming && nodes.find((n: any) => n.id === incoming.from);
	let dx = 1,
		dy = 0;
	if (below) {
		dx = 0;
		dy = -1;
	} else if (prev) {
		const x = source.x - prev.x,
			y = source.y - prev.y;
		if (Math.abs(y) > Math.abs(x)) {
			dx = 0;
			dy = Math.sign(y) || -1;
		} else {
			dx = Math.sign(x) || 1;
		}
	}
	const gap = typicalGap(nodes, layout),
		n = {
			...source,
			id,
			width: source.wantWidth ?? source.width,
			wantWidth: undefined,
			title: '',
			code: '',
			group: '',
			attachment: undefined,
			extra: [...source.extra],
			style: { ...source.style },
		},
		a = layout(source),
		b = layout(n);
	n.x = source.x + dx * ((a.w + b.w) / 2 + gap);
	n.y = source.y + dy * ((a.h + b.h) / 2 + gap);
	// Advance past every overlapping object; each pass strictly advances along the ray.
	for (let i = 0; i <= nodes.length; i++) {
		const hit = nodes.find(
			(o: any) =>
				!o.hidden &&
				Math.abs(n.x - o.x) < (b.w + layout(o).w) / 2 - 1e-7 &&
				Math.abs(n.y - o.y) < (b.h + layout(o).h) / 2 - 1e-7,
		);
		if (!hit) break;
		const h = layout(hit);
		if (dx) n.x = hit.x + dx * ((h.w + b.w) / 2 + gap);
		else n.y = hit.y + dy * ((h.h + b.h) / 2 + gap);
	}
	const { codeFont, titlePosition, style, extra, layer, x, y, cat, icon, iconPosition, width, minh } = n;
	return {
		node: n,
		edge: {
			from: source.id,
			to: id,
			kind: 'arr',
			route: 'auto',
			mid: null,
			bend: 0,
			head: 'end',
			label: '',
			extra: [],
		},
		batch: {
			op: 'batch',
			ops: [
				{
					op: 'addNode',
					id,
					title: '',
					codeFont,
					titlePosition,
					style,
					extra,
					layer,
					x,
					y,
					cat,
					icon,
					iconPosition,
					width,
					minh,
					from: source.id,
				},
			],
		},
	};
}
