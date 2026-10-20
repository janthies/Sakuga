// What the rest of core asks the schema: styleable keys, travel groups, primary colour, value types.
import { Kind, PROPS, PropDef, PropKey, TravelGroup } from './props';

export * from './props';

const TRAVEL_ORDER: TravelGroup[] = ['font', 'stroke', 'tips'];

// Properties that make up the colour of a style: the bare colour token on a style line stands for this one.
const PRIMARY: Record<Kind, PropKey> = { box: 'fill', label: 'textColor', arrow: 'color', frame: 'color' };

export const defsOf = (kind: Kind): PropDef[] => PROPS.filter((d) => d.kinds.includes(kind));
export const defOf = (kind: Kind, key: PropKey): PropDef | undefined => defsOf(kind).find((d) => d.key === key);
export const anyDef = (key: PropKey): PropDef | undefined => PROPS.find((d) => d.key === key);

const STYLEABLE = {} as Record<Kind, PropKey[]>,
	GROUPS = {} as Record<Kind, PropKey[][]>;
for (const kind of ['box', 'label', 'arrow', 'frame'] as Kind[]) {
	const defs = defsOf(kind).filter((d) => d.styleable);
	STYLEABLE[kind] = defs.map((d) => d.key);
	GROUPS[kind] = TRAVEL_ORDER.map((t) => defs.filter((d) => d.travel === t).map((d) => d.key)).filter((g) => g.length);
}

// Keys a named style of this kind can hold, in the order its `% sakuga style` line lists them.
export const styleable = (kind: Kind): PropKey[] => STYLEABLE[kind];
// Keys that always travel together when a style is merged, overridden or reset.
export const travelGroups = (kind: Kind): PropKey[][] => GROUPS[kind];
export const primaryProp = (kind: Kind): PropKey => PRIMARY[kind];

export const isNumberProp = (key: PropKey) => PROPS.some((d) => d.key === key && d.type === 'number');
export const isBooleanProp = (key: PropKey) => PROPS.some((d) => d.key === key && d.type === 'boolean');

// The frame properties of a group line, in the order of that line.
export const groupLineDefs = (): PropDef[] =>
	PROPS.filter((d) => d.groupLine !== undefined).sort((a, b) => a.groupLine! - b.groupLine!);
export const groupKeys = (): PropKey[] => groupLineDefs().map((d) => d.key);

// Default of a group-line property for a group with the given look.
export const defaultOf = (d: PropDef, o: Record<string, any>) =>
	typeof d.default === 'function' ? (d.default as (o: Record<string, any>) => unknown)(o) : d.default;

// Inspector rows that show more than one property: the key of the row a property is edited in.
export const rowOf = (): Record<PropKey, string> =>
	Object.fromEntries(PROPS.filter((d) => d.ui?.row).map((d) => [d.key, d.ui!.row!]));
