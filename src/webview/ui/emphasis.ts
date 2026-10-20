import { ControlState, Field, Mixed, h, isMixed } from './control';
import { choiceGlyph } from './glyph';

export type EmphasisValue = '' | 'bold' | 'italic' | 'bold-italic';

// Bold and italic as two toggle buttons over the one value 'bold' | 'italic' | 'bold-italic' | ''.
export class Emphasis extends Field<EmphasisValue> {
	readonly el: HTMLElement;
	private value = '';
	private buttons: Record<'bold' | 'italic', HTMLButtonElement>;

	constructor() {
		super();
		this.el = h('div', 'segments', { role: 'group', 'aria-label': 'Text emphasis' });
		const make = (key: 'bold' | 'italic') => {
			const b = h('button', '', { type: 'button', title: key, 'aria-label': key });
			b.innerHTML = choiceGlyph(key, key);
			b.onclick = () => {
				const bold = key === 'bold' ? !this.value.includes('bold') : this.value.includes('bold');
				const italic = key === 'italic' ? !this.value.includes('italic') : this.value.includes('italic');
				this.commit(bold && italic ? 'bold-italic' : bold ? 'bold' : italic ? 'italic' : '');
			};
			this.el.append(b);
			return b;
		};
		this.buttons = { bold: make('bold'), italic: make('italic') };
	}

	set(value: EmphasisValue | Mixed, state?: ControlState): void {
		const mixed = isMixed(value);
		this.value = mixed ? '' : value;
		for (const key of ['bold', 'italic'] as const) {
			this.buttons[key].setAttribute('aria-pressed', mixed ? 'mixed' : String(this.value.includes(key)));
		}
		this.mark(state);
	}
}
