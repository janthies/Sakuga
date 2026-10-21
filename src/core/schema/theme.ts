// House values live with the property schema. The public kinds use the object tree names.
import type { ItemKind } from '../model/item';
import type { Figure } from '../model/figure';
import { fontSize } from '../model/queries';
import { defsOf, defaultOf } from './index';
import type { Kind } from './props';
export const schemaKind: Record<ItemKind, Kind> = {
	Shape: 'box',
	Frame: 'frame',
	Connector: 'arrow',
	Line: 'arrow',
	Text: 'label',
	Icon: 'label',
};
export const ITEM_KINDS: ItemKind[] = ['Shape', 'Frame', 'Connector', 'Line', 'Text', 'Icon'];
export function houseValues(kind: ItemKind): Record<string, any> {
	const values: Record<string, any> = {};
	for (const d of defsOf(schemaKind[kind])) values[d.key] = defaultOf(d, values);
	return {
		...values,
		...(kind === 'Shape'
			? { fill: 'white', color: '#9E9E9E', font: 'small', lineWidth: 0.45, innerPadding: 1.2, outerGap: 1 }
			: {}),
		...(kind === 'Text' || kind === 'Icon'
			? { fill: 'none', border: 'none', textColor: kind === 'Icon' ? '#666666' : '#595959', font: 'small' }
			: {}),
		...(kind === 'Connector' || kind === 'Line' ? { color: '#808080' } : {}),
		...(kind === 'Line' ? { start: 'none', end: 'none' } : {}),
	};
}
export function themeValues(fig: Figure, kind: ItemKind): Record<string, any> {
	return { ...houseValues(kind), ...(kind !== 'Frame' ? { font: fontSize(fig) } : {}), ...fig.theme?.kinds?.[kind] };
}
