import { store } from '../store/store';

export function closeFloating(restore = true) {
	if (!store.floating) {
		return;
	}
	const { panel, anchor } = store.floating;
	panel.hidden = true;
	anchor.setAttribute('aria-expanded', 'false');
	store.floating = null;
	if (restore && anchor.isConnected) {
		anchor.focus();
	}
}
export function floatAt(panel: HTMLElement, anchor: HTMLElement) {
	closeFloating(false);
	panel.hidden = false;
	anchor.setAttribute('aria-expanded', 'true');
	store.floating = { panel, anchor };
	const r = anchor.getBoundingClientRect(),
		b = panel.getBoundingClientRect();
	panel.style.left = `${Math.max(4, Math.min(r.left, innerWidth - b.width - 4))}px`;
	panel.style.top = `${Math.max(4, Math.min(r.bottom + 4, innerHeight - b.height - 4))}px`;
}

const outside = (target: EventTarget | null) =>
	!!store.floating &&
	!store.floating.panel.contains(target as Node | null) &&
	!store.floating.anchor.contains(target as Node | null);

export function initUiFloating() {
	document.addEventListener('pointerdown', (e) => {
		if (outside(e.target)) {
			closeFloating(false);
		}
	});
	document.addEventListener(
		'keydown',
		(e) => {
			if (store.floating && e.key === 'Escape') {
				e.preventDefault();
				e.stopImmediatePropagation();
				closeFloating();
			}
		},
		true,
	);
	document.addEventListener('focusin', (e) => {
		if (outside(e.target)) {
			closeFloating(false);
		}
	});
	window.addEventListener('resize', () => closeFloating(false));
}
