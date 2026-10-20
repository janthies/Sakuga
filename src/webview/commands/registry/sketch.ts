import type { Command } from './types';

// Align, distribute and size: [command, title, key, icon path]. The inspector draws the buttons from this list.
export const SKETCH_CONTROLS = [
	['left', 'Align left', 'Alt+A', 'M2 2v12 M4 5h8v2H4z M4 10h5v2H4z'],
	['centerX', 'Align horizontal centre', 'Alt+C', 'M8 1v14 M3 4h10v3H3z M5 10h6v3H5z'],
	['right', 'Align right', 'Alt+D', 'M14 2v12 M4 5h8v2H4z M7 10h5v2H7z'],
	['top', 'Align top', 'Alt+W', 'M2 2h12 M4 4h3v8H4z M10 4h3v5h-3z'],
	['centerY', 'Align vertical centre', 'Alt+V', 'M1 8h14 M3 3h3v10H3z M10 5h3v6h-3z'],
	['bottom', 'Align bottom', 'Alt+S', 'M2 14h12 M4 4h3v8H4z M10 7h3v5h-3z'],
	['distributeX', 'Distribute horizontal gaps', 'Alt+X', 'M1 3v10 M15 3v10 M3 6h2v4H3z M7 4h2v8H7z M11 6h2v4h-2z'],
	['distributeY', 'Distribute vertical gaps', 'Alt+Y', 'M3 1h10 M3 15h10 M6 3h4v2H6z M4 7h8v2H4z M6 11h4v2H6z'],
	['sameW', 'Same width', 'Alt+U', 'M2 3h12v3H2z M2 10h12v3H2z M2 8h12'],
	['sameH', 'Same height', 'Alt+B', 'M3 2h3v12H3z M10 2h3v12h-3z M8 2v12'],
];

const align: Command[] = SKETCH_CONTROLS.map(([command, title, key], i) => ({
	id: `sketch.${command}`,
	title,
	keys: [`alt+-shift+${key.slice(4).toLowerCase()}`],
	vscode: `sakuga.sketch.${command}`,
	help: { at: 24 + i, keys: key, text: title },
	when: () => true,
	run: (s) => {
		if (!s.blocked()) s.arrange(command);
	},
}));

// Arrange commands execute immediately, with one document operation.
export const sketchCommands: Command[] = [
	{
		id: 'sketch.tidy',
		title: 'Tidy up',
		keys: ['alt+-shift+t'],
		vscode: 'sakuga.sketch.tidy',
		help: { at: 23, keys: 'Alt+T', text: 'Tidy up' },
		when: () => true,
		run: (s) => {
			if (!s.blocked()) s.tidy.apply();
		},
	},
	...align,
];
