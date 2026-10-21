import { PropDef, PropKey } from '../../../core/schema';
import { Control, MIXED, h } from '../../ui/control';
import { ColourControl } from '../../ui/colour';
import { Emphasis, EmphasisValue } from '../../ui/emphasis';
import { hasGlyph } from '../../ui/glyph';
import { NumberControl, NumberOptions } from '../../ui/number';
import { Row } from '../../ui/row';
import { SelectControl } from '../../ui/select';
import { SegmentOption, Segmented } from '../../ui/segmented';
import { TextControl } from '../../ui/text';
import { Toggle } from '../../ui/toggle';
import { WeightControl } from '../../ui/weight';
import { SIZE_LABEL } from '../../store/constants';
import { fillOf, styleColor } from '../../render/svg';
import { saveState } from '../../store/prefs';
import { store } from '../../store/store';
import type { PanelCtx, RowSpec } from './spec';

// How a schema property becomes a control. The schema says what a property is; this file only says how to draw it.

const COLOUR_DEFAULT: Record<string, string> = {
	fill: 'style / white',
	color: 'grey',
	patternColor: 'black 25%',
	markColor: '#33333A',
	textColor: 'black',
};
const NUMBER: Record<string, NumberOptions> = {
	lineWidth: { step: 0.05, min: 0.05 },
	tipLength: { step: 0.05, min: 0.05 },
	tipWidth: { step: 0.05, min: 0.05 },
	padding: { step: 0.5, min: 0 },
	fillStrength: { step: 5, min: 0, max: 100 },
};
const UNIT: Record<string, string> = { fillStrength: '%' };
// Short labels inside the field when two numbers share a row.
const PREFIX: Record<string, string> = { tipLength: 'Length', tipWidth: 'Width' };
// Names and tooltips of option values the raw value does not say well.
const NAMES: Record<string, string> = {
	'': 'Default',
	rounded: 'Rounded rectangle',
	ne: 'Top right',
	nw: 'Top left',
	se: 'Bottom right',
	sw: 'Bottom left',
	small: 'Small (2.4 mm)',
	medium: 'Medium (5 mm)',
	hatched: 'Hatched',
};
const SHORT: Record<string, string> = { small: 'S', medium: 'M' };
// Properties whose default value is stored as "not set" (an empty string), never spelled out.
const UNSET_DEFAULT = new Set(['shape', 'mark', 'markCorner', 'markSize']);
// Values that read better in a drop-down than as buttons.
const AS_SELECT = new Set(['start', 'end', 'frame', 'titleFont']);
const FOR_NONE: Record<string, string> = { pattern: 'None' };

const optionLabel = (v: string) => NAMES[v] ?? v;

function enumOptions(def: PropDef): SegmentOption<string>[] {
	const values = [...(def.values || [])];
	if (def.default === undefined && !values.includes('')) values.unshift('');
	return values.map((v) => ({
		value: v,
		label: v === '' ? FOR_NONE[def.key] || optionLabel(v) : optionLabel(v),
		text: SHORT[v] && def.key === 'markSize' ? SHORT[v] : undefined,
	}));
}

export interface Bound {
	control: Control<any>;
	keys: PropKey[];
	label: string;
}

const patchOf = (ctx: PanelCtx, key: PropKey) => (value: unknown) => ctx.subject.write({ [key]: value });

// A colour control for a property key: the style colour, the palette, recent and custom colours.
export function newColour(key: string, none: boolean | undefined, defaultSwatch = '#9e9e9e'): ColourControl {
	return new ColourControl({
		name: key,
		defaultLabel: COLOUR_DEFAULT[key] || 'default',
		defaultSwatch,
		palette: Object.keys(store.palette),
		swatch: (k) => styleColor(k, '#fff') as string,
		none,
		recent: () => store.recentColors,
		remember: (hex) => {
			store.recentColors = [hex, ...store.recentColors.filter((c) => c !== hex)].slice(0, 8);
			saveState();
		},
		pickerStart: key === 'markColor' ? '#33333a' : '#000000',
	});
}

function colour(ctx: PanelCtx, def: PropDef, current: string, mixed: boolean) {
	const first = ctx.sel.nodes[0];
	const control = newColour(def.key, def.none, def.key === 'fill' && first ? fillOf(first.cat) : '#9e9e9e');
	control.set(mixed ? MIXED : current, { inherited: ctx.subject.read(def).inherited });
	control.onCommit((v) => patchOf(ctx, def.key)(v ?? ''));
	return control;
}

// The control for one property, filled from the selection and wired to commit through the subject.
export function bindProp(ctx: PanelCtx, key: PropKey): Bound | null {
	const def = ctx.subject.def(key);
	if (!def) return null;
	const read = ctx.subject.read(def);
	const state = { inherited: read.inherited };
	const value = read.mixed ? MIXED : read.value;
	const label = def.ui?.label || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (v) => v.toUpperCase());

	if (key === 'weight') {
		const c = new WeightControl();
		const width = ctx.subject.def('lineWidth');
		const w = width ? ctx.subject.read(width) : null;
		c.set(
			read.mixed || w?.mixed
				? MIXED
				: {
						weight: String(read.value || ''),
						lineWidth: ctx.subject.isSet('lineWidth') ? (w!.value as number) : undefined,
					},
			state,
		);
		c.onCommit((patch) => ctx.subject.write(patch!));
		return { control: c, keys: ['weight'], label };
	}
	if (key === 'text') {
		const c = new Emphasis();
		c.set(read.mixed ? MIXED : (String(read.value) as EmphasisValue), state);
		c.onCommit((v) => patchOf(ctx, key)(v ?? ''));
		return { control: c, keys: [key], label };
	}
	if (key === 'font' || key === 'titleFont') {
		const sizes = def.values || [];
		const c = new SelectControl(
			[
				...(key === 'font' ? [{ value: '', label: 'Auto' }] : []),
				...sizes.map((v) => ({ value: v, label: `${(SIZE_LABEL as Record<string, string>)[v] || v} pt` })),
			],
			'Font size',
		);
		c.set(value as string, state);
		c.onCommit((v) => patchOf(ctx, key)(v ?? ''));
		return { control: c, keys: [key], label };
	}

	let control: Control<any>;
	switch (def.type) {
		case 'colour':
			return { control: colour(ctx, def, String(read.value ?? ''), read.mixed), keys: [key], label };
		case 'number': {
			const unit = UNIT[key] ?? (def.length === 'stroke' ? 'pt' : def.length === 'geometry' ? 'mm' : undefined);
			const c = new NumberControl({ ...NUMBER[key], unit, prefix: PREFIX[key], ariaLabel: label });
			c.set(value as number, state);
			c.onCommit((v) => patchOf(ctx, key)(v === null ? cleared(ctx, def) : v));
			return { control: c, keys: [key], label };
		}
		case 'boolean': {
			const c = new Toggle({ glyph: key === 'titleBold' ? 'bold' : undefined, label });
			c.set(value as boolean, state);
			c.onCommit((v) => patchOf(ctx, key)(!!v));
			return { control: c, keys: [key], label };
		}
		case 'enum': {
			const options = enumOptions(def);
			const shown = read.value === '' && typeof def.default === 'string' ? def.default : read.value;
			// The default of some properties is stored as "not set".
			const store_ = (v: string) => (UNSET_DEFAULT.has(key) && v === def.default ? '' : v);
			if (
				AS_SELECT.has(key) ||
				options.length > (key === 'shape' ? 8 : 7) ||
				!options.every((o) => hasGlyph(o.value, o.label) || o.text || o.value === '')
			) {
				const c = new SelectControl(options, label);
				c.set((read.mixed ? MIXED : shown) as string, state);
				c.onCommit((v) => patchOf(ctx, key)(store_(v ?? '')));
				control = c;
			} else {
				const c = new Segmented(options, label);
				c.set((read.mixed ? MIXED : shown) as string, state);
				c.onCommit((v) => patchOf(ctx, key)(store_(v ?? '')));
				control = c;
			}
			return { control, keys: [key], label };
		}
		default: {
			const c = new TextControl({ ariaLabel: label });
			c.set(read.mixed ? MIXED : String(read.value ?? ''), state);
			c.onCommit((v) => patchOf(ctx, key)(v ?? ''));
			return { control: c, keys: [key], label };
		}
	}
}

// What clearing a number field stands for: the default, so the property never holds nothing.
function cleared(ctx: PanelCtx, def: PropDef): number | null {
	if (ctx.subject.kinds.includes('frame')) return null;
	if (typeof def.default === 'number') return def.default;
	return def.key === 'lineWidth' ? 0.45 : null;
}

// A row from a prop or props spec, or null when the objects lack the property.
export function propRow(ctx: PanelCtx, spec: Extract<RowSpec, { prop: PropKey } | { props: PropKey[] }>): Row | null {
	const keys = 'prop' in spec ? [spec.prop] : spec.props;
	const bound = keys.map((k) => bindProp(ctx, k));
	if (bound.some((b) => !b)) return null;
	const label = spec.label ?? bound[0]!.label;
	const row = new Row(
		label,
		bound.map((b) => b!.control),
	);
	const reset = bound.flatMap((b) => b!.keys);
	for (const b of bound) b!.control.el.title = ctx.subject.read(ctx.subject.def(b!.keys[0])!).source || '';
	if (ctx.subject.overridden(reset)) {
		row.override(() => ctx.subject.reset(reset));
		if (ctx.subject.apply) {
			const apply = h('button', 'apply-prop', { type: 'button' }, ctx.subject.applyLabel || 'Apply to theme');
			apply.onclick = () => ctx.subject.apply!(reset);
			row.el.append(apply);
		}
	}
	return row;
}
