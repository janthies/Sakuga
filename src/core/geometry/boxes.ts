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
	return n.icon === 'none' ? undefined : n.icon === 'category' || (!n.icon && c?.boxes) ? c?.icon : n.icon;
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
}
