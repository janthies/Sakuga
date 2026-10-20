import { store } from '../store/store';
import { svg } from '../platform/dom';
import { appState } from './state';
import { commandById, commandForKey, runCommand } from './registry';

// DOM events to commands: the keydown handler looks the key up in the registry, the clipboard events call the clipboard commands.
export function initKeyboard() {
	document.addEventListener('keydown', (ev) => {
		if (appState.blocked()) {
			return;
		}
		if (ev.key === ' ') {
			store.space = true;
			svg.classList.add('panning');
			ev.preventDefault();
			return;
		}
		if (ev.isComposing || ev.key === 'Dead' || ev.key === 'Process') {
			return;
		}
		const k = { key: ev.key, code: ev.code, ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey, alt: ev.altKey };
		const command = commandForKey(appState, k);
		if (ev.repeat && command?.id.startsWith('sketch.')) {
			ev.preventDefault();
			return;
		}
		if (!command) {
			return;
		}
		const op = command.run(appState, k);
		if (op) {
			appState.post(op);
		}
		ev.preventDefault();
	});
	document.addEventListener('keyup', (ev) => {
		if (ev.key === ' ') {
			store.space = false;
			svg.classList.remove('panning');
		}
	});
	// Ctrl+C, Ctrl+X and Ctrl+V reach the page as clipboard events; the clipboard holds TikZ lines.
	for (const [type, id] of [
		['copy', 'clipboard.copy'],
		['cut', 'clipboard.cut'],
		['paste', 'clipboard.paste'],
	]) {
		document.addEventListener(type, (ev) => {
			if (commandById(id)!.when(appState)) {
				commandById(id)!.run(appState, ev);
			}
		});
	}
}
