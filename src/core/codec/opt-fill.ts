// Option codecs for the look of the surface: shape, colours, border, pattern and corner mark.
import { cornerKeys, patternKeys, readColor, shapeKeys } from './keys';
import type { OptionCodec } from './option-types';
import { fill } from '../model/colour';
import { ObjectStyle } from '../model/figure';

export function markOption(st: ObjectStyle): string {
	const corner = st.markCorner || 'ne',
		anchor = `path picture bounding box.${cornerKeys[corner] || cornerKeys.ne}`;
	const size = st.markSize === 'medium' ? 5 : 2.4,
		x = corner.endsWith('e') ? -1 : 1,
		y = corner.startsWith('n') ? -1 : 1;
	const path =
		st.mark === 'circle'
			? `([xshift=${(x * size) / 2}mm,yshift=${(y * size) / 2}mm]${anchor}) circle[radius=${size / 2}mm]`
			: `(${anchor}) -- ([xshift=${x * size}mm]${anchor}) -- ([yshift=${y * size}mm]${anchor}) -- cycle`;
	return `path picture={\\path[fill=${fill(st.markColor || '#33333A')},draw=none,sharp corners] ${path};}`;
}

const compact: OptionCodec = {
	owns: ['compact'],
	kinds: ['node', 'arrow'],
	emit: (p) => (p.compact ? ['sg compact'] : []),
	read(o, p) {
		if (o !== 'sg compact') return false;
		p.compact = true;
		return true;
	},
};

const shape: OptionCodec = {
	owns: ['shape'],
	kinds: ['node'],
	emit: (p, c) =>
		p.shape && shapeKeys[p.shape]
			? [p.shape === 'pill' ? `rounded corners=${Math.round(c.height * 50) / 100}mm` : shapeKeys[p.shape]]
			: [],
	read(o, p) {
		const s =
			Object.keys(shapeKeys).find((k) => shapeKeys[k] === o) || (/^rounded corners=[\d.]+mm$/.test(o) ? 'pill' : '');
		if (!s) return false;
		p.shape = s;
		return true;
	},
};

const textColor: OptionCodec = {
	owns: ['textColor'],
	kinds: ['node', 'arrow'],
	emit: (p) => (p.textColor ? [`text=${fill(p.textColor)}`] : []),
	read(o, p) {
		if (!o.startsWith('text=') || !readColor(o.slice(5))) return false;
		p.textColor = readColor(o.slice(5));
		return true;
	},
};

const fillColour: OptionCodec = {
	owns: ['fill'],
	kinds: ['node', 'arrow'],
	emit: (p) => (p.fill ? [`fill=${p.fill === 'none' ? 'none' : fill(p.fill)}`] : []),
	read(o, p) {
		if (!o.startsWith('fill=')) return false;
		const v = o.slice(5),
			color = readColor(v) || (v === 'none' ? v : '');
		if (!color) return false;
		p.fill = color;
		return true;
	},
};

const drawColour: OptionCodec = {
	owns: ['color'],
	kinds: ['node', 'arrow'],
	emit: (p) => (p.color ? [`draw=${p.color === 'black' ? 'black' : fill(p.color)}`] : []),
	read(o, p) {
		// draw=none is the border codec's.
		if (!o.startsWith('draw=') || o === 'draw=none') return false;
		const color = readColor(o.slice(5));
		if (!color) return false;
		p.color = color;
		return true;
	},
};

const border: OptionCodec = {
	owns: ['border'],
	kinds: ['node', 'arrow'],
	emit(p, c) {
		if (!p.border) return [];
		const word = p.border === 'none' ? 'draw=none' : c.redraw && p.border === 'solid' ? 'draw=black!38' : p.border;
		return p.border === 'double' ? [word, 'double distance=0.8pt'] : [word];
	},
	read(o, p, c) {
		if (o === 'solid' || o === 'dashed' || o === 'dotted' || o === 'double') p.border = o;
		else if (o === 'draw=none') p.border = 'none';
		else if (c.styled && !c.arrow && o === 'draw=black!38') p.border = 'solid';
		else if (o !== 'double distance=0.8pt') return false; // emitted with double, nothing to keep
		return true;
	},
};

const patternColor: OptionCodec = {
	owns: ['patternColor'],
	kinds: ['node'],
	emit: (p) => (p.patternColor ? [`pattern color=${fill(p.patternColor)}`] : []),
	read(o, p) {
		if (!o.startsWith('pattern color=') || !readColor(o.slice(14))) return false;
		p.patternColor = readColor(o.slice(14));
		return true;
	},
};

const pattern: OptionCodec = {
	owns: ['pattern', 'patternColor'],
	kinds: ['node'],
	emit: (p) =>
		p.pattern && patternKeys[p.pattern]
			? [`postaction={pattern=${patternKeys[p.pattern]},pattern color=${fill(p.patternColor || 'black!25')}}`]
			: [],
	read(o, p) {
		if (!o.startsWith('postaction={pattern=')) return false;
		const m = /^postaction=\{pattern=([^,]+),\s*pattern color=([^}]+)\}$/.exec(o);
		const key = m && Object.keys(patternKeys).find((k) => patternKeys[k] === m[1]);
		if (!m || !key || !readColor(m[2])) return false;
		p.pattern = key;
		if (m[2] !== 'black!25') p.patternColor = readColor(m[2]);
		return true;
	},
};

const mark: OptionCodec = {
	owns: ['mark', 'markCorner', 'markSize', 'markColor'],
	kinds: ['node'],
	emit: (p) => (p.mark && p.mark !== 'none' ? [markOption(p)] : []),
	read(o, p) {
		if (!o.startsWith('path picture=')) return false;
		const color = /fill=([^,]+)/.exec(o),
			corner = /bounding box\.(north east|north west|south east|south west)/.exec(o),
			size = /(?:xshift|yshift)=(-?[\d.]+)mm/.exec(o);
		const candidate: ObjectStyle = { mark: o.includes('circle[radius=') ? 'circle' : 'triangle' };
		if (!color || !corner || !size) return false;
		const c = Object.keys(cornerKeys).find((k) => cornerKeys[k] === corner[1])!;
		if (c !== 'ne') candidate.markCorner = c;
		if (Math.abs(+size[1]) * (candidate.mark === 'circle' ? 2 : 1) === 5) candidate.markSize = 'medium';
		if (color[1] !== 'sgc33333A') candidate.markColor = readColor(color[1]);
		if (markOption(candidate) !== o) return false;
		Object.assign(p, candidate);
		return true;
	},
};

export const fillCodecs: OptionCodec[] = [
	compact,
	shape,
	textColor,
	fillColour,
	drawColour,
	border,
	patternColor,
	pattern,
	mark,
];
