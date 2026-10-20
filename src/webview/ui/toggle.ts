import { ControlState, Field, Mixed, h, isMixed } from './control';
import { choiceGlyph } from './glyph';

export interface ToggleOptions {
	// A pressed-button toggle with the glyph of this key (bold, italic); without it a checkbox.
	glyph?: string;
	label: string;
	// Adds a button that clears the value so it is inherited again.
	inherit?: boolean;
}

// An on/off control. undefined (not set) is a third state when `inherit` is on.
export class Toggle extends Field<boolean | undefined> {
	readonly el: HTMLElement;
	private readonly box?: HTMLInputElement;
	private readonly button?: HTMLButtonElement;
	private readonly reset?: HTMLButtonElement;
	private on = false;

	constructor(o: ToggleOptions) {
		super();
		if (o.glyph) {
			this.el = h('div', 'segments', { role: 'group', 'aria-label': o.label });
			if (o.inherit) {
				this.reset = h('button', '', { type: 'button', title: 'Inherit', 'aria-label': 'Inherit ' + o.label }, '↶');
				this.reset.onclick = () => this.commit(null);
				this.el.append(this.reset);
			}
			this.button = h('button', '', { type: 'button', title: o.label, 'aria-label': o.label });
			this.button.innerHTML = choiceGlyph(o.glyph, o.label);
			this.button.onclick = () => this.commit(!this.on);
			this.el.append(this.button);
		} else {
			this.box = h('input', '', { type: 'checkbox', 'aria-label': o.label });
			this.box.onchange = () => this.commit(this.box!.checked);
			this.el = this.box;
		}
	}

	set(value: boolean | undefined | Mixed, state?: ControlState): void {
		const mixed = isMixed(value);
		this.on = !mixed && !!value;
		if (this.box) {
			this.box.checked = this.on;
			this.box.indeterminate = mixed;
		}
		this.button?.setAttribute('aria-pressed', mixed ? 'mixed' : String(this.on));
		this.reset?.setAttribute('aria-pressed', String(!mixed && value === undefined));
		this.mark(state);
	}
}
