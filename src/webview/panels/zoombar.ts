import { exportTextPt } from '../../core/model/export';
import { naturalWidth } from '../../core/geometry/export';
import { geo } from '../store/geometry';
import { renderView } from '../render/scene';
import { store } from '../store/store';
import { calls } from '../store/calls';
import { resetToAuto } from '../commands/styles';
import { etools, svg } from '../platform/dom';
import { ICON, PX_PER_MM } from '../store/constants';
import { post, px, py } from '../store/model';
import { buildRow } from './inspector/build';
import { ARROW_MORE } from './inspector/specs';
import type { Selection } from './inspector/selection';
import { ObjectSubject } from './inspector/subject';

export function showToolbar(i: number, G: { label: number[] }) {
	const e = store.edges[i];
	const r = svg.getBoundingClientRect();
	const route = ['hvh', 'vhv', 'bend'].includes(e.route) ? 'fixed' : e.route;
	const buttons: ([string, string, string, string] | null)[] = [
		['route', 'auto', '↶', 'Reset to auto'],
		['route', 'straight', ICON.straight, 'Straight'],
		['route', 'manhattan', ICON.manhattan, 'Manhattan'],
		['route', 'curved', ICON.curved, 'Curved'],
		['route', 'u', 'U', 'U route'],
		null,
		['head', 'end', ICON.end, 'Head at the end'],
		['head', 'both', ICON.both, 'Heads at both ends'],
		['head', 'none', ICON.none, 'No head'],
		null,
		['kind', 'arr-dashed', ICON.dashed, 'Dashed'],
	];
	const wasOpen = !!etools.querySelector('details[open]');
	etools.replaceChildren();
	for (const b of buttons) {
		if (!b) {
			const sep = document.createElement('span');
			sep.className = 'sep';
			etools.appendChild(sep);
			continue;
		}
		const [prop, value, icon, title] = b;
		const btn = document.createElement('button');
		btn.title = title;
		btn.innerHTML = icon.startsWith('<')
			? `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4">${icon}</svg>`
			: icon;
		const active = prop === 'route' ? route === value : e[prop as 'kind' | 'head'] === value;
		if (active) {
			btn.classList.add('on');
		}
		btn.addEventListener('pointerdown', (ev) => ev.stopPropagation());
		btn.addEventListener('click', () => {
			if (prop === 'route' && value === 'auto') {
				resetToAuto(store.selE.size ? [...store.selE] : [i]);
				return;
			}
			const v = prop === 'kind' ? (e.kind === 'arr-dashed' ? 'arr' : 'arr-dashed') : value;
			post({ op: 'arrow', index: i, [prop]: v, ...(prop === 'route' ? { mid: null, bend: 0 } : {}) });
		});
		etools.appendChild(btn);
	}
	const more = document.createElement('details');
	more.open = wasOpen;
	const summary = document.createElement('summary');
	summary.textContent = 'More';
	more.appendChild(summary);
	const panel = document.createElement('div');
	panel.className = 'arrow-more';
	const sel: Selection = {
		mode: 'arrow',
		nodes: [],
		edges: [{ e, i }],
		layers: [],
		attached: null,
		count: 1,
		edge: { e, i },
	};
	const ctx = { sel, subject: ObjectSubject.of(sel), refresh: () => {} };
	for (const spec of ARROW_MORE) {
		const row = buildRow(ctx, spec);
		if (row) panel.appendChild(row.el);
	}
	more.appendChild(panel);
	etools.appendChild(more);
	etools.style.display = 'flex';
	const x = r.left + px(G.label[0]),
		y = r.top + py(G.label[1]);
	etools.style.left = `${Math.max(r.left + 4, Math.min(x - etools.offsetWidth / 2, r.right - etools.offsetWidth - 4))}px`;
	etools.style.top = `${Math.max(r.top + 4, y - etools.offsetHeight - 14)}px`;
}
export function updateZoombar() {
	const z = document.getElementById('zoombar');
	if (!z) {
		return;
	}
	const pt = exportTextPt(store.exportTarget, naturalWidth(geo()), store.figureFont);
	const label = document.getElementById('zi-size')!;
	label.textContent = `export ${store.exportTarget.width} mm · text ${Math.round(pt * 10) / 10} pt`;
	label.style.color = pt < 7 ? 'var(--vscode-editorWarning-foreground, #b78000)' : '';
	const warning = document.getElementById('export-warning');
	if (warning) warning.textContent = pt < 7 ? 'does not fit this width legibly: use full width or rearrange' : '';
	const toggle = document.getElementById('target-band');
	if (toggle) {
		toggle.setAttribute('aria-pressed', String(store.targetBand));
		toggle.onclick = () => {
			store.targetBand = !store.targetBand;
			renderView();
		};
	}
	document.getElementById('zi-zoom')!.textContent = `${Math.round((store.view.s / PX_PER_MM) * 100)} %`;
}
calls.updateZoombar = updateZoombar;
calls.showToolbar = showToolbar;
