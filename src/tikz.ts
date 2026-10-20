// The figure dialect and its operations (the former single file): everything lives in src/core now.
export { PALETTE, darkerColor } from './core/model/colour';
export { FONT_SIZES, ARROWS, DEFAULT_WIDTH, STYLE_KINDS, ANCHORS, FRAMES, STYLES } from './core/model/constants';
export {
	fontSize,
	smallerFont,
	nodeOpacity,
	edgeLayerOpacity,
	styleDefs,
	findStyle,
	categories,
	nodeStyleKind,
	nodes,
	edges,
	groups,
	layers,
	nodeLayer,
	isHidden,
	isLocked,
	legendOn,
	arrowStyle,
} from './core/model/queries';
export type {
	ObjectStyle,
	Icon,
	Category,
	StyleKind,
	StyleDef,
	Attachment,
	FigNode,
	Layer,
	LabelStyle,
	AttachedLabel,
	Group,
	FigEdge,
	Figure,
} from './core/model/figure';
export { setIcons } from './core/context';
export { STYLEABLE } from './core/styles/tables';
export { cleanLabel, frameAppearance } from './core/styles/appearance';
export { styleLine } from './core/codec/style-line';
export {
	styleOf,
	styleableOf,
	mergeStyle,
	overrideOf,
	overrideKeys,
	settle,
	sharedOverrides,
} from './core/styles/resolve';
export { parse } from './core/codec/parse';
export { boxHalf, anchorPoint, resolveAttachments } from './core/geometry/boxes';
export { resolveRoute, routeObjects, specialGeometry } from './core/geometry/resolve';
export { serialize } from './core/codec/serialize';
export type { Op } from './core/ops/types';
export { slugKey } from './core/ops/style-helpers';
export { apply } from './core/ops/apply';
export { TEMPLATE } from './core/codec/template';
export { pasteOps } from './core/ops/paste';
