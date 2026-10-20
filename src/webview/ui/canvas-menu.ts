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
	const open = (screen: Point, wheel = false) => {
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
			b.textContent = title;
			b.setAttribute('role', 'menuitem');
			b.onclick = () => {
				closeFloating(false);
				run(id, { p, ...args });
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
			button(panel, 'Group', 'group.group');
			button(panel, 'Line', 'create.line');
			button(panel, 'Icon', 'create.icon');
		} else {
			button(panel, 'Add label', 'create.text', { attach: true });
			button(panel, 'Add icon', 'create.icon', { attach: true });
			for (const [label, id] of [
				['Group selection (Ctrl+G)', 'group.group'],
				['Ungroup', 'group.ungroup'],
				['Detach from parent', 'selection.detach'],
				['Reset look', 'selection.resetLook'],
				['Apply look to category', 'selection.applyLook'],
			])
				button(panel, label, id);
			submenu('Align', [
				['Left', 'sketch.left'],
				['Centre horizontally', 'sketch.centerX'],
				['Right', 'sketch.right'],
				['Top', 'sketch.top'],
				['Centre vertically', 'sketch.centerY'],
				['Bottom', 'sketch.bottom'],
			]);
			submenu('Distribute', [
				['Horizontal gaps', 'sketch.distributeX'],
				['Vertical gaps', 'sketch.distributeY'],
			]);
			submenu('Same size', [
				['Width', 'sketch.sameW'],
				['Height', 'sketch.sameH'],
			]);
			button(panel, 'Tidy up', 'sketch.tidy');
			submenu(
				'Move to layer',
				store.layers.map((l) => [l.name, 'selection.toLayer', { layer: l.id }]),
			);
			button(panel, 'Bring forward', 'selection.forward');
			button(panel, 'Send backward', 'selection.backward');
			button(panel, 'Send to back', 'selection.back');
			button(panel, 'Delete', 'selection.delete');
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
		open({ x: e.clientX, y: e.clientY });
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
