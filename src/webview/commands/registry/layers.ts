import type { Command } from './types';

export const layerCommands: Command[] = [
	{
		id: 'layer.up',
		title: 'Move selection up a layer',
		keys: ['ctrl+code:BracketRight'],
		help: { at: 9, keys: 'Ctrl+[, Ctrl+]', text: 'move selection down or up a layer' },
		when: (s) => s.ids().length > 0 || !!s.selG,
		run: (s) => s.moveSelectionToLayer(1),
	},
	{
		id: 'layer.down',
		title: 'Move selection down a layer',
		keys: ['ctrl+code:BracketLeft'],
		when: (s) => s.ids().length > 0 || !!s.selG,
		run: (s) => s.moveSelectionToLayer(-1),
	},
	{
		id: 'style.copy',
		title: 'Copy style',
		keys: ['ctrl+alt+code:KeyC'],
		help: { at: 12, keys: 'Ctrl+Alt+C, Ctrl+Alt+V', text: 'copy and paste style' },
		when: () => true,
		run: (s) => s.copyStyle(),
	},
	{
		id: 'style.paste',
		title: 'Paste style',
		keys: ['ctrl+alt+code:KeyV'],
		when: () => true,
		run: (s) => s.pasteStyle(),
	},
	{
		id: 'group.ungroup',
		title: 'Ungroup / Detach',
		keys: ['ctrl+shift+g'],
		help: { at: 10, text: 'ungroup / detach' },
		when: () => true,
		run: (s) => s.ungroup(),
	},
	{
		id: 'group.group',
		title: 'Group selection',
		keys: ['ctrl+g'],
		help: { at: 8, text: 'group selection' },
		when: () => true,
		run: (s) => s.group(),
	},
];
