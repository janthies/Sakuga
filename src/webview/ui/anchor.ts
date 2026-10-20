import { ControlState, Field, Mixed, h, isMixed } from './control';

export interface AnchorLayout<V extends string> {
	// Row by row; null is an empty cell. Nine cells make the 3×3 picker, 25 add a ring of outside positions.
	cells: (V | null)[];
	columns: number;
	// The name of a cell for the tooltip.
	name(v: V): string;
	// A cell that is not a position but a mode (the original placement).
	extra?: { value: V; label: string; title: string };
	className: string;
	ariaLabel: string;
}

// A grid of positions around an object: nine anchors, or anchors plus the positions outside.
export class AnchorPicker<V extends string> extends Field<V> {
	readonly el: HTMLElement;
	private buttons = new Map<V, HTMLButtonElement[]>();

	constructor(
		private layout: AnchorLayout<V>,
		allowed?: Set<V>,
	) {
		super();
		this.el = h('div', layout.className, { role: 'group', 'aria-label': layout.ariaLabel });
		for (const v of layout.cells) {
			const b = h('button', '', { type: 'button' }, '·');
			if (v === null || (allowed && !allowed.has(v))) {
				b.disabled = true;
				b.title = 'Position unavailable';
			} else {
				b.title = layout.name(v);
				b.onclick = () => this.commit(v);
				this.buttons.set(v, [...(this.buttons.get(v) || []), b]);
			}
			b.setAttribute('aria-label', b.title || 'Anchor');
			this.el.append(b);
		}
		const extra = layout.extra;
		if (extra && (!allowed || allowed.has(extra.value))) {
			const b = h('button', 'legacy-position', { type: 'button', title: extra.title }, extra.label);
			b.onclick = () => this.commit(extra.value);
			this.buttons.set(extra.value, [b]);
			this.el.append(b);
		}
	}

	set(value: V | Mixed, state?: ControlState): void {
		for (const [v, list] of this.buttons)
			for (const b of list) b.setAttribute('aria-pressed', String(!isMixed(value) && v === value));
		this.mark(state);
	}
}
