import type { Mode } from './selection';
import {
	alignRow,
	copyPasteRow,
	layerNameRow,
	layerRow,
	opacityRow,
	positionRow,
	sizeRow,
	tidyRow,
} from './rows-common';
import { attachedToRow, detachRow, offsetRow, ownAnchorRow, parentAnchorRow, placementRow } from './rows-attach';
import {
	arrowLabelRow,
	endpointsRow,
	headsRow,
	laneRow,
	loopRows,
	resetAutoRow,
	routeRow,
	sidesRow,
	sourceColourRow,
	stepRow,
} from './rows-arrow';
import { frameFillRow, frameNameRow, frameTitlePositionRow } from './rows-frame';
import {
	frameTitleAtRow,
	labelActionsRow,
	labelColourRow,
	labelCopyPasteRow,
	labelFontRow,
	labelKnockoutRow,
	labelOffsetRow,
	labelPositionRow,
	labelSideRow,
	labelTextRow,
} from './rows-attached';
import { sharedHintRow, styleActionsRow, styleRow } from './rows-style';
import {
	codeRow,
	codeSizeRow,
	iconPositionRow,
	iconRow,
	styleIconRow,
	thinFrameRow,
	titlePositionRow,
	titleRow,
	widenedNoteRow,
} from './rows-text';
import type { PanelCtx, RowSpec, SectionSpec } from './spec';

// The inspector of every kind of object, as data. Each declares the same skeleton (Style, Text, Appearance,
// Shape & decoration, Arrange); a section it leaves out, or whose rows all have nothing to show, stays hidden.
// Property rows name a schema key; the schema's ui hints give the label, the control and the values.

const hasMark = (c: PanelCtx) => c.sel.nodes.some((n) => n.style?.mark && n.style.mark !== 'none');

const STYLE: RowSpec[] = [
	{ label: 'Style', custom: styleRow },
	{ label: '', custom: styleActionsRow },
	{ label: '', custom: sharedHintRow },
];
const FONT: RowSpec[] = [{ label: 'Font', props: ['text', 'font'] }, { prop: 'textColor' }];
const OPACITY: RowSpec = { label: 'Opacity', class: 'opacity-row', custom: opacityRow };
const NODE_LOOK: RowSpec[] = [
	{ prop: 'fill' },
	{ prop: 'border' },
	{ prop: 'color', label: 'Outline' },
	{ prop: 'weight' },
];
const DECORATION: RowSpec[] = [
	{ prop: 'pattern' },
	{ prop: 'patternColor' },
	{ prop: 'mark' },
	{ prop: 'markCorner', when: hasMark },
	{ prop: 'markSize', when: hasMark },
	{ prop: 'markColor', when: hasMark },
];
const ARROW_LOOK: RowSpec[] = [
	{ label: 'Route', custom: routeRow },
	{ label: 'Heads', custom: headsRow },
	{ prop: 'border', label: 'Line' },
	{ prop: 'color', label: 'Colour' },
	{ prop: 'lineWidth' },
	{ label: 'Tips', props: ['start', 'end'] },
	{ label: 'Tip size', props: ['tipLength', 'tipWidth'] },
];
// Tidy up needs boxes, or an empty arrow selection (then it tidies the whole figure).
const TIDY: RowSpec = { label: '', custom: tidyRow, when: (c) => !c.sel.edges.length || !!c.sel.nodes.length };
// The arrow's own toolbar offers its look and its numbering without opening the inspector.
export const ARROW_MORE: RowSpec[] = [
	...ARROW_LOOK.slice(2),
	{ prop: 'position', label: 'Label at' },
	{ prop: 'side', label: 'Label side' },
	{ label: 'Step', custom: stepRow },
	{ label: '', custom: sourceColourRow },
	{ label: '', custom: copyPasteRow },
];
const ARRANGE_NODES: RowSpec[] = [
	{ label: '', custom: alignRow },
	TIDY,
	{ label: 'Position', custom: positionRow },
	{ label: 'Size', custom: sizeRow, when: (c) => c.sel.mode !== 'frame' },
	{ label: 'Attached to', custom: attachedToRow },
	{ label: 'Parent anchor', custom: parentAnchorRow },
	{ label: 'Own anchor', custom: ownAnchorRow },
	{ label: 'Offset', custom: offsetRow },
	{ label: '', custom: detachRow },
	{ label: 'Placement', custom: placementRow },
];
const ARRANGE_ARROWS: RowSpec[] = [
	{ label: '', custom: resetAutoRow },
	{ label: 'Loop', custom: loopRows },
	{ label: 'Ends', custom: endpointsRow },
	{ label: 'Sides', custom: sidesRow },
	{ label: 'Lane', custom: laneRow },
	{ label: 'Step', custom: stepRow },
	{ label: '', custom: sourceColourRow },
];
const ARRANGE_END: RowSpec[] = [
	{ label: 'Move to layer', custom: layerRow },
	{ label: '', custom: copyPasteRow, when: (c) => c.sel.count > 0 || !!c.sel.group },
];

const BOX: SectionSpec[] = [
	{ id: 'style', title: 'Style', rows: STYLE },
	{
		id: 'text',
		title: 'Text',
		rows: [
			{ label: 'Title', custom: titleRow },
			{ label: 'Code', custom: codeRow },
			...FONT,
			{ label: 'Code size', custom: codeSizeRow },
			{ label: '', custom: widenedNoteRow },
			{ label: 'Title position', custom: titlePositionRow },
		],
	},
	{ id: 'appearance', title: 'Appearance', rows: [...NODE_LOOK, OPACITY] },
	{
		id: 'decoration',
		title: 'Shape & decoration',
		collapsed: true,
		rows: [
			{ prop: 'shape' },
			{ label: 'Icon', custom: iconRow },
			{ label: 'Icon position', custom: iconPositionRow },
			{ label: 'Style icon', custom: styleIconRow },
			...DECORATION,
		],
	},
	{ id: 'arrange', title: 'Arrange', collapsed: true, rows: [...ARRANGE_NODES, ...ARRANGE_END] },
];

const LABEL: SectionSpec[] = [
	{ id: 'style', title: 'Style', rows: STYLE },
	{ id: 'text', title: 'Text', rows: [{ label: 'Title', custom: titleRow }, ...FONT] },
	{
		id: 'appearance',
		title: 'Appearance',
		rows: [...NODE_LOOK, { label: 'Thin frame', custom: thinFrameRow }, OPACITY],
	},
	{ id: 'decoration', title: 'Shape & decoration', collapsed: true, rows: DECORATION },
	{ id: 'arrange', title: 'Arrange', collapsed: true, rows: [...ARRANGE_NODES, ...ARRANGE_END] },
];

const ICON: SectionSpec[] = [
	{ id: 'text', title: 'Text', rows: [{ label: 'Label', custom: titleRow }, ...FONT] },
	{ id: 'appearance', title: 'Appearance', rows: [{ label: 'Icon', custom: iconRow }, OPACITY] },
	{ id: 'arrange', title: 'Arrange', collapsed: true, rows: [...ARRANGE_NODES, ...ARRANGE_END] },
];

const ARROW: SectionSpec[] = [
	{
		id: 'text',
		title: 'Label',
		rows: [
			{ label: 'Label', custom: arrowLabelRow },
			{ prop: 'position', label: 'Label at' },
			{ prop: 'side', label: 'Label side' },
		],
	},
	{ id: 'appearance', title: 'Appearance', rows: [...ARROW_LOOK, OPACITY] },
	{
		id: 'arrange',
		title: 'Arrange',
		collapsed: true,
		rows: [...ARRANGE_ARROWS, ...ARRANGE_END],
	},
];

const FRAME: SectionSpec[] = [
	{ id: 'text', title: 'Group', rows: [{ label: 'Name', custom: frameNameRow }] },
	{ id: 'arrange', title: 'Arrange', rows: [{ label: 'Position', custom: positionRow }, ...ARRANGE_END] },
];

const ATTACHED: SectionSpec[] = [
	{
		id: 'text',
		title: 'Text',
		rows: [
			{ label: 'Text', custom: labelTextRow },
			{ label: 'Font', custom: labelFontRow },
			{ label: 'Colour', custom: labelColourRow },
		],
	},
	{ id: 'appearance', title: 'Appearance', rows: [{ label: 'Knock-out', custom: labelKnockoutRow }] },
	{
		id: 'arrange',
		title: 'Arrange',
		rows: [
			{ label: 'Position', custom: labelPositionRow },
			{ label: 'Side', custom: labelSideRow },
			{ label: 'Title at', custom: frameTitleAtRow },
			{ label: 'Offset', custom: labelOffsetRow },
			{ label: '', custom: labelActionsRow },
			{ label: '', custom: labelCopyPasteRow },
		],
	},
];

const LAYER: SectionSpec[] = [
	{ id: 'text', title: 'Name', rows: [{ label: 'Name', custom: layerNameRow }] },
	{ id: 'appearance', title: 'Appearance', rows: [OPACITY] },
];

// Several objects: the rows of boxes and arrows together; each row shows only if every selected object has it.
const MULTI: SectionSpec[] = [
	{ id: 'style', title: 'Style', rows: STYLE },
	{
		id: 'text',
		title: 'Text',
		rows: [{ label: 'Title', custom: titleRow }, ...FONT, { label: 'Code size', custom: codeSizeRow }],
	},
	{
		id: 'appearance',
		title: 'Appearance',
		rows: [...ARROW_LOOK.slice(0, 2), ...NODE_LOOK, ...ARROW_LOOK.slice(2), OPACITY],
	},
	{
		id: 'decoration',
		title: 'Shape & decoration',
		collapsed: true,
		rows: [
			{ prop: 'shape' },
			{ label: 'Icon', custom: iconRow },
			{ label: 'Icon position', custom: iconPositionRow },
			{ label: 'Style icon', custom: styleIconRow },
			...DECORATION,
		],
	},
	{
		id: 'arrange',
		title: 'Arrange',
		collapsed: true,
		rows: [
			{ label: '', custom: alignRow },
			TIDY,
			{ label: '', custom: resetAutoRow },
			{ label: 'Position', custom: positionRow },
			{ label: 'Size', custom: sizeRow },
			...ARRANGE_END,
		],
	},
];

const NONE: SectionSpec[] = [{ id: 'arrange', title: 'Arrange', collapsed: true, rows: [TIDY] }];

export const SPECS: Record<Mode, SectionSpec[]> = {
	none: NONE,
	box: BOX,
	label: LABEL,
	icon: ICON,
	arrow: ARROW,
	frame: FRAME,
	attached: ATTACHED,
	layer: LAYER,
	multi: MULTI,
};
