// Legacy named styles are input only; box definitions remain the category adapter for the old panel.
import type { Figure } from '../model/figure';
import { nodes, edges, styleDefs } from '../model/queries';
import { mergeStyle } from './resolve';
export function migrateLooks(fig: Figure) {
	for (const d of styleDefs(fig)) {
		if (d.kind === 'box') continue;
		for (const n of nodes(fig).filter((n) => n.cat === d.key)) {
			n.style = mergeStyle(d.kind, d.props, n.style || {});
			n.cat = '';
		}
		for (const e of edges(fig).filter((e) => e.styleKey === d.key)) {
			e.style = mergeStyle(d.kind, d.props, e.style || {});
			delete e.styleKey;
		}
	}
	fig.lines = fig.lines.filter((l) => l.t !== 'style' || l.s.kind === 'box');
}

// Convert the old category payload once, retaining non-category properties on users.
export function migrateCategories(fig: Figure) {
	const disabled = fig.lines.some((l) => l.t === 'legendflag' && !l.on);
	if (disabled) for (const d of styleDefs(fig)) d.legend = false;
	fig.lines = fig.lines.filter((l) => l.t !== 'legendflag');
	for (const d of styleDefs(fig).filter((d) => d.kind === 'box')) {
		const legacy = { ...d.props, ...d.kinds?.Shape };
		d.outline ??= legacy.border;
		d.outlineColor ??= legacy.color;
		if (!d.color && !d.icon) d.color = legacy.fill || 'white';
		if (d.icon && (legacy.fill || d.color)) {
			const color = legacy.fill || d.color!;
			d.fill ??= color;
			d.outlineColor ??= darkerColor(color);
		}
		if (d.icon) delete d.color;
		for (const i of fig.items || []) {
			if (payload(i).cat !== d.key) continue;
			const values = { ...(i.kind === 'Shape' ? legacy : {}), ...d.kinds?.[i.kind] };
			delete values.fill;
			if (d.emphasis) values.text = d.emphasis;
			const p = payload(i);
			if (i.kind === 'Frame') Object.assign(i.frame, values);
			else {
				const own = { ...values, ...(p.look?.own || ('style' in p ? (p.style as object) : {})) };
				p.look = { own, resolved: { ...own } };
				if (!(i.kind === 'Text' && !i.node)) (p as any).style = { ...own };
			}
		}
		for (const i of fig.items || []) {
			const p = payload(i) as any;
			if (p.cat !== d.key) continue;
			const extra: string[] = p.extra || [];
			if (p.legend || p.style?.legend || p.look?.own?.legend || extra.some((v) => /^sg legend(?:=true)?$/.test(v)))
				d.legend = true;
			delete p.legend;
			if (p.style) delete p.style.legend;
			if (p.look) {
				delete p.look.own.legend;
				delete p.look.resolved.legend;
			}
			if (p.extra) p.extra = extra.filter((v) => !/^sg legend(?:=|$)/.test(v));
		}
		d.props = {};
		delete d.kinds;
		delete d.emphasis;
		delete d.boxes;
	}
}

import { darkerColor, PALETTE } from '../model/colour';
import { payload, syncTree } from '../model/tree';
import { geometryOf } from '../geometry/figure-geometry';
import { groups } from '../model/queries';
import type { FigNode } from '../model/figure';

export function migrateFrames(fig: Figure) {
	for (const g of groups(fig))
		if (g.frame !== 'none' && fig.theme?.kinds?.Frame) Object.assign(g, { ...fig.theme.kinds.Frame, ...g });
	const geo = geometryOf(fig);
	const snapshots = groups(fig).map((g) => ({ g, rect: geo.frame(g.id), title: geo.frameTitle(g) }));
	const used = new Set(fig.items?.map((i) => i.id));
	const fresh = (base: string) => {
		let id = base,
			n = 2;
		while (used.has(id)) id = base + '-' + n++;
		used.add(id);
		return id;
	};
	let insertion = fig.lines.findIndex((l) => l.t === 'node' || l.t === 'line');
	if (insertion < 0) insertion = fig.lines.findIndex((l) => l.t === 'raw' && l.text.includes('\\end{tikzpicture}'));
	if (insertion < 0) insertion = fig.lines.length;
	for (const { g, rect, title } of snapshots) {
		const draws = g.frame !== 'none' || (g.fill && g.fill !== 'none') || (g.outline && g.outline !== 'none');
		if (draws && rect) {
			const hex = /^#[0-9a-f]{6}$/i.test(g.color) ? g.color.slice(1) : (PALETTE[g.color] || PALETTE.grey).hex;
			const strength = (g.fillStrength ?? 30) / 100;
			const tint =
				'#' +
				[0, 2, 4]
					.map((i) =>
						Math.round(parseInt(hex.slice(i, i + 2), 16) * strength + 255 * (1 - strength))
							.toString(16)
							.padStart(2, '0'),
					)
					.join('')
					.toUpperCase();
			const n: FigNode = {
				id: fresh(g.id + '-background'),
				title: '',
				code: '',
				x: rect.x,
				y: rect.y,
				width: Math.max(0, rect.w - 2.2675),
				minh: rect.h,
				cat: '',
				layer: '',
				group: g.id,
				treeParent: g.id,
				order: -1,
				hidden: false,
				locked: false,
				extra: [],
				style: {
					cornerRadius: g.frame === 'region' ? 1.5 : 2.5,
					...(g.outline === 'dashed' || (!g.outline && g.frame === 'dashed') ? { dashOn: 9, dashOff: 3 } : {}),
					...(g.outline === 'dotted' || (!g.outline && g.frame === 'dotted')
						? { dashOn: 0, dashOff: 4.5, roundCap: true }
						: {}),
					fill: (g.fill || (g.frame === 'region' ? 'tint' : 'none')) === 'none' ? 'none' : tint,
					border: g.outline || (g.frame === 'region' ? 'none' : g.frame),
					color: g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'),
					lineWidth: g.lineWidth || (g.frame === 'dotted' ? 1.5 : 0.7),
				},
			};
			fig.lines.splice(insertion++, 0, { t: 'node', n });
			if (g.name && title) {
				const ownAnchor = title.align === 'start' ? 'west' : title.align === 'end' ? 'east' : 'center';
				const label: FigNode = {
					...n,
					id: fresh(g.id + '-label'),
					kind: 'label',
					hidden: !!g.labelStyle?.hidden,
					title: g.name,
					width: 26,
					minh: 0,
					x: title.p[0],
					y: title.p[1],
					treeParent: n.id,
					order: 1,
					attachment: {
						parent: n.id,
						anchor: 'north west',
						ownAnchor,
						dx: title.p[0] - (rect.x - rect.w / 2),
						dy: title.p[1] - (rect.y + rect.h / 2),
					},
					style: {
						compact: true,
						font: g.labelStyle?.font || g.titleFont || 'scriptsize',
						text:
							(g.labelStyle?.bold ?? g.titleBold)
								? g.labelStyle?.italic
									? 'bold-italic'
									: 'bold'
								: g.labelStyle?.italic
									? 'italic'
									: 'normal',
						fill: g.labelStyle?.background ? 'white' : 'none',
						textColor:
							g.labelStyle?.color ||
							g.titleColor ||
							(g.titlePosition && g.titlePosition !== 'legacy'
								? darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'))
								: '#737373'),
					},
				};
				fig.lines.splice(insertion++, 0, { t: 'node', n: label });
			}
		}
		for (const key of [
			'fill',
			'fillStrength',
			'outline',
			'labelStyle',
			'padding',
			'titlePosition',
			'titleBold',
			'titleFont',
			'titleColor',
			'lineWidth',
			'frameColor',
			'cat',
			'look',
			'titleId',
		])
			delete (g as any)[key];
		g.frame = 'none';
	}
	if (fig.theme?.kinds) delete fig.theme.kinds.Frame;
	syncTree(fig);
}
