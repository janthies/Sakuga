import type { Command } from './types';

const DIGITS = Array.from({ length: 9 }, (_, i) => i + 1);

export const selectionCommands: Command[] = [
	{
		id: 'selection.all',
		title: 'Select all',
		keys: ['ctrl+a'],
		help: { at: 4, text: 'select all' },
		when: () => true,
		run: (s) => s.selectAll(),
	},
	{
		id: 'selection.duplicate',
		title: 'Duplicate',
		keys: ['ctrl+d'],
		help: { at: 7, text: 'duplicate' },
		when: () => true,
		run: (s) => {
			const ids = s.ids();
			if (ids.length) s.duplicate(ids, 5, -5);
		},
	},
	{
		id: 'selection.category',
		title: 'Box style 1 to 9',
		keys: DIGITS.map((n) => `-shift+code:Digit${n}`),
		help: { at: 14, keys: '1–9', text: 'box style' },
		when: (s, k) => s.ids().length > 0 && !!k && !!s.cats[+k.code.slice(5) - 1],
		run: (s, k) => {
			const key = s.cats[+k.code.slice(5) - 1].key;
			s.setLastCat(key);
			return { op: 'batch', ops: s.ids().map((id) => ({ op: 'node', id, cat: key })) };
		},
	},
	{
		id: 'selection.nudge',
		title: 'Nudge',
		keys: ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'],
		help: { at: 13, keys: 'Arrow keys', text: 'nudge 1 mm, with Shift 5 mm' },
		when: (s) => s.ids().length > 0,
		run: (s, k) => {
			const step = k.shift ? 5 : 1;
			const dx = ({ ArrowLeft: -step, ArrowRight: step } as Record<string, number>)[k.key] || 0;
			const dy = ({ ArrowDown: -step, ArrowUp: step } as Record<string, number>)[k.key] || 0;
			return {
				op: 'batch',
				ops: s
					.ids()
					.filter((id) => !s.node(id).locked)
					.map((id) => ({ op: 'move', id, x: s.node(id).x + dx, y: s.node(id).y + dy })),
			};
		},
	},
	{
		id: 'arrow.route',
		title: 'Next route of the arrow',
		keys: ['r'],
		help: { at: 16, text: 'next route of the arrow' },
		when: (s) => s.ix().length > 0,
		run: (s) => {
			const order = s.routes;
			const ix = s.ix();
			const route = order[(order.indexOf(s.edge(ix[0]).route) + 1) % order.length];
			return { op: 'batch', ops: ix.map((index) => ({ op: 'arrow', index, route, mid: null, bend: 0 })) };
		},
	},
	{
		id: 'arrow.dashed',
		title: 'Dashed arrow on or off',
		keys: ['d'],
		help: { at: 15, text: 'dashed arrow on or off' },
		when: (s) => s.ix().length > 0,
		run: (s) => {
			const ix = s.ix();
			const kind = ix.every((i) => s.edge(i).kind === 'arr-dashed') ? 'arr' : 'arr-dashed';
			return { op: 'batch', ops: ix.map((index) => ({ op: 'arrow', index, kind })) };
		},
	},
	{
		id: 'selection.delete',
		title: 'Delete',
		keys: ['delete', 'backspace'],
		help: { at: 34, keys: 'Del', text: 'delete' },
		when: (s) => s.ids().length > 0 || s.ix().length > 0 || !!s.label,
		run: (s) => s.deleteSelection(),
	},
	{
		id: 'selection.clear',
		title: 'Clear selection',
		keys: ['escape'],
		help: { at: 35, text: 'clear selection' },
		when: () => true,
		run: (s) => s.clearSelection(),
	},
];
