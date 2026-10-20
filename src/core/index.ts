// Entry for the built out/core.js that scripts/*.cjs and tests require: re-exports the core API.
export type { Item, ItemKind, TextItem, FigLine, Port, Endpoint } from './model/item';
export { CHILD_RULES } from './model/item';
export {
	items,
	itemById,
	childrenOf,
	ancestors,
	descendants,
	layerOf,
	itemsOfLayer,
	titleOf,
	subtreeState,
} from './model/tree-queries';
export { syncTree, lineItems } from './model/tree';
export { reparent, detach, ungroup } from './ops/tree';
export { PALETTE, darkerColor } from './model/colour';
export { FONT_SIZES, ARROWS, DEFAULT_WIDTH, STYLE_KINDS, ANCHORS, FRAMES, STYLES } from './model/constants';
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
} from './model/queries';
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
} from './model/figure';
export { setIcons } from './context';
export { styleable } from './schema';
export { cleanLabel, frameAppearance } from './styles/appearance';
export { styleLine } from './codec/style-line';
export { styleOf, styleableOf, mergeStyle, overrideOf, overrideKeys, settle, sharedOverrides } from './styles/resolve';
export { parse } from './codec/parse';
export { boxHalf, anchorPoint, resolveAttachments } from './geometry/boxes';
export { resolveRoute } from './geometry/resolve';
export { routeObjects, specialGeometry } from './geometry/figure-geometry';
export { serialize } from './codec/serialize';
export { serializeSubset } from './codec/subset';
export type { ObjectRef } from './model/refs';
export type { Op } from './ops/types';
export { slugKey } from './ops/style-helpers';
export { apply } from './ops/apply';
export { TEMPLATE } from './codec/template';
export { pasteOps } from './ops/paste';

export { resolveLook, categoryKey, categoryValues } from './styles/cascade';
export { houseValues, themeValues } from './schema/theme';
export type { Theme, ValueSource, ResolvedValue } from './model/look';
export type { LookOp } from './ops/look';
