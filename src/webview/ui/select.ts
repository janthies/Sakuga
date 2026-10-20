import { ControlState, Field, Mixed, h, isMixed } from './control';

export interface SelectOption<V extends string> {
	value: V;
	label: string;
}

// A native drop-down. The mixed state adds a "(mixed)" entry that cannot be chosen again.
export class SelectControl<V extends string> extends Field<V> {
	readonly el: HTMLSelectElement;

	constructor(
		private options: SelectOption<V>[],
		ariaLabel = '',
	) {
		super();
		this.el = h('select', '', { 'aria-label': ariaLabel || undefined });
		for (const o of options) this.el.add(new Option(o.label, o.value));
		this.el.onchange = () => {
			if (this.el.value !== '*') this.commit(this.el.value as V);
		};
	}

	set(value: V | Mixed, state?: ControlState): void {
		this.el.querySelectorAll('option[data-extra]').forEach((o) => o.remove());
		if (isMixed(value)) {
			this.addExtra('(mixed)', '*', 0);
			this.el.value = '*';
		} else {
			// A value the list does not know (a hand-set route) is still shown rather than silently replaced.
			if (!this.options.some((o) => o.value === value)) this.addExtra(value || 'default', value);
			this.el.value = value;
		}
		this.mark(state);
	}

	private addExtra(label: string, value: string, at?: number): void {
		const o = new Option(label, value);
		o.dataset.extra = '';
		this.el.add(o, at);
	}
}
