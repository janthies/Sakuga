// Dialect names of shapes, tips, patterns and corners, and reading a colour back.
import { PALETTE, fill } from '../model/colour';

export const MARKERS = ['sg straight', 'sg manhattan', 'sg curved', 'sg fixed'];

export const shapeKeys: Record<string, string> = {
	rounded: 'rounded corners=1.4pt',
	rectangle: 'rounded corners=0pt',
	pill: 'rounded corners=100mm',
	ellipse: 'ellipse',
	circle: 'circle',
	diamond: 'diamond',
	triangle: 'regular polygon, regular polygon sides=3',
	cylinder: 'cylinder',
};

export const tipKeys: Record<string, string> = {
	Latex: 'Latex[length=1.5mm, width=1.2mm]',
	Stealth: 'Stealth[length=1.5mm, width=1.2mm]',
	triangle: 'Triangle[open, length=1.5mm, width=1.2mm]',
	barb: 'Straight Barb[length=1.5mm, width=1.2mm]',
	circle: 'Circle[length=1.2mm]',
	bar: 'Bar[width=1.2mm]',
	none: '',
};

export const patternKeys: Record<string, string> = {
	hatched: 'north east lines',
	crosshatch: 'crosshatch',
	dots: 'dots',
	horizontal: 'horizontal lines',
	vertical: 'vertical lines',
};

export const cornerKeys: Record<string, string> = {
	ne: 'north east',
	nw: 'north west',
	se: 'south east',
	sw: 'south west',
};

export const readColor = (v: string) =>
	/^sgc[0-9a-f]{6}$/i.test(v)
		? '#' + v.slice(3).toUpperCase()
		: Object.keys(PALETTE).find((k) => fill(k) === v) || (v === 'black!25' ? v : '');
