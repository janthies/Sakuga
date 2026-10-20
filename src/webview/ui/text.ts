import { ControlState, Field, Mixed, h, isMixed } from './control';

// A single-line text field; mixed shows an empty field that says so.
export class TextControl extends Field<string> {
	readonly el: HTMLInputElement;
	private readonly placeholder: string;

	constructor(o: { mono?: boolean; ariaLabel?: string; placeholder?: string } = {}) {
		super();
		this.placeholder = o.placeholder ?? '';
		this.el = h('input', o.mono ? 'mono' : '', { type: 'text', 'aria-label': o.ariaLabel, placeholder: o.placeholder });
		this.el.addEventListener('change', () => this.commit(this.el.value));
	}

	set(value: string | Mixed, state?: ControlState): void {
		const mixed = isMixed(value);
		this.el.value = mixed ? '' : value;
		this.el.placeholder = mixed ? 'Mixed' : this.placeholder;
		this.mark(state);
	}
}
