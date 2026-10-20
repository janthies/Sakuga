// Operations on labels.
import { darkerColor } from '../model/colour';
import { Figure, LabelStyle } from '../model/figure';
import { edges, fontSize, groupMembers, groups, nodes } from '../model/queries';
import { cleanLabel } from '../styles/appearance';
import type { LabelOp, Run } from './types';

export function applyLabel(fig: Figure, op: LabelOp, run: Run): void {
	const node = (id: string) => nodes(fig).find((n) => n.id === id);
	switch (op.op) {
		case 'label': {
			const g = groups(fig).find((g) => g.id === op.group),
				e = op.index === undefined ? undefined : edges(fig)[op.index];
			const target: any = g || (op.slot === undefined ? e : e?.labels?.[op.slot]);
			if (!target) break;
			if (op.text !== undefined) {
				if (g) g.name = op.text;
				else if (op.slot === undefined) e!.label = op.text;
				else target.text = op.text;
			}
			const key = g || op.slot === undefined ? 'labelStyle' : 'style';
			target[key] = cleanLabel({ ...target[key], ...op.style });
			if (!Object.keys(target[key]).length) delete target[key];
			break;
		}
		case 'detachLabel': {
			const g = groups(fig).find((g) => g.id === op.group),
				e = op.index === undefined ? undefined : edges(fig)[op.index],
				l = op.slot === undefined ? undefined : e?.labels?.[op.slot];
			if (!g && !e) break;
			const st = g?.labelStyle || l?.style || e?.labelStyle || {},
				title = g?.name ?? l?.text ?? e!.label;
			const color =
				st.color ||
				(g
					? g.titleColor || darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'))
					: e?.style?.color || '#595959');
			run(fig, {
				op: 'addNode',
				id: op.id,
				x: op.x,
				y: op.y,
				title,
				kind: 'label',
				cat: '',
				layer: (g ? groupMembers(fig, g.id)[0] : nodes(fig).find((n) => n.id === e?.from))?.layer,
				width: op.width || 26,
				style: {
					opacity: e?.style?.opacity,
					compact: true,
					font: st.font || (g ? g.titleFont || 'scriptsize' : fontSize(fig)),
					textColor: color,
					text:
						(st.bold ?? g?.titleBold) && st.italic
							? 'bold-italic'
							: (st.bold ?? g?.titleBold)
								? 'bold'
								: st.italic
									? 'italic'
									: '',
					fill: (st.background ?? !g) ? 'white' : 'none',
				},
			});
			if (g) g.name = '';
			else if (l) e!.labels!.splice(op.slot!, 1);
			else {
				e!.label = '';
				delete e!.labelStyle;
				if (e!.style) {
					const badge = e!.style.step;
					if (badge) node(op.id)!.style!.step = badge;
					delete e!.style.step;
				}
			}
			break;
		}
		case 'attachLabel': {
			const n = node(op.id),
				g = groups(fig).find((g) => g.id === op.group),
				e = op.index === undefined ? undefined : edges(fig)[op.index];
			if (n?.kind !== 'label' || (!g && !e)) break;
			const st: LabelStyle = cleanLabel({
				font: n.style?.font,
				color: n.style?.textColor,
				bold: n.style?.text?.startsWith('bold') ? true : undefined,
				italic: n.style?.text?.includes('italic') ? true : undefined,
				background: n.style?.fill === 'white' ? true : n.style?.fill === 'none' ? false : undefined,
				...op.style,
			});
			if (g) {
				g.name = n.title;
				g.labelStyle = st;
			} else if (!e!.label) {
				e!.label = n.title;
				e!.labelStyle = st;
				if (n.style?.step) e!.style = { ...e!.style, step: n.style.step };
			} else {
				e!.labels = [...(e!.labels || []), { text: n.title, style: st }];
			}
			fig.lines = fig.lines.filter((l) => !(l.t === 'node' && l.n === n));
			break;
		}
	}
}
