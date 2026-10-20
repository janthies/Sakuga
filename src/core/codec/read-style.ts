// Reading the options of an object style back.
import { cornerKeys, patternKeys, readColor, shapeKeys, tipKeys } from './keys';
import { markOption, scaledTip } from './style-options';
import { FONT_SIZES } from '../model/constants';
import { ObjectStyle } from '../model/figure';
import { opacity } from '../model/queries';

export function readStyle(options: string[], arrow = false, styled = false): { style: ObjectStyle; extra: string[] } {
	const style: ObjectStyle = {},
		extra: string[] = [];
	for (const o of options) {
		const shape =
			Object.keys(shapeKeys).find((k) => shapeKeys[k] === o) || (/^rounded corners=[\d.]+mm$/.test(o) ? 'pill' : '');
		if (o === 'sg compact') {
			style.compact = true;
		} else if (/^(?:sg )?opacity\s*=/.test(o)) {
			const v = Number(o.split('=')[1]);
			if (Number.isFinite(v)) {
				style.opacity = opacity(v);
			} else {
				extra.push(o);
			}
		} else if (shape) {
			style.shape = shape;
		} else if (o === 'solid' || o === 'dashed' || o === 'dotted' || o === 'double') {
			style.border = o;
		} else if (o === 'double distance=0.8pt') {
			/* emitted with double */
		} else if (o.startsWith('pattern color=') && readColor(o.slice(14))) {
			style.patternColor = readColor(o.slice(14));
		} else if (o.startsWith('postaction={pattern=')) {
			const m = /^postaction=\{pattern=([^,]+),\s*pattern color=([^}]+)\}$/.exec(o);
			const key = m && Object.keys(patternKeys).find((k) => patternKeys[k] === m[1]);
			if (m && key && readColor(m[2])) {
				style.pattern = key;
				if (m[2] !== 'black!25') {
					style.patternColor = readColor(m[2]);
				}
			} else {
				extra.push(o);
			}
		} else if (o.startsWith('path picture=')) {
			const color = /fill=([^,]+)/.exec(o),
				corner = /bounding box\.(north east|north west|south east|south west)/.exec(o);
			const size = /(?:xshift|yshift)=(-?[\d.]+)mm/.exec(o);
			const candidate: ObjectStyle = { mark: o.includes('circle[radius=') ? 'circle' : 'triangle' };
			if (color && corner && size) {
				const c = Object.keys(cornerKeys).find((k) => cornerKeys[k] === corner[1])!;
				if (c !== 'ne') {
					candidate.markCorner = c;
				}
				if (Math.abs(+size[1]) * (candidate.mark === 'circle' ? 2 : 1) === 5) {
					candidate.markSize = 'medium';
				}
				if (color[1] !== 'sgc33333A') {
					candidate.markColor = readColor(color[1]);
				}
			}
			if (color && corner && size && markOption(candidate) === o) {
				Object.assign(style, candidate);
			} else {
				extra.push(o);
			}
		} else if (o.startsWith('text=') && readColor(o.slice(5))) {
			style.textColor = readColor(o.slice(5));
		} else if (o === 'draw=none') {
			style.border = 'none';
		} else if (styled && !arrow && o === 'draw=black!38') {
			style.border = 'solid';
		} else if (styled && !arrow && o === 'line width=0.45pt') {
			style.weight = 'thin';
		} else if (!arrow && /^line width=[\d.]+pt$/.test(o) && !/^line width=(0.8|1.2)pt$/.test(o)) {
			style.lineWidth = parseFloat(o.slice(11));
		} else if (/^(fill|draw)=/.test(o)) {
			const v = o.split('=')[1],
				color = readColor(v) || (v === 'none' ? v : '');
			if (color) {
				style[o.startsWith('fill') ? 'fill' : 'color'] = color;
			} else {
				extra.push(o);
			}
		} else if (arrow && /^line width=[\d.]+pt$/.test(o)) {
			if (o === 'line width=0.8pt' || o === 'line width=1.2pt') {
				style.weight = o.includes('0.8') ? 'medium' : 'thick';
			} else {
				style.lineWidth = parseFloat(o.slice(11));
			}
		} else if (arrow && /^sg label (side|position)=/.test(o)) {
			const [key, v] = o.split('=');
			style[key === 'sg label side' ? 'side' : 'position'] = v;
		} else if (/^sg step=/.test(o) || (arrow && /^sg (line width|tip length|tip width|step)=/.test(o))) {
			const [key, v] = o.split('=');
			(style as any)[
				key === 'sg line width'
					? 'lineWidth'
					: key === 'sg step'
						? 'step'
						: key === 'sg tip length'
							? 'tipLength'
							: 'tipWidth'
			] = +v;
		} else if (/^line width=(0.8|1.2)pt$/.test(o)) {
			style.weight = o.includes('0.8') ? 'medium' : 'thick';
		} else if (
			o.startsWith('font=') &&
			/\\(sffamily|bfseries|itshape|scriptsize|footnotesize|small|normalsize|large)/.test(o)
		) {
			style.font = FONT_SIZES.find((f) => o.includes('\\' + f));
			if (o.includes('\\bfseries')) {
				style.text = o.includes('\\itshape') ? 'bold-italic' : 'bold';
			} else if (o.includes('\\itshape')) {
				style.text = 'italic';
			}
		} else if (arrow && /^\{.*\}-\{.*\}$/.test(o)) {
			const m = /^\{(.*)\}-\{(.*)\}$/.exec(o)!;
			style.start = Object.keys(tipKeys).find((k) => scaledTip(k, style) === m[1]);
			style.end = Object.keys(tipKeys).find((k) => scaledTip(k, style) === m[2]);
		} else {
			extra.push(o);
		}
	}
	if (options.some((o) => o.startsWith('sg line width='))) delete style.weight;
	const own = options.find((o) => /^sg opacity\s*=/.test(o));
	if (own && Number.isFinite(Number(own.split('=')[1]))) {
		style.opacity = opacity(Number(own.split('=')[1]));
	}
	return { style, extra };
}
