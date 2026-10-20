// Box size, anchors and attachments in millimetres.
import * as textGeometry from '../text/index';
import { FigNode, Figure } from '../model/figure';
import { categories, fontSize, nodes } from '../model/queries';

// Content width and wrapped geometry shared with the canvas.
export function normalizeWidth(fig: Figure, n: FigNode): void {
	const effective = { ...n, icon: nodeIcon(fig, n) };
	textGeometry.normalize(effective, fontSize(fig));
	n.width = effective.width;
	if (effective.wantWidth === undefined) delete n.wantWidth;
	else n.wantWidth = effective.wantWidth;
	if (effective.codeFont === undefined) delete n.codeFont;
	else n.codeFont = effective.codeFont;
}

export function boxHalf(n: FigNode): [number, number] {
	const { w, h } = textGeometry.layout(n);
	return [w / 2, h / 2];
}

export function nodeIcon(fig: Figure, n: FigNode): string | undefined {
	const c = categories(fig).find((c) => c.key === n.cat);
	return n.icon === 'none' ? undefined : n.icon === 'category' || (!n.icon && !!c?.icon) ? c?.icon : n.icon;
}

export function anchorPoint(n: FigNode, anchor: string): [number, number] {
	const [w, h] = boxHalf(n);
	return [
		n.x + (anchor.includes('west') ? -w : anchor.includes('east') ? w : 0),
		n.y + (anchor.includes('north') ? h : anchor.includes('south') ? -h : 0),
	];
}

// Place every attached box from its parent. half gives the half width and half height of a box as it is drawn.
export function placeAttached(list: FigNode[], half: (n: FigNode) => [number, number]) {
	const done = new Set<string>(),
		visiting = new Set<string>();
	const at = (n: FigNode, anchor: string): [number, number] => {
		const [w, h] = half(n);
		return [
			n.x + (anchor.includes('west') ? -w : anchor.includes('east') ? w : 0),
			n.y + (anchor.includes('north') ? h : anchor.includes('south') ? -h : 0),
		];
	};
	const visit = (n: FigNode) => {
		if (done.has(n.id) || visiting.has(n.id)) {
			return;
		}
		visiting.add(n.id);
		const a = n.attachment,
			parent = a && list.find((p) => p.id === a.parent && !p.kind);
		if (a && parent && !visiting.has(parent.id)) {
			visit(parent);
			const [px, py] = at(parent, a.anchor),
				[ox, oy] = at({ ...n, x: 0, y: 0 }, a.ownAnchor);
			n.x = px + a.dx - ox;
			n.y = py + a.dy - oy;
		}
		visiting.delete(n.id);
		done.add(n.id);
	};
	list.forEach(visit);
}

export function resolveAttachments(fig: Figure) {
	const sized = (o: FigNode) => ({
		...o,
		icon: nodeIcon(fig, o),
		style: { ...o.style, font: o.style?.font || fontSize(fig) },
	});
	placeAttached(nodes(fig), (n) => boxHalf(sized(n)));
	placeContainers(fig);
}

// Groups and lines attached to boxes use the same anchor contract as nodes.
// Their payload coordinates stay absolute for the routing and scene adapters.
export function placeContainers(fig: Figure) {
	const sized = (n: FigNode) => ({
		...n,
		icon: nodeIcon(fig, n),
		style: { ...n.style, font: n.style?.font || fontSize(fig) },
	});
	const visit = (id: string) => {
		const i = itemById(fig, id);
		if (!i) return;
		const a = payload(i).attachment;
		const p = a && itemById(fig, a.parent);
		if (a && p?.kind === 'Shape' && (i.kind === 'Frame' || i.kind === 'Line')) {
			const objects = nodes(fig).map((n) => {
				const [w, h] = boxHalf(sized(n));
				return { ...n, w: w * 2, h: h * 2 };
			});
			const b = i.kind === 'Frame' ? bounds(i.id, objects, groups(fig)) : { x: i.line.start[0], y: i.line.start[1] };
			if (b) {
				const [x, y] = anchorPoint(sized(p.node), a.anchor),
					dx = x + a.dx - b.x,
					dy = y + a.dy - b.y;
				for (const c of [i, ...descendants(fig, i.id)]) {
					if ('node' in c && c.node) {
						c.node.x += dx;
						c.node.y += dy;
					}
					if (c.kind === 'Line') {
						c.line.start = [c.line.start[0] + dx, c.line.start[1] + dy];
						c.line.end = [c.line.end[0] + dx, c.line.end[1] + dy];
					}
				}
			}
		}
		placeAttached(nodes(fig), (n) => boxHalf(sized(n)));
		for (const c of childrenOf(fig, id)) visit(c.id);
	};
	for (const i of fig.items || []) if (!itemById(fig, i.parent)) visit(i.id);
}

import { itemById, childrenOf, descendants } from '../model/tree-queries';
import { payload } from '../model/tree';
import { groups } from '../model/queries';
import { bounds } from './route-bounds';
