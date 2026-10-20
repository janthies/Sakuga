// @ts-nocheck
import { store } from '../store/store';
import { calls } from '../store/calls';
import { helpRows } from '../commands/registry';
import { $ } from '../platform/dom';
import { persist } from '../store/prefs';
import { vscode } from '../platform/host';

export function setTab(t, save = true) {
	store.tab = t;
	$('sidebar').dataset.tab = t;
	for (const b of document.querySelectorAll('#tabs [role=tab]')) {
		b.setAttribute('aria-selected', String(b.dataset.tab === t));
		b.tabIndex = b.dataset.tab === t ? 0 : -1;
	}
	if (save) {
		persist({ tab: t });
	}
}
function setDrawer(open, save = true) {
	$('drawer').classList.toggle('open', open);
	$('drawerToggle').setAttribute('aria-pressed', String(open));
	$('drawerToggle').setAttribute('aria-expanded', String(open));
	$('drawer').inert = !open;
	if (save) {
		persist({ drawer: open });
	}
}
const split = $('splitter');
const keys = document.getElementById('keys');

calls.setTab = setTab;

export function initPanelsChrome() {
	for (const b of document.querySelectorAll('#tabs [role=tab]')) {
		b.addEventListener('click', () => setTab(b.dataset.tab));
		b.addEventListener('keydown', (ev) => {
			if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
			ev.preventDefault();
			const next =
				ev.key === 'Home' ? 'figure' : ev.key === 'End' ? 'selection' : store.tab === 'figure' ? 'selection' : 'figure';
			setTab(next);
			document.querySelector('#tabs [data-tab=' + next + ']').focus();
		});
	}
	setTab(store.tab, false);
	$('drawerToggle').addEventListener('click', () => setDrawer(!$('drawer').classList.contains('open')));
	setDrawer(!!(vscode.getState() || {}).drawer, false);
	if (split) {
		const lay = $('layers');
		const h0 = (vscode.getState() || {}).layersH;
		if (h0) {
			lay.style.height = h0 + 'px';
		}
		split.addEventListener('pointerdown', (ev) => {
			split.setPointerCapture(ev.pointerId);
			const y0 = ev.clientY,
				hh = lay.offsetHeight,
				max = $('sidebar').clientHeight - 34 - 160;
			const mv = (e) => {
				lay.style.height = Math.max(96, Math.min(max, hh + y0 - e.clientY)) + 'px';
			};
			const up = () => {
				split.removeEventListener('pointermove', mv);
				split.removeEventListener('pointerup', up);
				split.removeEventListener('pointercancel', up);
				persist({ layersH: lay.offsetHeight });
			};
			split.addEventListener('pointermove', mv);
			split.addEventListener('pointerup', up);
			split.addEventListener('pointercancel', up);
		});
		split.addEventListener('keydown', (ev) => {
			if (!['ArrowUp', 'ArrowDown', 'Home'].includes(ev.key)) return;
			ev.preventDefault();
			lay.style.height =
				ev.key === 'Home'
					? ''
					: Math.max(
							96,
							Math.min($('sidebar').clientHeight - 194, lay.offsetHeight + (ev.key === 'ArrowUp' ? 16 : -16)),
						) + 'px';
			persist({ layersH: ev.key === 'Home' ? 0 : lay.offsetHeight });
		});
		split.addEventListener('dblclick', () => {
			lay.style.height = '';
			persist({ layersH: 0 });
		});
	}
	for (const [k, v] of helpRows()) {
		const tr = document.createElement('tr');
		const a = document.createElement('td');
		const b = document.createElement('td');
		a.textContent = k;
		b.textContent = v;
		tr.append(a, b);
		keys.appendChild(tr);
	}
}
