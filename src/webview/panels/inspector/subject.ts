import { PropDef, PropKey, defOf } from '../../../core/schema';
import { schemaKind } from '../../../core/schema/theme';
import { parse } from '../../../core/codec/parse';
import { resolveLook, categoryKey } from '../../../core/styles/cascade';
import { post } from '../../store/model';
import { store } from '../../store/store';
import { src } from '../../platform/dom';
import type { Style } from '../../ui/control';
import type { Selection } from './selection';
import type { Item } from '../../../core/model/item';

export interface Reading {
	value: unknown;
	mixed: boolean;
	inherited: boolean;
	source?: string;
}
export interface Subject {
	kinds: string[];
	def(key: PropKey): PropDef | null;
	read(def: PropDef): Reading;
	isSet(key: PropKey): boolean;
	write(patch: Style): void;
	overridden(keys: PropKey[]): boolean;
	reset(keys: PropKey[]): void;
	apply?(keys: PropKey[]): void;
	applyLabel?: string;
}

export class ObjectSubject implements Subject {
	private fig = parse(src.value);
	readonly kinds: string[];
	readonly applyLabel: string;
	constructor(
		private items: Item[],
		private sel: Selection,
	) {
		this.kinds = items.map((i) => schemaKind[i.kind]);
		this.applyLabel = items.some((i) => categoryKey(this.fig, i)) ? 'Apply to category' : 'Apply to theme';
	}
	static of(sel: Selection): ObjectSubject {
		const ids = new Set([...store.selN, ...sel.edges.map((e) => e.e.id || '')]);
		if (sel.attached && store.selN.label) {
			const ref = store.selN.label;
			const parent = ref.group || store.edges[ref.index!]?.id;
			const child = store.items.find(
				(i) => i.kind === 'Text' && i.parent === parent && i.order === (ref.slot === undefined ? 0 : ref.slot + 1),
			);
			if (child) ids.add(child.id);
		}
		return new ObjectSubject(
			store.items.filter((i) => ids.has(i.id) && i.kind !== 'Frame'),
			sel,
		);
	}
	static children(sel: Selection): ObjectSubject {
		const ids = new Set([...store.selN, ...sel.edges.map((e) => e.e.id || '')]);
		return new ObjectSubject(
			store.items.filter((i) => i.kind === 'Text' && ids.has(i.parent)),
			{ ...sel, nodes: [], edges: [] },
		);
	}
	def(key: PropKey): PropDef | null {
		const defs = this.items.map((i) => defOf(schemaKind[i.kind], key));
		return defs.length && defs.every(Boolean) ? defs[0]! : null;
	}
	read(def: PropDef): Reading {
		const values = this.items.map((i) => resolveLook(this.fig, i)[def.key]);
		const sources = values.map((v) =>
			typeof v?.source === 'object'
				? `Category: ${store.cats.find((c) => c.key === (v.source as { category: string }).category)?.name || (v.source as { category: string }).category}`
				: v?.source === 'item'
					? 'Own value'
					: 'Theme',
		);
		return {
			value: values[0]?.value,
			mixed: values.some((v) => v?.value !== values[0]?.value),
			inherited: values.every((v) => v?.source !== 'item'),
			source: [...new Set(sources)].join(', '),
		};
	}
	isSet(key: PropKey) {
		return this.overridden([key]);
	}
	write(patch: Style) {
		const ops: any[] = [];
		const ids = this.sel.nodes.map((n) => n.id);
		const indices = this.sel.edges.map((e) => e.i);
		if (ids.length) ops.push({ op: 'style', ids, style: patch });
		if (indices.length) ops.push({ op: 'style', indices, style: patch });
		for (const i of this.items.filter((i) => !ids.includes(i.id) && !this.sel.edges.some((e) => e.e.id === i.id)))
			for (const [prop, value] of Object.entries(patch)) ops.push({ op: 'setOverride', id: i.id, prop, value });
		post({ op: 'batch', ops });
	}
	overridden(keys: PropKey[]) {
		return this.items.some((i) => keys.some((k) => resolveLook(this.fig, i)[k]?.source === 'item'));
	}
	reset(keys: PropKey[]) {
		post({
			op: 'batch',
			ops: this.items.flatMap((i) => keys.map((prop) => ({ op: 'resetOverride', id: i.id, prop }))),
		});
	}
	apply(keys: PropKey[]) {
		post({
			op: 'batch',
			ops: this.items.flatMap((i) =>
				keys.map((prop) => ({
					op: categoryKey(this.fig, i) ? 'applyToCategory' : 'applyToTheme',
					id: i.id,
					prop,
				})),
			),
		});
	}
}
export const subjectFor = (sel: Selection): Subject => ObjectSubject.of(sel);
