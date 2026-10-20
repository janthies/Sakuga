import { ControlState, Field, Mixed, h, isMixed } from './control';
import { closeFloating, floatAt } from './floating';
import { previewIcon } from './iconpicker';

export interface ChoiceOption {
	value: string;
	label: string;
	// A colour dot before the label.
	color?: string;
	// An icon (by name) before the label.
	icon?: string;
}

// A button that opens a list of options with a colour dot or an icon each; arrows, Home, End and letters move in it.
export class ChoiceControl extends Field<string> {
	readonly el: HTMLButtonElement;
	private value = '';
	private mixed = false;

	constructor(
		private options: ChoiceOption[],
		ariaLabel = '',
	) {
		super();
		this.el = h('button', 'visual-choice', {
			type: 'button',
			'aria-haspopup': 'listbox',
			'aria-expanded': 'false',
			'aria-label': ariaLabel || undefined,
		});
		this.el.onclick = () => this.open();
	}

	set(value: string | Mixed, state?: ControlState): void {
		this.mixed = isMixed(value);
		this.value = isMixed(value) ? '*' : value;
		this.el.replaceChildren();
		this.paint(
			this.el,
			this.mixed ? { value: '*', label: '(mixed)' } : this.options.find((o) => o.value === value) || this.options[0],
		);
		this.mark(state);
	}

	private paint(target: HTMLElement, option: ChoiceOption): void {
		if (option.color && !option.icon) {
			const dot = h('i', 'swatch');
			dot.style.background = option.color;
			target.append(dot);
		}
		if (option.icon) target.append(previewIcon(option.icon));
		target.append(h('span', '', {}, option.label));
	}

	private open(): void {
		const panel = h('div', 'floating-picker choice-panel', { role: 'listbox', 'aria-label': 'Choose value' });
		for (const o of this.options) {
			const item = h('button', '', { type: 'button', role: 'option', 'aria-selected': o.value === this.value });
			item.setAttribute('aria-selected', String(o.value === this.value));
			this.paint(item, o);
			item.onclick = () => {
				closeFloating();
				panel.remove();
				this.commit(o.value);
			};
			panel.append(item);
		}
		document.querySelectorAll('.choice-panel').forEach((p) => p.remove());
		document.body.append(panel);
		floatAt(panel, this.el);
		const items = [...panel.children] as HTMLElement[];
		(items[this.options.findIndex((o) => o.value === this.value)] || items[0]).focus();
		panel.onkeydown = (e) => {
			let i = items.indexOf(document.activeElement as HTMLElement);
			if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
				i =
					e.key === 'Home'
						? 0
						: e.key === 'End'
							? items.length - 1
							: (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
				items[i].focus();
				e.preventDefault();
				e.stopPropagation();
			} else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
				items.find((item) => (item.textContent || '').toLowerCase().startsWith(e.key.toLowerCase()))?.focus();
				e.stopPropagation();
			}
		};
	}
}
