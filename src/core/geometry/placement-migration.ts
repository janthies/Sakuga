import { layout } from '../text';
import { slotAt } from '../model/slots';
/** Legacy payloads are read once. All subsequent placement uses tree parents and slots. */
import type { Figure, FigNode } from '../model/figure';
import { nodes, categories, edges } from '../model/queries';
import { syncTree } from '../model/tree';
import { childrenOf } from '../model/tree-queries';
import { legacySlot } from '../model/slots';

export function migratePlacement(fig: Figure, markers = true) {
	const ns = nodes(fig),
		used = new Set(ns.map((n) => n.id));
	const fresh = (base: string) => {
		let id = base,
			j = 2;
		while (used.has(id)) id = base + '-' + j++;
		used.add(id);
		return id;
	};
	const legacy = new Map<string, { x: number; y: number; w: number; h: number }>();
	const oldRect = (n: FigNode, seen = new Set<string>()): { x: number; y: number; w: number; h: number } => {
		const cached = legacy.get(n.id);
		if (cached) return cached;
		const s = layout({ ...n, derivedRect: undefined }),
			b = { x: n.x, y: n.y, w: s.w, h: s.h };
		const a = n.attachment,
			parent = a && ns.find((p) => p.id === a.parent);
		if (a && parent && !seen.has(parent.id)) {
			seen.add(n.id);
			const p = oldRect(parent, seen),
				axis = (anchor: string, lo: string, hi: string) => (anchor.includes(lo) ? -1 : anchor.includes(hi) ? 1 : 0);
			b.x = p.x + (axis(a.anchor, 'west', 'east') * p.w) / 2 + a.dx - (axis(a.ownAnchor, 'west', 'east') * b.w) / 2;
			b.y = p.y + (axis(a.anchor, 'south', 'north') * p.h) / 2 + a.dy - (axis(a.ownAnchor, 'south', 'north') * b.h) / 2;
		}
		legacy.set(n.id, b);
		return b;
	};
	for (const n of ns) oldRect(n);
	for (const n of ns) {
		if (!n.kind && markers) {
			const name = categories(fig).find((c) => c.key === n.cat)?.icon;
			const marker = ns.find(
				(v) =>
					(v.treeParent === n.id || v.attachment?.parent === n.id) &&
					(v.categoryMarker || (!!name && v.id === n.id + '-marker')),
			);
			if (marker) marker.categoryMarker = true;
			if (name && n.icon !== 'none') {
				if (marker) marker.icon = name;
				else
					fig.lines.push({
						t: 'node',
						n: {
							...n,
							id: fresh(n.id + '-marker'),
							kind: 'icon',
							title: '',
							code: '',
							cat: '',
							icon: name,
							width: 3,
							minh: 3,
							treeParent: n.id,
							slot: 'top-left',
							order: 1,
							categoryMarker: true,
							look: undefined,
							style: undefined,
						},
					});
			} else if (marker) fig.lines = fig.lines.filter((l) => !(l.t === 'node' && l.n === marker));
		}
		if (n.attachment) {
			const a = n.attachment;
			n.treeParent = a.parent;
			n.slot ||= legacy.has(a.parent)
				? slotAt(legacy.get(a.parent)!, legacy.get(n.id)!)
				: legacySlot(a.anchor, a.ownAnchor, a.dx, a.dy);
			delete n.attachment;
		}
		if (!n.kind) {
			if (n.title || n.code) {
				const label: FigNode = {
					...n,
					id: n.titleId || fresh(n.id + '-title'),
					kind: 'label',
					cat: '',
					title: n.title,
					code: n.code,
					minh: 0,
					slot: legacySlot(n.titlePosition),
					treeParent: n.id,
					order: 0,
					icon: undefined,
					look: undefined,
					style: { font: n.style?.font, text: n.style?.text, textColor: n.style?.textColor },
					hidden: !!n.titleHidden,
				};
				delete label.titleId;
				delete label.titlePosition;
				delete label.iconPosition;
				fig.lines.push({ t: 'node', n: label });
			}
			n.title = '';
			n.code = '';
			delete n.codeFont;
			delete n.titleId;
			delete n.titleHidden;
			if (n.icon && !['none', 'category'].includes(n.icon)) {
				const slot = (
					{
						left: 'left',
						right: 'right',
						above: 'top',
						nw: 'top-left',
						ne: 'top-right',
						sw: 'bottom-left',
						se: 'bottom-right',
					} as Record<string, any>
				)[n.iconPosition || 'nw'];
				fig.lines.push({
					t: 'node',
					n: {
						...n,
						id: fresh(n.id + '-icon'),
						kind: 'icon',
						title: '',
						code: '',
						cat: '',
						width: 3,
						minh: 3,
						treeParent: n.id,
						slot,
						order: 1,
						look: undefined,
						style: undefined,
					},
				});
				delete n.icon;
			}
		}
		delete n.titlePosition;
		delete n.iconPosition;
	}
	for (const e of edges(fig)) {
		if (e.style?.position || e.style?.side) {
			e.labelStyle = {
				pos: e.style.position === 'start' ? 0.25 : e.style.position === 'end' ? 0.75 : 0.5,
				side: e.style.side,
				...e.labelStyle,
			};
			delete e.style.position;
			delete e.style.side;
			if (e.look) {
				delete e.look.own.position;
				delete e.look.own.side;
				delete e.look.resolved.position;
				delete e.look.resolved.side;
			}
		}
		for (const st of [e.labelStyle, ...(e.labels || []).map((l) => l.style)])
			if (st) {
				delete st.dx;
				delete st.dy;
				delete st.segment;
			}
	}
	syncTree(fig);
	for (const i of fig.items || []) {
		const p = i.kind === 'Frame' ? i.frame : i.kind === 'Line' ? i.line : undefined;
		if (p?.attachment) {
			const a = p.attachment;
			i.parent = a.parent;
			i.slot = legacySlot(a.anchor, a.ownAnchor, a.dx, a.dy);
			p.treeParent = i.parent;
			p.slot = i.slot;
			delete p.attachment;
		}
	}
	// Unpositioned legacy children get the deterministic creation default.
	for (const i of fig.items || []) {
		const parent = fig.items?.find((p) => p.id === i.parent);
		if (parent?.kind === 'Shape' && !i.slot) {
			i.slot = childrenOf(fig, parent.id)
				.filter((c) => c.id !== i.id)
				.some((c) => c.slot === 'centre')
				? 'below'
				: 'centre';
			if ('node' in i && i.node) i.node.slot = i.slot;
		}
	}
}
