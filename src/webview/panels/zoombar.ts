// @ts-nocheck
import { store } from '../store/store';
import { calls } from '../store/calls';
import { copyStyle, nextStep, pasteStyle, resetToAuto, sourceColour } from '../commands/styles';
import { etools, svg } from '../platform/dom';
import { ICON, PX_PER_MM } from '../store/constants';
import { post, px, py } from '../store/model';
import { styleFields, styleSelect } from '../ui/stylecontrols';
import { numberControl } from '../ui/controls';
import { contentBox } from '../render/boxes';

export function showToolbar(i, G) {
	const e = store.edges[i];
	const r = svg.getBoundingClientRect();
	const route = ['hvh', 'vhv', 'bend'].includes(e.route) ? 'fixed' : e.route;
	const buttons = [
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
		const active = prop === 'route' ? route === value : e[prop] === value;
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
	for (const [name, prop, values] of styleFields(true)) {
		const label = document.createElement('label');
		label.textContent = name;
		label.appendChild(styleSelect(prop, values, [e], (style) => post({ op: 'style', indices: [i], style })));
		panel.appendChild(label);
	}
	const stepLabel = document.createElement('label');
	stepLabel.textContent = 'Step';
	stepLabel.appendChild(
		numberControl(e.style?.step, (v) => post({ op: 'style', indices: [i], style: { step: v || 0 } }), {
			step: 1,
			min: 1,
			placeholder: String(nextStep()),
		}),
	);
	panel.appendChild(stepLabel);
	const addStep = document.createElement('button');
	addStep.textContent = 'Set next step';
	addStep.onclick = () => post({ op: 'style', indices: [i], style: { step: nextStep() } });
	panel.appendChild(addStep);
	const colour = document.createElement('button');
	colour.textContent = 'Colour from source';
	colour.onclick = () => sourceColour([i]);
	panel.appendChild(colour);
	styleButtons(panel);
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
	const C = contentBox();
	document.getElementById('zi-size').textContent = store.nodes.length
		? `Figure ${Math.round(C.x1 - C.x0)} \u00d7 ${Math.round(C.y1 - C.y0)} mm`
		: 'Empty figure';
	document.getElementById('zi-zoom').textContent = `${Math.round((store.view.s / PX_PER_MM) * 100)} %`;
}
function styleButtons(parent) {
	const wrap = document.createElement('div');
	wrap.className = 'buttons';
	for (const [name, fn] of [
		['Copy style', copyStyle],
		['Paste style', pasteStyle],
	]) {
		const b = document.createElement('button');
		b.textContent = name;
		b.disabled = name === 'Paste style' && !store.styleClip;
		b.addEventListener('click', fn);
		wrap.appendChild(b);
	}
	parent.appendChild(wrap);
}

calls.updateZoombar = updateZoombar;
calls.showToolbar = showToolbar;
