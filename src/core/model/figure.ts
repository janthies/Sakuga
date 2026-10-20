// Source-order records and the editable object tree.
import type { FigLine, Item } from './item';
import type { FigNode, FigEdge, StyleDef, Layer, Group } from './payload';
export type * from './payload';

export type Line =
	| { t: 'node'; n: FigNode }
	| { t: 'edge'; e: FigEdge }
	| { t: 'line'; line: FigLine }
	| { t: 'style'; s: StyleDef }
	| { t: 'legendflag'; on: boolean }
	| { t: 'arrowsflag'; style: string }
	| { t: 'layer'; layer: Layer }
	| { t: 'group'; g: Group }
	| { t: 'groups' }
	| { t: 'theme' }
	| { t: 'tree' }
	| { t: 'icons' }
	| { t: 'legend' }
	| { t: 'raw'; text: string };

export interface Figure {
	figure?: { place: string; label: string; caption: string };
	theme?: import('./look').Theme;
	items?: Item[];
	lines: Line[];
}
