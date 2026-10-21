// Box size, anchors and attachments in millimetres.
import * as textGeometry from '../text/index';
import { FigNode, Figure } from '../model/figure';
import { categories, fontSize, nodes } from '../model/queries';

// Content width and wrapped geometry shared with the canvas.
export function normalizeWidth(fig: Figure, n: FigNode): void {
	const effective = { ...n, derivedRect: undefined, icon: n.kind ? nodeIcon(fig, n) : undefined };
	textGeometry.normalize(effective, fontSize(fig));
	n.width = effective.width;
	if (effective.wantWidth === undefined) delete n.wantWidth;
	else n.wantWidth = effective.wantWidth;
	if (effective.codeFont === undefined) delete n.codeFont;
	else n.codeFont = effective.codeFont;
}

export function boxHalf(n: FigNode): [number, number] {
	const { w, h } = slotRect(n) || textGeometry.layout(n);
	return [w / 2, h / 2];
}

export function nodeIcon(fig: Figure, n: FigNode): string | undefined {
	if (!n.kind) return undefined;
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

export function resolveAttachments(fig: Figure) {
	layoutSlots(fig);
}
import { layoutSlots, slotRect } from './slot-layout';
