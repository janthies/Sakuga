import type { Mode } from './selection';
import type { RowSpec, SectionSpec } from './spec';
import { positionRow, sizeRow, opacityRow, tidyRow, alignRow, copyPasteRow, layerRow } from './rows-common';
import { placementRow, detachRow } from './rows-attach';
import { arrowLabelRow, stepRow, routeRow, laneRow, sidesRow, loopRows, resetAutoRow } from './rows-arrow';
import { frameNameRow } from './rows-frame';
import { labelTextRow, labelPositionRow, labelSideRow, labelActionsRow } from './rows-attached';
import { titleRow, codeRow, codeSizeRow, iconRow } from './rows-text';
import { categoryRow, lineLabelsRow, memberCountRow, itemTextRow } from './rows-model';

const category: RowSpec = { label: 'Category', custom: categoryRow };
const place: RowSpec = { label: 'Place', custom: placementRow };
const font: RowSpec[] = [
	{ prop: 'font', label: 'Text size' },
	{ prop: 'text', label: 'Weight' },
	{ prop: 'textColor' },
];
const pathFont: RowSpec[] = font.map((row) => ({ ...row, target: 'label' }));
const outline: RowSpec = { label: 'Outline', props: ['color', 'border'] };
const line: RowSpec = { label: 'Line', props: ['color', 'border'] };
const tips: RowSpec = { label: 'Tips', props: ['start', 'end'] };
const geometry: RowSpec[] = [
	{ label: 'Position', custom: positionRow },
	{ label: 'Size', custom: sizeRow },
	{ label: 'Opacity', class: 'opacity-row', custom: opacityRow },
	{ label: 'Move to layer', custom: layerRow },
	{ label: '', custom: alignRow },
	{ label: '', custom: tidyRow },
	{ label: '', custom: detachRow },
	{ label: '', custom: copyPasteRow },
];
const decorations: RowSpec[] = [
	'pattern',
	'patternColor',
	'mark',
	'markCorner',
	'markSize',
	'markColor',
	'double',
	'lineWidth',
].map((prop) => ({ prop }) as RowSpec);
const panel = (rows: RowSpec[], more: RowSpec[] = []): SectionSpec[] => [
	{ id: 'main', title: '', rows },
	...(more.length ? [{ id: 'more', title: 'More', collapsed: true, rows: more }] : []),
];
export const ARROW_MORE: RowSpec[] = [
	line,
	{ prop: 'lineWidth' },
	tips,
	{ label: 'Tip size', props: ['tipLength', 'tipWidth'] },
];
export const SPECS: Record<Mode, SectionSpec[]> = {
	none: [],
	box: panel(
		[
			category,
			{ label: 'Label', custom: titleRow },
			{ label: 'Code', custom: codeRow },
			place,
			{ prop: 'fill' },
			outline,
			{ prop: 'shape' },
		],
		[
			...geometry,
			...font,
			{ label: 'Icon', custom: iconRow },
			{ label: 'Code size', custom: codeSizeRow },
			...decorations,
		],
	),
	label: panel(
		[
			category,
			{ label: 'Text', custom: itemTextRow },
			place,
			{ prop: 'font', label: 'Size' },
			{ prop: 'textColor', label: 'Colour' },
			{ prop: 'text', label: 'Bold/italic' },
		],
		[
			...geometry,
			{ prop: 'fill' },
			outline,
			...decorations,
			{ label: 'Label at', custom: labelPositionRow },
			{ label: 'Label side', custom: labelSideRow },
		],
	),
	icon: panel([category, { label: 'Icon', custom: iconRow }, place], [...geometry, ...font]),
	arrow: panel(
		[
			category,
			{ label: 'Label', custom: arrowLabelRow },
			{ label: 'Step', custom: stepRow },
			place,
			{ label: 'Route', custom: routeRow },
			line,
			tips,
		],
		[
			...geometry,
			{ prop: 'lineWidth' },
			{ label: 'Tip size', props: ['tipLength', 'tipWidth'] },
			...pathFont,
			{ prop: 'position', label: 'Label at' },
			{ prop: 'side', label: 'Label side' },
			{ label: 'Lane', custom: laneRow },
			{ label: 'Sides', custom: sidesRow },
			{ label: 'Loop', custom: loopRows },
			{ label: '', custom: resetAutoRow },
		],
	),
	line: panel(
		[category, { label: 'Labels', custom: lineLabelsRow }, place, line, { prop: 'lineWidth', label: 'Width' }],
		[...geometry, ...pathFont],
	),
	frame: panel([{ label: 'Name', custom: frameNameRow }, { label: 'Members', custom: memberCountRow }, place]),
	attached: panel(
		[
			category,
			{ label: 'Text', custom: labelTextRow },
			place,
			{ prop: 'font', label: 'Size' },
			{ prop: 'textColor', label: 'Colour' },
			{ prop: 'text', label: 'Bold/italic' },
		],
		[
			{ label: 'Label at', custom: labelPositionRow },
			{ label: 'Label side', custom: labelSideRow },
			{ label: '', custom: labelActionsRow },
		],
	),
	layer: panel([{ label: 'Opacity', class: 'opacity-row', custom: opacityRow }]),
	multi: panel(
		[category],
		[
			...geometry,
			...font,
			{ label: '', custom: resetAutoRow },
			{ prop: 'fill' },
			outline,
			line,
			{ prop: 'shape' },
			{ prop: 'lineWidth' },
		],
	),
};
