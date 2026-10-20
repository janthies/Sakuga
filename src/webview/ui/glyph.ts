// Small 16 px glyphs for choices that read better as a picture than as a word.
const LINE_WEIGHTS: Record<string, number> = { Thin: 1, Medium: 2, Thick: 3.4 };
const PATHS: Record<string, string> = {
	rounded: 'M4 4h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
	rectangle: 'M2 4h12v8H2z',
	pill: 'M6 4h4a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8z',
	ellipse: 'M8 4a6 4 0 1 1 0 8a6 4 0 1 1 0-8',
	circle: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12',
	diamond: 'M8 2l6 6-6 6-6-6z',
	cylinder: 'M2 5c0-4 12-4 12 0v6c0 4-12 4-12 0z M2 5c0 4 12 4 12 0',
	straight: 'M2 12L14 4',
	end: 'M2 8h12M10 4l4 4-4 4',
	both: 'M2 8h12M6 4L2 8l4 4M10 4l4 4-4 4',
	manhattan: 'M2 12h6V4h6',
	curved: 'M2 12C12 12 4 4 14 4',
	hatched: 'M3 13L13 3M3 8L8 3M8 13L13 8',
	crosshatch: 'M3 13L13 3M3 8L8 3M8 13L13 8M3 3L13 13M3 8L8 13M8 3L13 8',
	dots: 'M4 4h.1M8 4h.1M12 4h.1M4 8h.1M8 8h.1M12 8h.1M4 12h.1M8 12h.1M12 12h.1',
	horizontal: 'M2 4h12M2 8h12M2 12h12',
	vertical: 'M4 2v12M8 2v12M12 2v12',
	u: 'M2 4v8h12V4',
	auto: 'M2 12h6V4h6 M2 3h3 M3.5 1.5v3',
	none: 'M3 13L13 3',
	solid: 'M2 8h12',
	dashed: 'M2 8h3m3 0h3m2 0h1',
	dotted: 'M2 8h.1m3 0h.1m3 0h.1m3 0h.1',
	double: 'M2 6h12M2 10h12',
	Latex: 'M2 8h12M10 4l4 4-4 4',
	Stealth: 'M2 8h12M9 3l5 5-5 5 2-5z',
	triangle: 'M3 12L8 3l5 9z',
	barb: 'M2 8h12M10 4l4 4-4 4',
	bar: 'M2 8h10M12 3v10',
	bold: 'M5 2h4a3 3 0 0 1 0 6H5V2z M5 8h5a3 3 0 0 1 0 6H5V8z',
	italic: 'M7 2h6M3 14h6M10 2L6 14',
	'bold-italic': 'M5 2h4a3 3 0 0 1 0 6H5V2z M5 8h5a3 3 0 0 1 0 6H5V8z M14 3l-2 10',
	above: 'M2 11h12M5 7l3-4 3 4',
	below: 'M2 5h12M5 9l3 4 3-4',
	left: 'M11 2v12M7 5L3 8l4 3',
	right: 'M5 2v12M9 5l4 3-4 3',
};
const SVG = (inner: string, width: number) =>
	`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const hasGlyph = (value: string, name = '') => value in PATHS || name in LINE_WEIGHTS;

// The glyph of a choice, or its name when there is none. `name` is the label shown as the tooltip.
export function choiceGlyph(value: string, name: string): string {
	if (LINE_WEIGHTS[name]) return SVG('<path d="M2 8h12"/>', LINE_WEIGHTS[name]);
	if (PATHS[value]) return SVG(`<path d="${PATHS[value]}"/>`, 1.2);
	if (!value && /outline/i.test(name)) return choiceGlyph('solid', 'Solid');
	if (!value && name === 'Normal') return '<span>N</span>';
	if (!value && name === 'None') return choiceGlyph('none', 'None');
	if (!value) return SVG('<rect x="2" y="4" width="12" height="8" rx="2"/>', 1.2);
	return `<span>${String(name).replace(/[&<>"']/g, '')}</span>`;
}

// An icon button's content from a bare path (the align and distribute bar).
export const pathGlyph = (path: string) => SVG(`<path d="${path}"/>`, 1.2);
