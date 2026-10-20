// The property schema: one PropDef per appearance property and object kind (ADR-3).
// The order of this list is the order of every per-kind property list derived from it, so reordering it
// reorders `% sakuga style` lines. Where one kind needs a different position for a key, the key appears twice.
import { FONT_SIZES } from '../model/constants';
import { StyleKind } from '../model/figure';
import { PALETTE } from '../model/colour';

export type Kind = StyleKind;
export type PropKey = string;
export type PropType = 'colour' | 'enum' | 'number' | 'boolean' | 'string' | 'json';
export type TravelGroup = 'font' | 'stroke' | 'tips' | 'mark';
export type SectionId = 'fill' | 'stroke' | 'text' | 'tips' | 'frame' | 'title' | 'label' | 'mark';

export interface PropDef {
	key: PropKey;
	kinds: Kind[];
	type: PropType;
	// Enumerations list their values; colours accept the palette, #rrggbb and, with `none`, the word none.
	values?: readonly string[];
	none?: boolean;
	// What an unset value means; a function reads the other properties of the same object.
	default?: unknown | ((o: Record<string, any>) => unknown);
	styleable: boolean;
	// Properties of one travel group keep their meaning only together, so styles merge and reset them as one.
	travel?: TravelGroup;
	// How a length is formatted when the figure is scaled: relative to the geometry or to the stroke.
	length?: 'geometry' | 'stroke';
	// Position of the key in a group line (`% sakuga group`), for frame properties stored there.
	groupLine?: number;
	ui?: { section: SectionId; label: string; row?: string; order: number };
}

const BN: Kind[] = ['box', 'label'];
const BNA: Kind[] = ['box', 'label', 'arrow'];
const palette = Object.keys(PALETTE);
export const BORDERS = ['solid', 'dashed', 'dotted', 'double', 'none'] as const;
export const WEIGHTS = ['thin', 'medium', 'thick'] as const;
export const SHAPES = ['rounded', 'rectangle', 'pill', 'ellipse', 'circle', 'diamond', 'triangle', 'cylinder'] as const;
export const TEXT_STYLES = ['bold', 'italic', 'bold-italic'] as const;
export const TIPS = ['Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar', 'none'] as const;
export const PATTERNS = ['hatched', 'crosshatch', 'dots', 'horizontal', 'vertical'] as const;
export const CORNERS = ['ne', 'nw', 'se', 'sw'] as const;
export const MARKS = ['triangle', 'circle', 'none'] as const;
export const FRAME_LOOKS = ['none', 'dashed', 'dotted', 'solid', 'region'] as const;
export const TITLE_POSITIONS = ['legacy', 'above-left', 'above-right', 'below-left', 'below-right'] as const;

let order = 0;
const ui = (section: SectionId, label: string, row?: string) => ({ section, label, row, order: order++ });
const frameLine = (o: Record<string, any>) => o.frame;
const frameWidth = (o: Record<string, any>) =>
	frameLine(o) === 'region' || frameLine(o) === 'none' ? 0 : frameLine(o) === 'dotted' ? 1.5 : 0.7;
const framePadding = (o: Record<string, any>) =>
	frameLine(o) === 'dashed' ? 2.8 : frameLine(o) === 'dotted' ? 1.8 : 3;

export const PROPS: PropDef[] = [
	{ key: 'cornerRadius', kinds: BN, type: 'number', styleable: false, length: 'geometry' },
	{ key: 'dashOn', kinds: BN, type: 'number', styleable: false, length: 'stroke' },
	{ key: 'dashOff', kinds: BN, type: 'number', styleable: false, length: 'stroke' },
	{ key: 'roundCap', kinds: BN, type: 'boolean', styleable: false },
	{
		key: 'frame',
		kinds: ['frame'],
		type: 'enum',
		values: FRAME_LOOKS,
		default: 'dashed',
		styleable: true,
		ui: ui('frame', 'Frame'),
	},
	{ key: 'fill', kinds: BN, type: 'colour', none: true, default: undefined, styleable: true, ui: ui('fill', 'Fill') },
	{
		key: 'color',
		kinds: [...BNA, 'frame'],
		type: 'colour',
		default: undefined,
		styleable: true,
		ui: ui('stroke', 'Colour'),
	},
	{
		key: 'border',
		kinds: BN,
		type: 'enum',
		values: BORDERS,
		default: 'solid',
		styleable: true,
		ui: ui('stroke', 'Border'),
	},
	{
		key: 'border',
		kinds: ['arrow'],
		type: 'enum',
		values: BORDERS.filter((b) => b !== 'none'),
		default: 'solid',
		styleable: true,
		ui: ui('stroke', 'Border'),
	},
	{
		key: 'weight',
		kinds: BN,
		type: 'enum',
		values: WEIGHTS,
		default: 'thin',
		styleable: true,
		travel: 'stroke',
		ui: ui('stroke', 'Weight'),
	},
	{
		key: 'lineWidth',
		kinds: BN,
		type: 'number',
		default: undefined,
		styleable: true,
		travel: 'stroke',
		length: 'stroke',
		ui: ui('stroke', 'Line width', 'weight'),
	},
	{
		key: 'lineWidth',
		kinds: ['arrow'],
		type: 'number',
		default: 0.45,
		styleable: true,
		length: 'stroke',
		ui: ui('stroke', 'Line width'),
	},
	{
		key: 'shape',
		kinds: ['box'],
		type: 'enum',
		values: SHAPES,
		default: 'rounded',
		styleable: true,
		ui: ui('fill', 'Shape'),
	},
	{
		key: 'font',
		kinds: BN,
		type: 'enum',
		values: FONT_SIZES,
		default: undefined,
		styleable: true,
		travel: 'font',
		ui: ui('text', 'Size'),
	},
	{
		key: 'text',
		kinds: BN,
		type: 'enum',
		values: TEXT_STYLES,
		default: undefined,
		styleable: true,
		travel: 'font',
		ui: ui('text', 'Emphasis'),
	},
	{ key: 'textColor', kinds: BN, type: 'colour', default: undefined, styleable: true, ui: ui('text', 'Text colour') },
	{
		key: 'tipLength',
		kinds: ['arrow'],
		type: 'number',
		default: 1.5,
		styleable: true,
		travel: 'tips',
		length: 'geometry',
		ui: ui('tips', 'Tip length'),
	},
	{
		key: 'tipWidth',
		kinds: ['arrow'],
		type: 'number',
		default: 1.2,
		styleable: true,
		travel: 'tips',
		length: 'geometry',
		ui: ui('tips', 'Tip width'),
	},
	{
		key: 'start',
		kinds: ['arrow'],
		type: 'enum',
		values: TIPS,
		default: 'none',
		styleable: true,
		travel: 'tips',
		ui: ui('tips', 'Start tip'),
	},
	{
		key: 'end',
		kinds: ['arrow'],
		type: 'enum',
		values: TIPS,
		default: 'Latex',
		styleable: true,
		travel: 'tips',
		ui: ui('tips', 'End tip'),
	},
	{
		key: 'frameColor',
		kinds: ['frame'],
		type: 'colour',
		default: '',
		styleable: true,
		groupLine: 6,
		ui: ui('frame', 'Outline colour'),
	},
	{
		key: 'outline',
		kinds: ['frame'],
		type: 'enum',
		values: ['none', 'dashed', 'dotted', 'solid'],
		default: '',
		styleable: true,
		groupLine: 9,
		ui: ui('frame', 'Outline'),
	},
	{
		key: 'fill',
		kinds: ['frame'],
		type: 'colour',
		none: true,
		default: '',
		styleable: true,
		groupLine: 7,
		ui: ui('frame', 'Fill'),
	},
	{
		key: 'fillStrength',
		kinds: ['frame'],
		type: 'number',
		default: 30,
		styleable: true,
		groupLine: 8,
		ui: ui('frame', 'Fill strength'),
	},
	{
		key: 'lineWidth',
		kinds: ['frame'],
		type: 'number',
		default: frameWidth,
		styleable: true,
		length: 'stroke',
		groupLine: 5,
		ui: ui('frame', 'Line width'),
	},
	{
		key: 'padding',
		kinds: ['frame'],
		type: 'number',
		default: framePadding,
		styleable: true,
		length: 'geometry',
		groupLine: 0,
		ui: ui('frame', 'Padding'),
	},
	{
		key: 'titlePosition',
		kinds: ['frame'],
		type: 'enum',
		values: TITLE_POSITIONS,
		default: 'legacy',
		styleable: true,
		groupLine: 1,
		ui: ui('title', 'Position'),
	},
	{
		key: 'titleBold',
		kinds: ['frame'],
		type: 'boolean',
		default: false,
		styleable: true,
		groupLine: 2,
		ui: ui('title', 'Bold'),
	},
	{
		key: 'titleFont',
		kinds: ['frame'],
		type: 'enum',
		values: FONT_SIZES,
		default: 'scriptsize',
		styleable: true,
		groupLine: 3,
		ui: ui('title', 'Size'),
	},
	{
		key: 'titleColor',
		kinds: ['frame'],
		type: 'colour',
		default: '',
		styleable: true,
		groupLine: 4,
		ui: ui('title', 'Colour'),
	},
	// Stored in the group line but not an appearance property a style can hold: the hex-encoded label look.
	{ key: 'labelStyle', kinds: ['frame'], type: 'json', default: undefined, styleable: false, groupLine: 10 },
	// Properties of boxes and arrows no style holds, but which the option codecs read and write.
	{ key: 'position', kinds: ['arrow'], type: 'string', default: undefined, styleable: false },
	{ key: 'side', kinds: ['arrow'], type: 'string', default: undefined, styleable: false },
	{ key: 'compact', kinds: BN, type: 'boolean', default: false, styleable: false },
	{ key: 'step', kinds: BNA, type: 'number', default: undefined, styleable: false },
	{ key: 'opacity', kinds: BNA, type: 'number', default: 1, styleable: false },
	{
		key: 'pattern',
		kinds: BN,
		type: 'enum',
		values: PATTERNS,
		default: undefined,
		styleable: false,
		ui: ui('fill', 'Pattern'),
	},
	{
		key: 'patternColor',
		kinds: BN,
		type: 'colour',
		default: undefined,
		styleable: false,
		ui: ui('fill', 'Pattern colour'),
	},
	{
		key: 'mark',
		kinds: BN,
		type: 'enum',
		values: MARKS,
		default: 'none',
		styleable: false,
		travel: 'mark',
		ui: ui('mark', 'Corner mark'),
	},
	{
		key: 'markCorner',
		kinds: BN,
		type: 'enum',
		values: CORNERS,
		default: 'ne',
		styleable: false,
		travel: 'mark',
		ui: ui('mark', 'Corner'),
	},
	{
		key: 'markSize',
		kinds: BN,
		type: 'enum',
		values: ['small', 'medium'],
		default: 'small',
		styleable: false,
		travel: 'mark',
		ui: ui('mark', 'Size'),
	},
	{
		key: 'markColor',
		kinds: BN,
		type: 'colour',
		default: '#33333A',
		styleable: false,
		travel: 'mark',
		ui: ui('mark', 'Colour'),
	},
];

export const COLOUR_WORDS = palette;
