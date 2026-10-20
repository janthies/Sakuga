// Operations on groups.
import { context } from '../context';
import { groupDefaults } from '../codec/group';
import { Figure, Group } from '../model/figure';
import { insert } from '../model/lines';
import { groups, nodes } from '../model/queries';
import type { GroupOp, Run } from './types';

export function applyGroup(fig: Figure, op: GroupOp, run: Run): void {
	switch (op.op) {
		case 'addGroup': {
			const g: Group = {
				fill: op.fill ?? (!op.frame ? 'tint' : undefined),
				fillStrength: op.fillStrength,
				outline: op.outline ?? (!op.frame ? 'dashed' : undefined),
				labelStyle: op.labelStyle,
				padding: op.padding,
				titlePosition: op.titlePosition ?? 'above-left',
				titleBold: op.titleBold ?? true,
				titleFont: op.titleFont,
				titleColor: op.titleColor,
				lineWidth: op.lineWidth,
				frameColor: op.frameColor,
				id: op.id,
				name: op.name,
				frame: op.frame || 'dashed',
				color: op.color || 'grey',
				parent: op.parent || '',
			};
			insert(fig, { t: 'group', g });
			if (!op.frame) context.newDefaultGroups.add(g);
			break;
		}
		case 'groupProps': {
			const g = groups(fig).find((x) => x.id === op.id);
			if (g) {
				for (const key of Object.keys(groupDefaults)) {
					if ((op as any)[key] !== undefined) (g as any)[key] = (op as any)[key];
				}
				if (op.name !== undefined) {
					g.name = op.name;
				}
				if (op.frame !== undefined) {
					g.frame = op.frame;
					context.newDefaultGroups.delete(g);
				}
				if (op.color !== undefined) {
					g.color = op.color;
				}
				if (op.parent !== undefined && op.parent !== g.id) {
					g.parent = op.parent;
				}
				if (g.frame === 'none' && op.frame === undefined) {
					if (g.outline && g.outline !== 'none') g.frame = 'solid';
					else if (g.fill && g.fill !== 'none') g.frame = 'region';
				}
			}
			break;
		}
		case 'deleteGroup': {
			const g = groups(fig).find((x) => x.id === op.id);
			if (g) {
				for (const n of nodes(fig)) {
					if (n.group === g.id) {
						n.group = g.parent;
					}
				}
				for (const c of groups(fig)) {
					if (c.parent === g.id) {
						c.parent = g.parent;
					}
				}
				fig.lines = fig.lines.filter(
					(l) => !(l.t === 'group' && l.g === g) && !(l.t === 'edge' && (l.e.from === g.id || l.e.to === g.id)),
				);
			}
			break;
		}
		case 'setGroup':
			for (const n of nodes(fig)) {
				if (op.ids.includes(n.id)) {
					n.group = op.group;
				}
			}
			for (const g of groups(fig)) {
				if (op.ids.includes(g.id) && g.id !== op.group) {
					g.parent = op.group;
				}
			}
			const target = groups(fig).find((g) => g.id === op.group);
			if (
				target &&
				context.newDefaultGroups.has(target) &&
				groups(fig).some((g) => g.parent === target.id && g.frame !== 'none')
			) {
				target.frame = 'solid';
				target.fill = 'none';
				target.outline = 'solid';
			}
			break;
	}
}
