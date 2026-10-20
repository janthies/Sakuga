// Typography options of a label.
import { fill } from '../model/colour';
import { LabelStyle } from '../model/figure';
import { cleanLabel } from '../styles/appearance';

export function labelMetrics(text: string, st: LabelStyle | undefined, font: string, step = 0): string {
	const pt =
		({ scriptsize: 8, footnotesize: 9, small: 10, normalsize: 10.95, large: 12 } as Record<string, number>)[
			st?.font || font
		] || 10;
	const h = Math.max(text.split('\\\\').length * pt * 1.25, step ? 3.6 / (25.4 / 72.27) : 0);
	return `, outer sep=0pt, text height=${h * 0.6}pt, text depth=${h * 0.4}pt`;
}

export function labelOptions(st: LabelStyle = {}, defaults: LabelStyle = {}): string {
	const v = { ...defaults, ...cleanLabel(st) };
	return [
		v.hidden ? 'opacity=0' : '',
		v.pos !== undefined ? `pos=${v.pos}` : '',
		v.side || '',
		v.dx || v.dy ? `shift={(${v.dx || 0}mm,${v.dy || 0}mm)}` : '',
		v.color ? `text=${fill(v.color)}` : '',
		`font=\\sffamily\\${v.font || 'small'}${v.bold ? '\\bfseries' : ''}${v.italic ? '\\itshape' : ''}`,
		v.background === false ? 'fill=none' : v.background === true ? 'fill=white' : '',
	]
		.filter(Boolean)
		.map((v) => ', ' + v)
		.join('');
}
