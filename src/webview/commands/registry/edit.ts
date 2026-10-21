import type { Command } from './types';

// Keys that open the text field of the selected box.
const editable = (n: any) => n && !n.locked && !n.hidden && (!n.kind || n.kind === 'label');

export const editCommands: Command[] = [
	{
		id: 'box.next',
		title: 'Next connected box',
		keys: ['tab'],
		help: { at: 20, keys: 'Tab / Shift+Tab', text: 'next connected box / box below; type label' },
		when: (s) => {
			const n = s.one();
			return !!n && !n.kind && !n.locked && !n.hidden;
		},
		run: (s, k) => s.nextBox(!!k?.shift),
	},
	{
		id: 'box.edit',
		title: 'Edit label',
		keys: ['enter', 'f2'],
		help: { at: 19, keys: 'Enter / F2', text: 'edit existing label' },
		when: (s) => !!s.one() && !s.one().locked,
		run: (s) => s.edit(s.one().id),
	},
	{
		id: 'box.type',
		title: 'Type to replace the label',
		keys: ['char'],
		help: {
			at: 22,
			keys: 'Type a character',
			text: 'replace box/label text; D/R and existing shortcuts take priority',
		},
		// D and R belong to the arrow commands even when only a box is selected
		when: (s, k) => editable(s.one()) && !!k && !'dr'.includes(k.key.toLowerCase()),
		run: (s, k) => s.edit(s.one().id, k.key),
	},
];
