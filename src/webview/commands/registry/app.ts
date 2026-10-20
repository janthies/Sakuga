import type { Command } from './types';

// Clipboard events reach the page as events, not as key presses; the argument is the ClipboardEvent.
type ClipEvent = {
	clipboardData: { setData(t: string, v: string): void; getData(t: string): string };
	preventDefault(): void;
};

function copyTo(s: any, ev: ClipEvent): boolean {
	const t = s.clipText();
	if (!t) return false;
	ev.clipboardData.setData('text/plain', t);
	ev.preventDefault();
	return true;
}

export const clipboardCommands: Command[] = [
	{
		id: 'clipboard.copy',
		title: 'Copy',
		keys: ['ctrl+c'],
		native: true,
		help: { at: 11, keys: 'Ctrl+C, Ctrl+X, Ctrl+V', text: 'copy, cut, paste (as TikZ)' },
		when: (s) => !s.busy(),
		run: (s, ev: ClipEvent) => void copyTo(s, ev),
	},
	{
		id: 'clipboard.cut',
		title: 'Cut',
		keys: ['ctrl+x'],
		native: true,
		when: (s) => !s.busy(),
		run: (s, ev: ClipEvent) => {
			if (copyTo(s, ev)) s.deleteSelection();
		},
	},
	{
		id: 'clipboard.paste',
		title: 'Paste',
		keys: ['ctrl+v'],
		native: true,
		when: (s) => !s.busy(),
		run: (s, ev: ClipEvent) => {
			if (s.paste(ev.clipboardData.getData('text/plain'))) ev.preventDefault();
		},
	},
];

// Toolbar and drawer buttons.
export const appCommands: Command[] = [
	{
		id: 'view.fit',
		title: 'Fit to view',
		keys: ['shift+code:Digit1'],
		help: { at: 38, text: 'fit to view' },
		when: () => true,
		run: (s) => s.fit(),
	},
	{ id: 'view.fitWidth', title: 'Fit and follow the window', when: () => true, run: (s) => s.resetFit() },
	{
		id: 'node.addBox',
		title: 'New box',
		when: () => true,
		run: (s) => s.openObjectMenu(),
	},
	{
		id: 'node.addLabel',
		title: 'New label',
		when: () => true,
		run: (s) => {
			const id = s.newId(),
				c = s.centre();
			s.pendingEdit(id);
			return { op: 'addNode', kind: 'label', id, title: 'Label', cat: '', width: 18, x: c.x, y: c.y };
		},
	},
	{
		id: 'node.addIcon',
		title: 'New icon',
		when: (_s, _k) => true,
		run: (s, a: { icon?: string } | undefined) => {
			if (!a?.icon) return;
			const id = s.newId(),
				c = s.centre();
			s.pendingSelect([id]);
			return {
				op: 'addNode',
				kind: 'icon',
				id,
				icon: a.icon,
				x: c.x,
				y: c.y,
				width: 8,
				minh: 8,
				title: '',
				cat: '',
				layer: s.activeLayer,
			};
		},
	},
	{
		id: 'source.copy',
		title: 'Copy TikZ source',
		when: () => true,
		run: (s) => s.send({ type: 'copy' }),
	},
	{
		id: 'source.copyPreamble',
		title: 'Copy preamble',
		when: () => true,
		run: (s) => s.send({ type: 'copyText', text: s.preambleText() }),
	},
	{
		id: 'figure.exportSvg',
		title: 'Export SVG',
		when: () => true,
		run: (s) => s.send({ type: 'exportSvg' }),
	},
];
