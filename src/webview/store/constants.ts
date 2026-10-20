import { vscode } from '../platform/host';
import { rowOf, styleable } from '../../core/schema';

export const NS = 'http://www.w3.org/2000/svg';
// Look of Fig. 5.2 (fig_components.tex); sizes measured from LuaLaTeX output.
export const PT = 25.4 / 72.27;
// mm per TeX point
export const TITLE_PT = 10,
	CODE_PT = 8;
// \small and \scriptsize in an 11 pt document
export const XSEP = 3 * PT;
const HEIGHTS = [0, 6.16, 9.55];
// box height in mm for 1 and 2 lines of text
export { LINE, STROKE, ARROW, ARROW_DASHED, CODE } from '../../core/scene/style';
export const PX_PER_MM = 96 / 25.4;
export const sizes = { scriptsize: 8, footnotesize: 9, small: 10, normalsize: 10.95, large: 12 };
export const smallerPt = (pt: number) =>
	(({ 8: 6, 9: 8, 10: 9, 10.95: 10, 12: 10.95 }) as Record<number, number>)[pt] || 9;
export const ANCHORS = [
	'north west',
	'north',
	'north east',
	'west',
	'center',
	'east',
	'south west',
	'south',
	'south east',
];
// Toolbar next to a selected arrow: route, heads and line, as in Figma's connector bar.
export const ICON = {
	eye: '<path d="M1 8 Q8 -1 15 8 Q8 17 1 8 Z"/><circle cx="8" cy="8" r="2"/>',
	eyeClosed: '<path d="M2 6 Q8 14 14 6 M3 9 L1 12 M8 11 V14 M13 9 L15 12"/>',
	lock: '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7 V5 a3 3 0 0 1 6 0 V7"/>',
	unlock: '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7 V5 a3 3 0 0 1 6 0"/>',
	folder: '<path d="M1 4 H6 L8 6 H15 V13 H1 Z"/>',
	triangle: '<path d="M5 3 L11 8 L5 13 Z"/>',
	straight: '<path d="M3 13 L13 3"/>',
	manhattan: '<path d="M3 13 H8 V3 H13"/>',
	curved: '<path d="M3 13 C3 5, 13 11, 13 3"/>',
	end: '<path d="M2 8 H12"/><path d="M10 5 L14 8 L10 11 Z" fill="currentColor"/>',
	both: '<path d="M4 8 H12"/><path d="M10 5 L14 8 L10 11 Z M6 5 L2 8 L6 11 Z" fill="currentColor"/>',
	none: '<path d="M2 8 H14"/>',
	dashed: '<path d="M2 8 H14" stroke-dasharray="3 2"/>',
};
export const icon = (key: keyof typeof ICON) =>
	`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">${ICON[key]}</svg>`;
// ---- Named styles: a style acts on its objects; an object only keeps what differs from it ----
export const SIZE_LABEL = { tiny: '6', scriptsize: '8', footnotesize: '9', small: '10', normalsize: '11', large: '12' };
export const KIND_NAMES = { box: 'Box', arrow: 'Arrow', frame: 'Frame', label: 'Label' };
export const STYLE_KEYS = styleable('box');
export const ROW_OF = rowOf();
export const ROUTE_OPTS: string[][] = [
	['auto', 'figure style'],
	['straight', 'straight'],
	['manhattan', 'manhattan'],
	['curved', 'curved'],
	['u', 'U route'],
];
export const routeOpts = (e: { route: string }) =>
	['hvh', 'vhv', 'bend', 'fixed', 'loop'].includes(e.route) ? [...ROUTE_OPTS, [e.route, 'set by hand']] : ROUTE_OPTS;
export const HEAD_OPTS = [
	['end', 'at the end'],
	['both', 'at both ends'],
	['none', 'none'],
];
export const STYLE_OPTS = [
	['straight', 'straight'],
	['manhattan', 'manhattan'],
	['curved', 'curved'],
];
const LINE_OPTS = [
	['arr', 'solid'],
	['arr-dashed', 'dashed'],
];
// TeX to display text and back: \_ is an underscore, \cmd{x} shows x, \\ breaks the line.
export const show = (t: string) => t.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1').replace(/\\([_&%#$])/g, '$1');
export const tex = (t: string) => t.replace(/(^|[^\\])([_&%#$])/g, '$1\\$2').replace(/(^|[^\\])([_&%#$])/g, '$1\\$2');
export const r1 = (v: number) => String(Math.round(v * 10) / 10);
export const dismissedHints = () => new Set<string>((vscode.getState() || {}).dismissedHints || []);
