// Operations on groups.
import { context } from '../context';
import { groupKeys } from '../schema';
import { Figure, Group } from '../model/figure';
import { insert } from '../model/lines';
import { groups, nodes } from '../model/queries';
import type { GroupOp, Run } from './types';

export function applyGroup(fig: Figure, op: GroupOp, run: Run): void {
	switch (op.op) {
		case 'addGroup': {
			const g: Group = { id: op.id, name: op.name, frame: 'none', color: 'grey', parent: op.parent || '' };
			insert(fig, { t: 'group', g });
			if (!op.frame) context.newDefaultGroups.add(g);
			break;
		}
		case 'groupProps': {
			const g = groups(fig).find((x) => x.id === op.id);
			if (g && op.name !== undefined) g.name = op.name;
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
