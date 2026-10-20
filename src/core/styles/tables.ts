// Which properties a named style can hold, and which travel together.
import { StyleKind } from '../model/figure';

// Properties a style can hold for the objects that use it, and groups that always travel together
// (a font size without the emphasis, or the tips of an arrow, would change meaning if split).
export const STYLEABLE: Record<StyleKind, string[]> = {
	box: ['fill', 'color', 'border', 'weight', 'lineWidth', 'shape', 'font', 'text', 'textColor'],
	label: ['fill', 'color', 'border', 'weight', 'lineWidth', 'font', 'text', 'textColor'],
	arrow: ['color', 'border', 'lineWidth', 'tipLength', 'tipWidth', 'start', 'end'],
	frame: [
		'frame',
		'color',
		'frameColor',
		'outline',
		'fill',
		'fillStrength',
		'lineWidth',
		'padding',
		'titlePosition',
		'titleBold',
		'titleFont',
		'titleColor',
	],
};

export const STYLE_GROUPS: Record<StyleKind, string[][]> = {
	box: [
		['font', 'text'],
		['weight', 'lineWidth'],
	],
	label: [
		['font', 'text'],
		['weight', 'lineWidth'],
	],
	arrow: [['tipLength', 'tipWidth', 'start', 'end']],
	frame: [],
};

export const PRIMARY: Record<StyleKind, string> = { box: 'fill', label: 'textColor', arrow: 'color', frame: 'color' };

export const NUMBER_PROPS = ['lineWidth', 'tipLength', 'tipWidth', 'fillStrength', 'padding'];

export const BOOLEAN_PROPS = ['titleBold'];
