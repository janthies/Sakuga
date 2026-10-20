import { ControlState, Field, MIXED, Mixed, h, isMixed } from './control';
import { NumberControl } from './number';
import { Segmented } from './segmented';

// What the control shows and what a commit changes: a named weight ('' = thin) or an explicit width in pt.
export interface WeightValue {
	weight?: string;
	lineWidth?: number;
}

const NAMED_WIDTH: Record<string, number> = { medium: 0.8, thick: 1.2 };
const THIN = 0.45;

// Line weight as thin / medium / thick, plus a width in pt on demand. A commit is the patch to apply.
export class WeightControl extends Field<WeightValue> {
	readonly el: HTMLElement;
	private readonly segments = new Segmented<string>(
		[
			{ value: '', label: 'Thin' },
			{ value: 'medium', label: 'Medium' },
			{ value: 'thick', label: 'Thick' },
		],
		'Line weight',
	);
	private readonly number = new NumberControl({ step: 0.05, min: 0.05, ariaLabel: 'Line width (pt)' });
	private readonly toggle = h(
		'button',
		'custom-toggle',
		{ type: 'button', title: 'Enter a line width in pt' },
		'custom',
	);

	constructor() {
		super();
		this.el = h('div', 'width-control', {}, this.segments.el, this.toggle, this.number.el);
		this.number.el.hidden = true;
		this.segments.onCommit((weight) => this.commit({ weight: weight ?? '' }));
		this.number.onCommit((v) => this.commit({ lineWidth: v ?? THIN }));
		this.toggle.onclick = () => {
			this.number.el.hidden = !this.number.el.hidden;
			this.toggle.setAttribute('aria-pressed', String(!this.number.el.hidden));
			if (!this.number.el.hidden) this.number.input.focus();
		};
	}

	// `lineWidth` is the object's own width, if it has one; the number shows the width the weight stands for otherwise.
	set(value: WeightValue | Mixed, state?: ControlState): void {
		const mixed = isMixed(value);
		const custom = !mixed && value.lineWidth !== undefined;
		this.segments.set(mixed ? MIXED : custom ? '#' : value.weight || '');
		this.number.set(mixed ? null : (value.lineWidth ?? NAMED_WIDTH[value.weight || ''] ?? THIN), state);
		this.number.el.hidden = !custom;
		this.toggle.setAttribute('aria-pressed', String(custom));
		this.mark(state);
	}
}
