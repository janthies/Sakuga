// Fixed vocabularies of the figure dialect.
import { StyleKind } from './figure';

export const FONT_SIZES = ['scriptsize', 'footnotesize', 'small', 'normalsize', 'large'];

export const ARROWS = ['arr', 'arr-dashed'] as const;

export const DEFAULT_WIDTH = 26;

export const STYLE_KINDS: StyleKind[] = ['box', 'arrow', 'frame', 'label'];

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

export const FRAMES = ['none', 'dashed', 'dotted', 'solid', 'region'] as const;

export const STYLES = ['straight', 'manhattan', 'curved'] as const;
