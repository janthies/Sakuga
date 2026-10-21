import { hitOf } from '../render/hit';
import { selectLayer } from '../store/layers';
import { render } from '../render/scene';
import { store } from '../store/store';
import { calls } from '../store/calls';
import { svg } from '../platform/dom';
import { closeFloating, floatAt } from './floating';
import { iconPicker } from './iconpicker';

type Point = { x: number; y: number };
type Run = (id: string, args?: any) => boolean;
export function initCanvasMenus(run: Run) {
	const anchor = document.createElement('button');
	anchor.className = 'canvas-menu-anchor';
	anchor.tabIndex = -1;
	const panel = document.createElement('div');
	panel.className = 'floating-picker canvas-menu';
	panel.hidden = true;
	document.body.append(anchor, panel);
	let mouse: Point = { x: 0, y: 0 };
	svg.addEventListener('pointermove', (e) => {
		mouse = { x: e.clientX, y: e.clientY };
	});
	const mm = (p: Point) => {
		const r = svg.getBoundingClientRect();
		return { x: (p.x - r.left - store.view.ox) / store.view.s, y: (store.view.oy - p.y + r.top) / store.view.s };
	};
	const open = (screen: Point, wheel = false, item = false) => {
		const p = mm(screen);
		panel.replaceChildren();
		panel.classList.toggle('creation-wheel', wheel);
		panel.setAttribute('role', 'menu');
		panel.setAttribute('aria-label', wheel ? 'Create item' : 'Selection actions');
		anchor.style.left = `${screen.x}px`;
		anchor.style.top = `${screen.y}px`;
		const button = (parent: HTMLElement, title: string, id: string, args: any = {}) => {
			const b = document.createElement('button');
			b.type = 'button';
			const [label, shortcut = '—'] = title.split('\t');
			b.textContent = label;
			const key = document.createElement('span');
			key.className = 'menu-shortcut';
			key.textContent = shortcut === '—' ? '' : shortcut;
			if (!wheel) b.append(key);
			b.title = label;
			b.setAttribute('role', 'menuitem');
			b.onclick = async () => {
				closeFloating(false);
				if (id === 'clipboard.paste') {
					const text = await navigator.clipboard.readText();
					run(id, { clipboardData: { getData: () => text }, preventDefault() {} });
				} else {
					if (id === 'sketch.tidy' && !item) {
						store.selN = new Set();
						store.selE.clear();
						store.selG = null;
						store.selectedLayers.clear();
					}
					run(id, { p, ...args });
				}
			};
			parent.append(b);
			return b;
		};
		const submenu = (title: string, items: [string, string, any?][]) => {
			const details = document.createElement('details'),
				summary = document.createElement('summary');
			summary.textContent = title;
			details.append(summary);
			for (const [label, id, args] of items) button(details, label, id, args);
			panel.append(details);
		};
		if (wheel) {
			button(panel, 'Box', 'create.shape');
			button(panel, 'Label', 'create.text');
			button(panel, 'Line', 'create.line');
			button(panel, 'Icon', 'create.icon');
		} else if (item) {
			button(panel, 'Edit label\tEnter', 'box.edit');
			button(panel, 'Add label', 'create.text', { attach: true });
			button(panel, 'Add icon', 'create.icon', { attach: true });
			submenu('Category', [
				['None', 'selection.setCategory', { category: '' }],
				...store.cats.map((c, i): [string, string, any] => [
					`${c.name}\t${i < 9 ? i + 1 : '—'}`,
					'selection.setCategory',
					{ category: c.key },
				]),
			]);
			button(panel, 'Group\tCtrl+G', 'group.group');
			button(panel, 'Ungroup / Detach\tCtrl+Shift+G', 'group.ungroup');
			submenu('Align', [
				['Left\tAlt+A', 'sketch.left'],
				['Centre horizontally\tAlt+C', 'sketch.centerX'],
				['Right\tAlt+D', 'sketch.right'],
				['Top\tAlt+W', 'sketch.top'],
				['Centre vertically\tAlt+V', 'sketch.centerY'],
				['Bottom\tAlt+S', 'sketch.bottom'],
			]);
			submenu('Distribute', [
				['Horizontal gaps\tAlt+X', 'sketch.distributeX'],
				['Vertical gaps\tAlt+Y', 'sketch.distributeY'],
			]);
			button(panel, 'Copy look\tCtrl+Alt+C', 'style.copy');
			button(panel, 'Paste look\tCtrl+Alt+V', 'style.paste');
			button(panel, 'Reset look', 'selection.resetLook');
			button(panel, 'Apply look to category', 'selection.applyLook');
			button(panel, 'Hide', 'selection.hide');
			button(panel, 'Lock', 'selection.lock');
			submenu(
				'Move to layer',
				store.layers.map((l) => [l.name, 'selection.toLayer', { layer: l.id }]),
			);
			button(panel, 'Bring forward', 'selection.forward');
			button(panel, 'Send backward', 'selection.backward');
			button(panel, 'Send to back', 'selection.back');
			button(panel, 'Delete\tDel', 'selection.delete');
		} else {
			button(panel, 'Box', 'create.shape');
			button(panel, 'Label', 'create.text');
			button(panel, 'Line', 'create.line');
			button(panel, 'Icon', 'create.icon');
			button(panel, 'Paste\tCtrl+V', 'clipboard.paste');
			button(panel, 'Select all\tCtrl+A', 'selection.all');
			button(panel, 'Tidy up figure\tAlt+T', 'sketch.tidy');
		}
		floatAt(panel, anchor);
		panel.querySelector('button')?.focus();
	};
	calls.openWheel = (p: Point = mouse) => open(p, true);
	calls.chooseCanvasIcon = (args: any) => {
		const picker = iconPicker('', (icon) => run('create.icon', { ...args, icon }));
		// Keep the palette's anchor mounted through its asynchronous choice.
		anchor.replaceChildren(picker);
		picker.click();
	};
	svg.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		const hit = hitOf(
			(e.target as Element)?.closest('[data-node],[data-text],[data-line],[data-edge],[data-group],[data-label]'),
		);
		let id: string | undefined;
		if (hit && 'id' in hit) id = hit.id;
		if (hit?.k === 'edge') id = store.edges[hit.index]?.id;
		if (hit?.k === 'label')
			id = store.items.find(
				(i) =>
					i.kind === 'Text' &&
					i.parent === (hit.ref.group || store.edges[hit.ref.index!]?.id) &&
					i.order === (hit.ref.slot === undefined ? 0 : hit.ref.slot + 1),
			)?.id;
		if (id) {
			const item = store.items.find((i) => i.id === id),
				ix = store.edges.findIndex((ed) => ed.id === id);
			if (!store.selN.has(id) && store.selG !== id && !(ix >= 0 && store.selE.has(ix))) {
				store.selN = new Set();
				store.selE.clear();
				store.selG = null;
				store.selectedLayers.clear();
				if (item?.kind === 'Frame') selectLayer(id);
				else if (ix >= 0) store.selE.add(ix);
				else store.selN.add(id);
				render();
			}
		}
		open({ x: e.clientX, y: e.clientY }, false, !!id);
	});
	let ctrlAt = 0;
	document.addEventListener(
		'keydown',
		(e) => {
			if (
				e.key === 'Control' &&
				!e.repeat &&
				!e.shiftKey &&
				!e.altKey &&
				!e.metaKey &&
				!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')
			)
				ctrlAt = performance.now();
			else ctrlAt = 0;
		},
		true,
	);
	document.addEventListener(
		'pointerdown',
		() => {
			ctrlAt = 0;
		},
		true,
	);
	document.addEventListener(
		'keyup',
		(e) => {
			if (e.key === 'Control') {
				if (ctrlAt && performance.now() - ctrlAt < 300) run('canvas.wheel', { screen: mouse });
				ctrlAt = 0;
			}
		},
		true,
	);
	window.addEventListener('blur', () => {
		ctrlAt = 0;
	});
}
