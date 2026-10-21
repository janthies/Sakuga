import { Control } from './control';
import { NumberControl } from './number';
import { h } from './control';

// One line of the inspector: a label in the fixed label column and the controls of the row after it.
// A row that overrides its style gets a bar in the margin and a reset button.
export class Row {
	readonly el: HTMLDivElement;
	readonly labelEl: HTMLSpanElement;

	constructor(
		readonly label: string,
		readonly controls: Control<any>[],
		className = '',
	) {
		this.labelEl = h('span', '', {}, label);
		this.el = h('div', ('row ' + className).trim(), {}, this.labelEl);
		if (controls.length === 1) this.el.append(controls[0].el);
		else this.el.append(h('div', 'fields', {}, ...controls.map((c) => c.el)));
		// A lone number is scrubbed by dragging the row label; several numbers carry their own handles.
		const [only] = controls;
		if (controls.length === 1 && only instanceof NumberControl) only.scrub(this.labelEl, label);
		for (const c of controls) {
			const field = c.el instanceof HTMLInputElement || c.el instanceof HTMLSelectElement ? c.el : null;
			if (field && !field.getAttribute('aria-label')) field.setAttribute('aria-label', label);
		}
	}

	// The row differs from the style: show it, and let the reset button bring the style back.
	override(reset: () => void): void {
		this.el.classList.add('overridden');
		const b = h(
			'button',
			'reset-prop',
			{ type: 'button', title: 'Reset to inherited value', 'aria-label': 'Reset ' + this.label },
			'×',
		);
		b.onclick = reset;
		this.el.append(b);
	}
}
