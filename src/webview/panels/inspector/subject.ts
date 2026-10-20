import { PropDef, PropKey, defOf, defaultOf } from '../../../core/schema';
import { isOverride, post, styleDef } from '../../store/model';
import type { Group, Op, ViewEdge, ViewNode, ViewStyle } from '../../store/types';
import type { Style } from '../../ui/control';
import type { Selection } from './selection';

// What a row edits: the properties of a set of objects (boxes, arrows, one frame, or a named style).
// A row reads the value the objects share (or learns that they differ) and commits a patch of properties.
export type ObjKind = 'box' | 'label' | 'icon' | 'arrow' | 'frame';

export interface Reading {
	value: unknown;
	mixed: boolean;
	// Every object shows the value its style gives it.
	inherited: boolean;
}

export interface Subject {
	kinds: ObjKind[];
	// The schema's definition of a property, if every object has it.
	def(key: PropKey): PropDef | null;
	read(def: PropDef): Reading;
	// Does any object spell the property out (rather than leave it unset)?
	isSet(key: PropKey): boolean;
	write(patch: Style): void;
	overridden(keys: PropKey[]): boolean;
	reset(keys: PropKey[]): void;
}

// Icons take the text properties of labels.
const schemaKind = (k: ObjKind) => (k === 'icon' ? 'label' : k);
const same = (values: unknown[]) => values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]));
const NAMED_WIDTH: Record<string, number> = { medium: 0.8, thick: 1.2 };

// ---- Boxes, labels, icons, arrows ----
interface Item {
	kind: ObjKind;
	node?: ViewNode;
	edge?: ViewEdge;
	index?: number;
}

const dashedByKind = (e: ViewEdge) => (e.kind === 'arr-dashed' ? 'dashed' : '');
const tipFromHead = (e: ViewEdge, key: string) =>
	key === 'start' ? (e.head === 'both' ? 'Latex' : 'none') : e.head === 'none' ? 'none' : 'Latex';

// The value one object shows for a property.
function own(item: Item, def: PropDef): unknown {
	const o = (item.node || item.edge)!;
	const s: Style = o.style || {};
	if (def.key === 'lineWidth') return s.lineWidth ?? (NAMED_WIDTH[s.weight] || 0.45);
	if (item.edge && (def.key === 'start' || def.key === 'end')) return s[def.key] || tipFromHead(item.edge, def.key);
	if (item.edge && def.key === 'border') return s.border || dashedByKind(item.edge);
	if (def.type === 'number') return s[def.key] ?? defaultOf(def, s);
	return s[def.key] ?? '';
}

export class ObjectSubject implements Subject {
	readonly kinds: ObjKind[];

	constructor(private items: Item[]) {
		this.kinds = [...new Set(items.map((i) => i.kind))];
	}

	static of(sel: Selection): ObjectSubject {
		const items: Item[] = [
			...sel.nodes.map((node): Item => ({
				kind: node.kind === 'icon' ? 'icon' : node.kind === 'label' ? 'label' : 'box',
				node,
			})),
			...sel.edges.map(({ e, i }): Item => ({ kind: 'arrow', edge: e, index: i })),
		];
		return new ObjectSubject(items);
	}

	def(key: PropKey): PropDef | null {
		const defs = this.items.map((i) => defOf(schemaKind(i.kind), key));
		return defs.length && defs.every(Boolean) ? defs[0]! : null;
	}

	read(def: PropDef): Reading {
		const values = this.items.map((i) => own(i, def));
		const styled = (i: Item) => {
			const key = i.edge ? i.edge.cat || i.edge.styleKey : i.node!.cat;
			return !!key && !!styleDef(key) && !(i.node?.kind === 'icon');
		};
		return {
			value: values[0],
			mixed: !same(values),
			inherited: this.items.every((i) => {
				const o = (i.node || i.edge)!;
				return o.look ? !(def.key in o.look.own) : styled(i) && def.styleable && !isOverride(o, def.key);
			}),
		};
	}

	isSet(key: PropKey): boolean {
		return this.items.some((i) => ((i.node || i.edge)!.style as Style | undefined)?.[key] !== undefined);
	}

	// One batch of style ops: the boxes together, the arrows together.
	write(patch: Style): void {
		const ids = this.items.flatMap((i) => (i.node ? [i.node.id] : []));
		const indices = this.items.flatMap((i) => (i.edge ? [i.index!] : []));
		const ops: Op[] = [];
		if (ids.length) ops.push({ op: 'style', ids, style: patch });
		if (indices.length) ops.push({ op: 'style', indices, style: patch });
		post({ op: 'batch', ops });
	}

	overridden(keys: PropKey[]): boolean {
		return this.items.some((i) => keys.some((k) => isOverride((i.node || i.edge)!, k)));
	}

	reset(keys: PropKey[]): void {
		const ids = this.items.flatMap((i) => (i.node ? [i.node.id] : []));
		const indices = this.items.flatMap((i) => (i.edge ? [i.index!] : []));
		const ops: Op[] = [];
		if (ids.length) ops.push({ op: 'resetStyle', ids, keys });
		if (indices.length) ops.push({ op: 'resetStyle', indices, keys });
		post(ops.length === 1 ? ops[0] : { op: 'batch', ops });
	}
}

// ---- One frame ----
const FRAME_FALLBACK: Record<string, (g: Group) => unknown> = {
	outline: (g) => g.outline || (['region', 'none'].includes(g.frame) ? 'none' : g.frame),
	titleFont: (g) => g.titleFont || 'scriptsize',
};
// What a property value must become before the frame stores it.
const FRAME_STORE: Record<string, (v: any, g: Group) => Style> = {
	color: (v) => ({ color: v || 'grey' }),
	outline: (v, g) => ({ outline: v, frame: g.frame === 'none' ? 'solid' : g.frame }),
	padding: (v) => ({ padding: v || 0 }),
	lineWidth: (v) => ({ lineWidth: v || 0 }),
	fillStrength: (v) => ({ fillStrength: Math.min(100, v ?? 30) }),
};

export class FrameSubject implements Subject {
	readonly kinds: ObjKind[] = ['frame'];

	constructor(private group: Group) {}

	def(key: PropKey) {
		return defOf('frame', key) ?? null;
	}

	read(def: PropDef): Reading {
		const g = this.group as unknown as Style;
		const value = FRAME_FALLBACK[def.key]?.(this.group) ?? (g[def.key] || defaultOf(def, g));
		return { value: def.type === 'boolean' ? !!g[def.key] : value, mixed: false, inherited: false };
	}

	isSet(key: PropKey): boolean {
		return (this.group as unknown as Style)[key] !== undefined;
	}

	write(patch: Style): void {
		const out: Style = {};
		for (const [k, v] of Object.entries(patch)) Object.assign(out, FRAME_STORE[k]?.(v, this.group) ?? { [k]: v });
		post({ op: 'groupProps', id: this.group.id, ...out });
	}

	overridden(): boolean {
		return false;
	}

	reset(): void {}
}

// ---- A named style, edited in the style list ----
export class StyleSubject implements Subject {
	readonly kinds: ObjKind[];

	constructor(private styleDefinition: ViewStyle) {
		this.kinds = [styleDefinition.kind === 'label' ? 'label' : (styleDefinition.kind as ObjKind)];
	}

	def(key: PropKey) {
		return defOf(this.styleDefinition.kind, key) ?? null;
	}

	read(def: PropDef): Reading {
		const v = this.styleDefinition.props[def.key];
		return {
			value: v ?? (def.type === 'number' ? defaultOf(def, this.styleDefinition.props) : ''),
			mixed: false,
			inherited: false,
		};
	}

	isSet(key: PropKey): boolean {
		return this.styleDefinition.props[key] !== undefined;
	}

	write(patch: Style): void {
		const out: Style =
			this.styleDefinition.kind === 'frame' && 'color' in patch ? { ...patch, color: patch.color || 'grey' } : patch;
		post({ op: 'styleEdit', key: this.styleDefinition.key, props: out });
	}

	overridden(): boolean {
		return false;
	}

	reset(): void {}
}

// The subject for the current selection (frames and objects; layers and labels have no style properties).
export function subjectFor(sel: Selection): Subject {
	if (sel.mode === 'frame' && sel.group) return new FrameSubject(sel.group);
	return ObjectSubject.of(sel);
}
