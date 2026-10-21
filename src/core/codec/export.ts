// Adaptive paste: only geometry uses sgu; stroke, padding, tips and fonts stay fixed.
import type { Figure } from '../model/figure';
import { EXPORT_DEFAULTS, exportTarget } from '../model/export';
import { fontSize } from '../model/queries';
import { geometryOf } from '../geometry/figure-geometry';
import { naturalWidth } from '../geometry/export';
import { num } from '../util/num';

export function readExport(fig: Figure, line: string): boolean {
	const legacy = /^%\s*sakuga sheet\s+([\d.]+)/.exec(line);
	const header = /^% sakuga export width=([\d.]+) font=(\w+)$/.exec(line);
	if (!legacy && !header) return false;
	const width = Number((header || legacy)![1]);
	if (width > 0 && Number.isFinite(width)) fig.export = { width, ...(header ? { font: header[2] } : {}) };
	return true;
}
export function exportHeader(fig: Figure): string[] {
	const target = { ...exportTarget(fig), font: fontSize(fig) };
	const defaults = fig.exportDefaults || EXPORT_DEFAULTS;
	return target.width === defaults.width && target.font === defaults.font
		? []
		: [`% sakuga export width=${target.width} font=${target.font}`];
}
export function unscaleSource(text: string): string {
	return text
		.replace(/^% sakuga sizing begin\n[\s\S]*?^% sakuga sizing end\n/gm, '')
		.replace(/\n[^\n]*% sakuga sizing finish(\n|$)/g, '$1')
		.replace(/(\\end\{tikzpicture\})\}%/g, '$1')
		.replace(/([xy])=\\sgu/g, '$1=1mm')
		.replace(/\\sgu/g, 'mm')
		.replace(/font=\\sffamily\\sgfont/g, 'font=\\sffamily\\small');
}
export function scaleGeometry(line: string): string {
	if (line.startsWith('%')) return line;
	// These generated helpers contain geometry only. Other helpers include fixed tips and padding.
	if (/^\\def\\sg(content|labeltext)/.test(line)) return line.replace(/mm/g, '\\sgu');
	return line
		.replace(/((?:text width|minimum (?:width|height|size)|[xy]shift)\s*=\s*\{?)(-?[\d.]+)mm/g, '$1$2\\sgu')
		.replace(/(shift=\{\()(-?[\d.]+)mm,(-?[\d.]+)mm/g, '$1$2\\sgu,$3\\sgu')
		.replace(/(\\parbox(?:\[[^\]]*\])*\{[^}]*\}|\\(?:makebox|hspace|vspace\*?)\{[^}]*\})/g, (value) =>
			value.replace(/mm/g, '\\sgu'),
		)
		.replace(/(sg frame (?:dashed|dotted|region|solid)\/\.style=\{[^}]*inner sep=[\d.]+)mm/g, '$1\\sgu')
		.replace(/(minimum height=\{?)#1mm/g, '$1#1\\sgu')
		.replace(/#([235])mm/g, '#$1\\sgu');
}
export function adaptivePaste(text: string, fig: Figure): string {
	const width = num(naturalWidth(geometryOf(fig)));
	const start = [
		'% sakuga sizing begin',
		String.raw`\ifdefined\sgu\else\newdimen\sgu\fi`,
		String.raw`\pgfmathsetlength\sgu{max(0.8,min(1,\linewidth/(` + width + String.raw`mm)))*1mm}`,
		`\\def\\sgfont{\\${fontSize(fig)}}\\sbox0{%`,
		'% sakuga sizing end',
	].join('\n');
	return text
		.split('\n')
		.map((line) => {
			if (line.includes('\\begin{tikzpicture}'))
				return (
					start +
					'\n' +
					line
						.replace(/x=1mm/, 'x=\\sgu')
						.replace(/y=1mm/, 'y=\\sgu')
						.replace(/font=\\sffamily\\\w+/, 'font=\\sffamily\\sgfont')
				);
			if (line.includes('\\end{tikzpicture}'))
				return (
					line +
					String.raw`}%` +
					'\n' +
					String.raw`\ifdim\wd0>\linewidth\resizebox{\linewidth}{!}{\usebox0}\else\usebox0\fi % sakuga sizing finish`
				);
			return scaleGeometry(line);
		})
		.join('\n');
}
