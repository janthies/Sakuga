import { ControlState, Field, Mixed, ValueEl, h, isMixed, valueEl } from './control';
import { choiceGlyph } from './glyph';

export interface SegmentOption<V extends string> {
	value: V;
	// The name; also the tooltip and the accessible name unless `tip` says otherwise.
	label: string;
	tip?: string;
	// Text shown instead of a glyph.
	text?: string;
}

// A row of buttons, one pressed. The mixed state shows a "Mixed" note and presses none.
export class Segmented<V extends string> extends Field<V> {
	readonly el: ValueEl;
	private buttons = new Map<V, HTMLButtonElement>();
	private note = h('span', 'mixed', {}, 'Mixed');

	constructor(
		options: SegmentOption<V>[],
		private ariaLabel = '',
	) {
		super();
		this.el = valueEl(h('div', 'segments', { role: 'group', 'aria-label': ariaLabel || undefined }));
		this.note.hidden = true;
		this.el.append(this.note);
		for (const o of options) {
			const b = h('button', '', { type: 'button', title: o.tip || o.label, 'aria-label': o.tip || o.label });
			b.innerHTML = o.text !== undefined ? `<span>${o.text}</span>` : choiceGlyph(o.value, o.label);
			b.onclick = () => this.commit(o.value);
			this.buttons.set(o.value, b);
			this.el.append(b);
		}
	}

	set(value: V | Mixed, state?: ControlState): void {
		const mixed = isMixed(value);
		this.el.value = mixed ? '*' : value;
		this.note.hidden = !mixed;
		for (const [v, b] of this.buttons) b.setAttribute('aria-pressed', String(!mixed && v === value));
		this.mark(state);
	}
}
