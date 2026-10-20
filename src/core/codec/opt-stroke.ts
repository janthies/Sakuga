// Option codecs for line weight, step, font, arrow tips and opacity.
import { tipKeys } from './keys';
import type { OptionCodec } from './option-types';
import { FONT_SIZES } from '../model/constants';
import { ObjectStyle } from '../model/figure';
import { opacity } from '../model/queries';
import { defOf } from '../schema';

const arrowDefault = (key: string) => defOf('arrow', key)!.default as number;

export function scaledTip(key: string, st: ObjectStyle): string {
	return (tipKeys[key] || '')
		.replace(/length=[\d.]+mm/, `length=${st.tipLength ?? arrowDefault('tipLength')}mm`)
		.replace(/width=[\d.]+mm/, `width=${st.tipWidth ?? arrowDefault('tipWidth')}mm`);
}

export function opacityOptions(own: number | undefined, layer = 1): string[] {
	const value = opacity(own),
		effective = Math.round(value * opacity(layer) * 1e6) / 1e6;
	return [...(effective !== 1 ? [`opacity=${effective}`] : []), ...(layer !== 1 ? [`sg opacity=${value}`] : [])];
}

// Written by the callers, which know the layer's opacity; kinds is empty so emitOptions skips it.
const opacityCodec: OptionCodec = {
	owns: ['opacity'],
	kinds: [],
	emit: (p) => opacityOptions(p.opacity),
	read(o, p) {
		if (!/^(?:sg )?opacity\s*=/.test(o)) return false;
		const v = Number(o.split('=')[1]);
		if (!Number.isFinite(v)) return false;
		p.opacity = opacity(v);
		return true;
	},
	finish(options, p) {
		const own = options.find((o) => /^sg opacity\s*=/.test(o));
		if (own && Number.isFinite(Number(own.split('=')[1]))) p.opacity = opacity(Number(own.split('=')[1]));
	},
};

// An arrow's line width travels as `line width` for TikZ and `sg line width` for Sakuga, so 0.8 and 1.2 stay widths.
const arrowLineWidth: OptionCodec = {
	owns: ['lineWidth'],
	kinds: ['arrow'],
	emit: (p) =>
		p.lineWidth !== undefined && p.lineWidth !== arrowDefault('lineWidth')
			? [`line width=${p.lineWidth}pt`, `sg line width=${p.lineWidth}`]
			: [],
	read(o, p, c) {
		if (!c.arrow || !/^sg line width=/.test(o)) return false;
		p.lineWidth = +o.split('=')[1];
		return true;
	},
	finish(options, p) {
		if (options.some((o) => o.startsWith('sg line width='))) delete p.weight;
	},
};

const tipSize = (key: 'tipLength' | 'tipWidth', word: string): OptionCodec => ({
	owns: [key],
	kinds: ['arrow'],
	emit: (p) => (p[key] !== undefined && p[key] !== arrowDefault(key) ? [`sg ${word}=${p[key]}`] : []),
	read(o, p, c) {
		if (!c.arrow || !o.startsWith(`sg ${word}=`)) return false;
		p[key] = +o.split('=')[1];
		return true;
	},
});

const step: OptionCodec = {
	owns: ['step'],
	kinds: ['node', 'arrow'],
	emit: (p) => (p.step ? [`sg step=${p.step}`] : []),
	read(o, p) {
		if (!/^sg step=/.test(o)) return false;
		p.step = +o.split('=')[1];
		return true;
	},
};

// Weight words and free widths of a box; an arrow with a width wrote it above.
const weight: OptionCodec = {
	owns: ['weight', 'lineWidth'],
	kinds: ['node', 'arrow'],
	emit(p, c) {
		if (!c.arrow && p.lineWidth !== undefined) return [`line width=${p.lineWidth}pt`];
		if (p.weight && p.weight !== 'thin' && !(c.arrow && p.lineWidth !== undefined)) {
			return [`line width=${p.weight === 'medium' ? '0.8' : '1.2'}pt`];
		}
		return !c.arrow && p.weight === 'thin' && c.thin ? ['line width=0.45pt'] : [];
	},
	read(o, p, c) {
		if (!/^line width=[\d.]+pt$/.test(o)) return false;
		if (c.styled && !c.arrow && o === 'line width=0.45pt') p.weight = 'thin';
		else if (o === 'line width=0.8pt' || o === 'line width=1.2pt') p.weight = o.includes('0.8') ? 'medium' : 'thick';
		else p.lineWidth = parseFloat(o.slice(11));
		return true;
	},
};

const font: OptionCodec = {
	owns: ['font', 'text'],
	kinds: ['node', 'arrow'],
	emit(p) {
		if (!p.font && !p.text) return [];
		const emphasis =
			p.text === 'bold'
				? '\\bfseries'
				: p.text === 'italic'
					? '\\itshape'
					: p.text === 'bold-italic'
						? '\\bfseries\\itshape'
						: '';
		return [`font=\\sffamily${p.font ? '\\' + p.font : ''}${emphasis}`];
	},
	read(o, p) {
		if (
			!o.startsWith('font=') ||
			!/\\(sffamily|bfseries|itshape|scriptsize|footnotesize|small|normalsize|large)/.test(o)
		) {
			return false;
		}
		p.font = FONT_SIZES.find((f) => o.includes('\\' + f));
		if (o.includes('\\bfseries')) p.text = o.includes('\\itshape') ? 'bold-italic' : 'bold';
		else if (o.includes('\\itshape')) p.text = 'italic';
		return true;
	},
};

const tips: OptionCodec = {
	owns: ['start', 'end', 'tipLength', 'tipWidth'],
	kinds: ['arrow'],
	emit(p) {
		const changed =
			(p.tipLength !== undefined && p.tipLength !== arrowDefault('tipLength')) ||
			(p.tipWidth !== undefined && p.tipWidth !== arrowDefault('tipWidth')) ||
			(p.start && p.start !== 'none') ||
			(p.end && p.end !== 'Latex');
		return changed ? [`{${scaledTip(p.start || 'none', p)}}-{${scaledTip(p.end || 'Latex', p)}}`] : [];
	},
	read(o, p, c) {
		const m = c.arrow ? /^\{(.*)\}-\{(.*)\}$/.exec(o) : null;
		if (!m) return false;
		p.start = Object.keys(tipKeys).find((k) => scaledTip(k, p) === m[1]);
		p.end = Object.keys(tipKeys).find((k) => scaledTip(k, p) === m[2]);
		return true;
	},
};

// Where an arrow's label sits; written with the label, read here so it is part of the style.
const labelPlace: OptionCodec = {
	owns: ['side', 'position'],
	kinds: [],
	emit: () => [],
	read(o, p, c) {
		if (!c.arrow || !/^sg label (side|position)=/.test(o)) return false;
		const [key, v] = o.split('=');
		p[key === 'sg label side' ? 'side' : 'position'] = v;
		return true;
	},
};

export const strokeCodecs: OptionCodec[] = [
	opacityCodec,
	arrowLineWidth,
	tipSize('tipLength', 'tip length'),
	tipSize('tipWidth', 'tip width'),
	step,
	weight,
	font,
	tips,
	labelPlace,
];
