import { ControlState, Field, Mixed, ValueEl, h, isMixed, valueEl } from './control';

export interface ColourOptions {
	// Names the control for assistive technology ("fill" gives "fill colours", "fill hex colour").
	name: string;
	// The swatch that means "no value of its own": the style's colour, or the default.
	defaultLabel: string;
	defaultSwatch: string;
	// Palette names in order, and how to draw one.
	palette: string[];
	swatch(key: string): string;
	// Offer the word none (fills).
	none?: boolean;
	recent(): string[];
	// A custom colour was entered: remember it as a recent one.
	remember(hex: string): void;
	// The colour the native picker starts from when the value is not a hex colour.
	pickerStart?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

// Swatches for the style colour, the palette, none, recent colours and a custom hex colour.
export class ColourControl extends Field<string> {
	readonly el: HTMLElement;
	private readonly swatches: ValueEl;
	private readonly picker: HTMLInputElement;
	private readonly hex: HTMLInputElement;

	constructor(private o: ColourOptions) {
		super();
		this.swatches = valueEl(h('div', 'colour-swatches', { role: 'group', 'aria-label': o.name + ' colours' }));
		this.picker = h('input', '', { type: 'color', 'aria-label': `${o.name} custom colour` });
		this.hex = h('input', '', {
			type: 'text',
			placeholder: '#RRGGBB',
			'aria-label': `${o.name} hex colour`,
			maxlength: 7,
		});
		this.picker.hidden = true;
		this.hex.hidden = true;
		this.picker.onchange = () => this.custom(this.picker.value);
		this.hex.oninput = () => this.hex.setCustomValidity('');
		this.hex.onchange = () => this.custom(this.hex.value);
		this.el = h('div', 'style-colour', {}, this.swatches, this.picker, this.hex);
	}

	set(value: string | Mixed, state?: ControlState): void {
		const mixed = isMixed(value);
		const v = mixed ? '*' : value;
		const o = this.o;
		const options: { value: string; label: string; color?: string }[] = [
			{ value: '', label: o.defaultLabel, color: o.defaultSwatch },
			...o.palette.map((k) => ({ value: k, label: k, color: o.swatch(k) })),
			...(o.none ? [{ value: 'none', label: 'none' }] : []),
			...o.recent().map((k) => ({ value: k, label: k, color: k })),
		];
		if (!mixed && v && !options.some((x) => x.value === v)) options.push({ value: v, label: v, color: o.swatch(v) });
		this.swatches.value = v;
		this.swatches.replaceChildren();
		for (const option of options) {
			const b = h('button', 'colour-swatch' + (option.value === 'none' ? ' no-colour' : ''), {
				type: 'button',
				title: option.label,
				'aria-label': option.label,
				'aria-pressed': String(option.value === v),
			});
			b.style.setProperty('--swatch', option.color || o.defaultSwatch);
			b.onclick = () => this.commit(option.value);
			this.swatches.append(b);
		}
		const add = h(
			'button',
			'colour-swatch custom-colour',
			{
				type: 'button',
				title: 'Custom hex colour',
				'aria-label': 'Custom hex colour',
			},
			'+',
		);
		add.onclick = () => {
			this.hex.hidden = !this.hex.hidden;
			if (!this.hex.hidden) this.hex.focus();
		};
		this.swatches.append(add);
		if (mixed) this.swatches.append(h('span', 'mixed', {}, 'Mixed'));
		const isHex = HEX.test(v);
		this.picker.value = isHex ? v : o.pickerStart || '#000000';
		this.hex.value = isHex ? v : '';
		this.mark(state);
	}

	private custom(raw: string): void {
		const v = (raw.startsWith('#') ? raw : '#' + raw).toUpperCase();
		if (!/^#[0-9A-F]{6}$/.test(v)) {
			this.hex.setCustomValidity('Enter a six-digit hex colour');
			this.hex.reportValidity();
			return;
		}
		this.hex.setCustomValidity('');
		this.hex.value = v;
		this.picker.value = v;
		this.o.remember(v);
		this.commit(v);
	}
}
