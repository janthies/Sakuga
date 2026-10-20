// @ts-nocheck
import { store } from '../store/store';
import { fit } from '../tools/canvas';
import { render } from '../render/scene';
import { $, src, svg } from '../platform/dom';
import { newId } from '../store/layers';
import { post, snap } from '../store/model';
import { iconPicker } from '../ui/iconpicker';
import { vscode } from '../platform/host';

export function showText(t) {
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

export function initCommandsToolbar() {
	document.getElementById('fitw').addEventListener('click', () => {
		store.moved = false;
		fit();
		render();
	});
	document.getElementById('addLabel').addEventListener('click', () => {
		const r = svg.getBoundingClientRect(),
			id = newId();
		store.pendingEdit = id;
		post({
			op: 'addNode',
			kind: 'label',
			id,
			title: 'Label',
			cat: '',
			width: 18,
			x: snap((r.width / 2 - store.view.ox) / store.view.s),
			y: snap((store.view.oy - r.height / 2) / store.view.s),
		});
	});
	document.getElementById('addIcon').append(
		iconPicker('', (icon) => {
			if (!icon) {
				return;
			}
			const r = svg.getBoundingClientRect(),
				id = newId();
			store.pendingSelect = [id];
			post({
				op: 'addNode',
				kind: 'icon',
				id,
				icon,
				x: snap((r.width / 2 - store.view.ox) / store.view.s),
				y: snap((store.view.oy - r.height / 2) / store.view.s),
				width: 8,
				minh: 8,
				title: '',
				cat: '',
				layer: store.activeLayer,
			});
		}),
	);
	document.getElementById('copySrc').addEventListener('click', () => vscode.postMessage({ type: 'copy' }));
	document.getElementById('exportSvg').addEventListener('click', () => vscode.postMessage({ type: 'exportSvg' }));
	document
		.getElementById('copyPre')
		.addEventListener('click', () =>
			vscode.postMessage({ type: 'copyText', text: document.getElementById('pre').textContent }),
		);
	src.addEventListener('input', () => {
		clearTimeout(store.timer);
		store.timer = setTimeout(() => {
			store.sent = src.value;
			vscode.postMessage({ type: 'text', text: src.value });
		}, 200);
	});
	$('addBox').addEventListener('click', () => document.querySelector('.lc-obj')?.click());
}
