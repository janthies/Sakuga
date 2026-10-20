import { Control, h } from './control';

export interface Action {
	label: string;
	title?: string;
	// Replaces the label with an icon (a bare SVG path).
	svg?: string;
	disabled?: boolean;
	run(button: HTMLButtonElement): void;
	// Extra listeners (the tidy preview follows the pointer).
	hover?: { enter(): void; leave(): void };
}

// A row of buttons that run commands. It holds no value.
export class Actions implements Control<never> {
	readonly el: HTMLElement;

	constructor(actions: Action[], className = 'buttons', ariaLabel?: string) {
		this.el = h('div', className, ariaLabel ? { role: 'group', 'aria-label': ariaLabel } : {});
		for (const a of actions) {
			const b = h('button', '', { type: 'button', title: a.title });
			if (a.svg) {
				b.innerHTML = a.svg;
				b.setAttribute('aria-label', a.title || a.label);
			} else {
				b.textContent = a.label;
			}
			b.disabled = !!a.disabled;
			b.onclick = () => a.run(b);
			if (a.hover) {
				b.onmouseenter = a.hover.enter;
				b.onmouseleave = a.hover.leave;
			}
			this.el.append(b);
		}
	}

	set(): void {}
	onCommit(): void {}
}
