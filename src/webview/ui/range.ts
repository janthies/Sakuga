import { ControlState, Field, Mixed, h, isMixed } from './control';

// A slider with a number field beside it, in percent. `onPreview` fires while the slider moves.
export class RangeControl extends Field<number> {
	readonly el: HTMLElement;
	private readonly slider: HTMLInputElement;
	private readonly number: HTMLInputElement;
	private accepted: number | undefined;
	private previews: ((value: number) => void)[] = [];

	constructor(label: string) {
		super();
		this.slider = h('input', '', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': label });
		this.number = h('input', '', { type: 'number', min: 0, max: 100, step: 1, 'aria-label': label });
		this.el = h('span', 'range', {}, this.slider, this.number, h('span', 'unit', {}, '%'));
		this.slider.oninput = () => {
			this.number.value = this.slider.value;
			for (const f of this.previews) f(+this.slider.value);
		};
		this.slider.onchange = () => this.accept(this.slider, true);
		this.number.onchange = () => this.accept(this.number);
		this.number.onblur = () => this.accept(this.number);
		this.number.onkeydown = (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.accept(this.number);
			}
		};
	}

	onPreview(f: (value: number) => void): void {
		this.previews.push(f);
	}

	set(value: number | Mixed, state?: ControlState): void {
		const mixed = isMixed(value);
		this.slider.value = mixed ? '100' : String(value);
		this.slider.title = mixed ? 'Mixed' : '';
		this.number.value = mixed ? '' : String(value);
		this.number.placeholder = mixed ? 'Mixed' : '';
		this.accepted = mixed ? undefined : (value as number);
		this.mark(state);
	}

	private accept(control: HTMLInputElement, force = false): void {
		if (control.value === '' || !Number.isFinite(+control.value)) return;
		const value = Math.max(0, Math.min(100, +control.value));
		this.slider.value = this.number.value = String(value);
		if (!force && value === this.accepted) return;
		this.accepted = value;
		this.commit(value);
	}
}
