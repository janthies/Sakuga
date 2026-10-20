import { store } from '../store/store';
import { $, src } from '../platform/dom';
import { vscode } from '../platform/host';
import { appState } from './state';
import { runCommand } from './registry';

export function showText(t: string) {
	if (src.value === t) {
		return;
	}
	if (document.activeElement === src && store.sent !== null && src.value !== store.sent) {
		return;
	}
	const a = src.selectionStart,
		b = src.selectionEnd,
		top = src.scrollTop;
	src.value = t;
	src.setSelectionRange(Math.min(a, t.length), Math.min(b, t.length));
	src.scrollTop = top;
}

// The buttons of the bar and the drawer call commands by id.
export function initToolbar() {
	const bind = (button: string, id: string) => $(button).addEventListener('click', () => runCommand(appState, id));
	bind('fitw', 'view.fitWidth');
	bind('copySrc', 'source.copy');
	bind('exportSvg', 'figure.exportSvg');
	bind('copyPre', 'source.copyPreamble');
	bind('group', 'group.group');
	bind('ungroup', 'group.ungroup');
	src.addEventListener('input', () => {
		if (store.timer !== null) clearTimeout(store.timer);
		store.timer = setTimeout(() => {
			store.sent = src.value;
			vscode.postMessage({ type: 'text', text: src.value });
		}, 200);
	});
}
