import { interactionCommands } from './interaction';
import { appCommands, clipboardCommands } from './app';
import { editCommands } from './edit';
import { layerCommands } from './layers';
import { formatKey, matchKey } from './keys';
import { selectionCommands } from './selection';
import { sketchCommands } from './sketch';
import { GESTURE_HELP } from '../../tools/help';
import type { AppState, Command, KeyInfo } from './types';

export type { AppState, Command, KeyInfo, Op } from './types';
export { SKETCH_CONTROLS } from './sketch';

const all = [
	...interactionCommands,
	...sketchCommands,
	...layerCommands,
	...selectionCommands,
	...editCommands,
	...appCommands,
	...clipboardCommands,
];

// The first command whose key matches and whose `when` holds runs, so this order is the priority of the keyboard.
// It is the order of the old keydown handler: tidy and alignment, layers and styles, groups, select all, duplicate,
// fit, editing keys, box styles, nudging, arrow keys, delete, clear, and last typing into a box.
const PRIORITY = [
	...sketchCommands.map((c) => c.id),
	'layer.up',
	'layer.down',
	'style.copy',
	'style.paste',
	'group.ungroup',
	'group.group',
	'selection.all',
	'selection.duplicate',
	'view.fit',
	'box.next',
	'box.edit',
	'selection.category',
	'selection.nudge',
	'arrow.route',
	'arrow.dashed',
	'selection.delete',
	'selection.clear',
	'box.type',
];
export const commands: Command[] = [
	...PRIORITY.map((id) => all.find((c) => c.id === id) as Command),
	...all.filter((c) => !PRIORITY.includes(c.id)),
];

export const commandById = (id: string): Command | undefined => commands.find((c) => c.id === id);

/** The command a keydown triggers, or undefined. */
export function commandForKey(s: AppState, k: KeyInfo): Command | undefined {
	return commands.find((c) => !c.native && c.keys?.some((p) => matchKey(p, k)) && c.when(s, k));
}

/** Run a command by id (toolbar, wheel, VS Code message); the returned op is posted. False if there is no such command. */
export function runCommand(s: AppState, id: string, args?: any): boolean {
	const c = commandById(id);
	if (!c || !c.when(s, args)) return false;
	const op = c.run(s, args);
	if (op) s.post(op);
	return true;
}

/** The rows of the "?" table: gestures of the tools and shortcuts of the commands, in one order. */
export function helpRows(): [string, string][] {
	const rows = [
		...GESTURE_HELP,
		...commands.flatMap((c) =>
			c.help
				? [
						{
							at: c.help.at,
							keys: c.help.keys ?? (c.keys ?? []).map(formatKey).join(', '),
							text: c.help.text ?? c.title,
						},
					]
				: [],
		),
	];
	return rows.sort((a, b) => a.at - b.at).map((r) => [r.keys, r.text]);
}
