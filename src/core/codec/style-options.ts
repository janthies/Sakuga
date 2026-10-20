// TikZ options of an object style.
import { cornerKeys, patternKeys, shapeKeys, tipKeys } from './keys';
import { fill } from '../model/colour';
import { ObjectStyle } from '../model/figure';
import { opacity } from '../model/queries';

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

export function opacityOptions(own: number | undefined, layer = 1): string[] {
	const value = opacity(own),
		effective = Math.round(value * opacity(layer) * 1e6) / 1e6;
	return [...(effective !== 1 ? [`opacity=${effective}`] : []), ...(layer !== 1 ? [`sg opacity=${value}`] : [])];
}

export function scaledTip(key: string, st: ObjectStyle): string {
	return (tipKeys[key] || '')
		.replace(/length=[\d.]+mm/, `length=${st.tipLength ?? 1.5}mm`)
		.replace(/width=[\d.]+mm/, `width=${st.tipWidth ?? 1.2}mm`);
}

export function styleOptions(
	st: ObjectStyle = {},
	arrow = false,
	height = 6.16,
	ctx: { thin?: boolean; redraw?: boolean } = {},
): string[] {
	const out: string[] = [];
	if (st.compact) out.push('sg compact');
	if (!arrow && st.shape && shapeKeys[st.shape]) {
		out.push(st.shape === 'pill' ? `rounded corners=${Math.round(height * 50) / 100}mm` : shapeKeys[st.shape]);
	}
	if (st.textColor) {
		out.push(`text=${fill(st.textColor)}`);
	}
	if (st.fill) {
		out.push(`fill=${st.fill === 'none' ? 'none' : fill(st.fill)}`);
	}
	if (st.color) {
		out.push(`draw=${st.color === 'black' ? 'black' : fill(st.color)}`);
	}
	if (st.border) {
		out.push(st.border === 'none' ? 'draw=none' : ctx.redraw && st.border === 'solid' ? 'draw=black!38' : st.border);
		if (st.border === 'double') {
			out.push('double distance=0.8pt');
		}
	}
	if (!arrow && st.patternColor) {
		out.push(`pattern color=${fill(st.patternColor)}`);
	}
	if (!arrow && st.pattern && patternKeys[st.pattern]) {
		out.push(`postaction={pattern=${patternKeys[st.pattern]},pattern color=${fill(st.patternColor || 'black!25')}}`);
	}
	if (!arrow && st.mark && st.mark !== 'none') {
		out.push(markOption(st));
	}
	if (arrow && st.lineWidth !== undefined && st.lineWidth !== 0.45) {
		out.push(`line width=${st.lineWidth}pt`, `sg line width=${st.lineWidth}`);
	}
	if (arrow && st.tipLength !== undefined && st.tipLength !== 1.5) {
		out.push(`sg tip length=${st.tipLength}`);
	}
	if (arrow && st.tipWidth !== undefined && st.tipWidth !== 1.2) {
		out.push(`sg tip width=${st.tipWidth}`);
	}
	if (st.step) {
		out.push(`sg step=${st.step}`);
	}
	if (!arrow && st.lineWidth !== undefined) {
		out.push(`line width=${st.lineWidth}pt`);
	} else if (st.weight && st.weight !== 'thin' && !(arrow && st.lineWidth !== undefined)) {
		out.push(`line width=${st.weight === 'medium' ? '0.8' : '1.2'}pt`);
	} else if (!arrow && st.weight === 'thin' && ctx.thin) {
		out.push('line width=0.45pt');
	}
	if (st.font || st.text) {
		out.push(
			`font=\\sffamily${st.font ? '\\' + st.font : ''}${st.text === 'bold' ? '\\bfseries' : st.text === 'italic' ? '\\itshape' : st.text === 'bold-italic' ? '\\bfseries\\itshape' : ''}`,
		);
	}
	if (
		arrow &&
		((st.tipLength !== undefined && st.tipLength !== 1.5) ||
			(st.tipWidth !== undefined && st.tipWidth !== 1.2) ||
			(st.start && st.start !== 'none') ||
			(st.end && st.end !== 'Latex'))
	) {
		out.push(`{${scaledTip(st.start || 'none', st)}}-{${scaledTip(st.end || 'Latex', st)}}`);
	}
	return out;
}
