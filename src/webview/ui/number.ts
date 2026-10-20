import { ControlState, Field, Mixed, h, isMixed } from './control';

export interface NumberOptions {
	step?: number;
	min?: number;
	max?: number;
	// Shown after the field ("mm", "pt", "%").
	unit?: string;
	// A short label inside the field; dragging it scrubs the value (X, Y, W, H).
	prefix?: string;
	placeholder?: string;
	ariaLabel?: string;
}

// A number field. Empty means "none"; the mixed state is an empty field that says so.
export class NumberControl extends Field<number | null> {
	readonly el: HTMLElement;
	readonly input: HTMLInputElement;
	private prefixEl?: HTMLElement;
	private readonly step: number;
	private readonly min: number;
	private readonly max: number;
	private readonly placeholder: string;

	constructor(o: NumberOptions = {}) {
		super();
		this.step = o.step ?? 0.05;
		this.min = o.min ?? -Infinity;
		this.max = o.max ?? Infinity;
		this.placeholder = o.placeholder ?? '';
		this.input = h('input', '', { type: 'number', step: this.step, 'aria-label': o.ariaLabel });
		if (Number.isFinite(this.min)) this.input.min = String(this.min);
		if (Number.isFinite(this.max)) this.input.max = String(this.max);
		this.input.placeholder = this.placeholder;
		this.input.addEventListener('change', () => this.accept());
		this.el = h('span', 'num');
		if (o.prefix) {
			this.prefixEl = h('span', 'num-prefix', {}, o.prefix);
			this.el.append(this.prefixEl);
			this.scrub(this.prefixEl, o.ariaLabel || o.prefix);
		}
		this.el.append(this.input);
		if (o.unit) this.el.append(h('span', 'unit', {}, o.unit));
	}

	set(value: number | null | Mixed, state?: ControlState): void {
		const mixed = isMixed(value);
		this.input.value = mixed || value === null || value === undefined ? '' : String(value);
		this.input.placeholder = mixed ? 'Mixed' : this.placeholder;
		this.mark(state);
	}

	// Validate what was typed (or scrubbed) and report it.
	private accept(): void {
		const v = this.input.value === '' ? null : +this.input.value;
		if (
			v === null ||
			(Number.isFinite(v) && v >= this.min && v <= this.max && (this.step !== 1 || Number.isInteger(v)))
		) {
			this.commit(v);
		}
	}

	// Dragging `handle` sideways changes the value by one step per 4 px and commits on release.
	scrub(handle: HTMLElement, name: string): void {
		handle.classList.add('scrub');
		handle.title = 'Drag to adjust ' + name;
		handle.onpointerdown = (ev) => {
			if (ev.button !== 0) return;
			ev.preventDefault();
			handle.setPointerCapture?.(ev.pointerId);
			const x = ev.clientX;
			const initial = +this.input.value || 0;
			const move = (e: PointerEvent) => {
				const v = initial + Math.round((e.clientX - x) / 4) * this.step;
				this.input.value = String(Math.max(this.min, Math.min(this.max, +v.toFixed(3))));
			};
			const end = () => {
				handle.removeEventListener('pointermove', move);
				handle.removeEventListener('pointerup', end);
				handle.removeEventListener('pointercancel', end);
				this.accept();
			};
			handle.addEventListener('pointermove', move);
			handle.addEventListener('pointerup', end);
			handle.addEventListener('pointercancel', end);
		};
	}
}
