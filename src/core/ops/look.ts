import type { Figure, Category } from '../model/figure';
import type { ItemKind } from '../model/item';
import { payload } from '../model/tree';
import { itemById } from '../model/tree-queries';
import { findStyle } from '../model/queries';
import { categoryKey, ownValues, resolveLook, projectLook } from '../styles/cascade';
import { houseValues } from '../schema/theme';

export type LookOp =
	| { op: 'setOverride'; id: string; prop: string; value: any }
	| { op: 'resetOverride'; id: string; prop?: string }
	| { op: 'applyToCategory' | 'applyToTheme'; id: string; prop?: string }
	| { op: 'setCategory'; id: string; category: string }
	| {
			op: 'themeEdit';
			kind?: ItemKind;
			props?: Record<string, any>;
			palette?: Record<string, string>;
			fontSize?: string;
	  }
	| { op: 'categoryAdd'; category: Category }
	| { op: 'categoryEdit'; key: string; patch: Partial<Category> }
	| { op: 'categoryDelete'; key: string };

export function applyLook(fig: Figure, op: LookOp) {
	if (op.op === 'themeEdit') {
		const theme = (fig.theme ||= {});
		if (op.fontSize !== undefined) theme.fontSize = op.fontSize;
		if (op.palette) theme.palette = { ...theme.palette, ...op.palette };
		if (op.kind) {
			const props = ((theme.kinds ||= {})[op.kind] ||= {});
			for (const [k, v] of Object.entries(op.props || {})) {
				if (v === null || v === houseValues(op.kind)[k]) delete props[k];
				else props[k] = v;
			}
		}
		return;
	}
	if (op.op === 'categoryAdd') {
		if (findStyle(fig, op.category.key)) return;
		const c = op.category;
		fig.lines.unshift({ t: 'style', s: { kind: 'box', ...c, props: { ...c.props, fill: c.color } } });
		return;
	}
	if (op.op === 'categoryEdit') {
		const d = findStyle(fig, op.key);
		if (d) {
			const { color, props, ...patch } = op.patch;
			Object.assign(d, patch);
			Object.assign(d.props, props, color !== undefined ? { fill: color } : {});
		}
		return;
	}
	if (op.op === 'categoryDelete') {
		for (const i of fig.items || []) if (payload(i).cat === op.key) payload(i).cat = '';
		fig.lines = fig.lines.filter((l) => l.t !== 'style' || l.s.key !== op.key);
		return;
	}
	const i = itemById(fig, op.id);
	if (!i) return;
	const p = payload(i),
		own = ownValues(i);
	if (op.op === 'setCategory') p.cat = op.category;
	else if (op.op === 'setOverride') own[op.prop] = op.value;
	else if (op.op === 'resetOverride') {
		if (op.prop) delete own[op.prop];
		else for (const k of Object.keys(own)) delete own[k];
	} else {
		const values = resolveLook(fig, i);
		const props = op.prop ? { [op.prop]: values[op.prop]?.value } : { ...own };
		if (op.op === 'applyToCategory') {
			const d = findStyle(fig, categoryKey(fig, i));
			if (!d) return;
			if (i.kind === 'Shape' && props.fill !== undefined) {
				d.props.fill = props.fill;
				delete d.kinds?.Shape?.fill;
				const { fill, ...rest } = props;
				Object.assign(((d.kinds ||= {}).Shape ||= {}), rest);
			} else Object.assign(((d.kinds ||= {})[i.kind] ||= {}), props);
		} else Object.assign((((fig.theme ||= {}).kinds ||= {})[i.kind] ||= {}), props);
		for (const k of Object.keys(props)) delete own[k];
	}
	p.look = { own, resolved: { ...((p as any).style || p.look?.resolved || {}) } };
	// Replace the projection immediately so settle does not interpret the previous values as new edits.
	if (i.kind === 'Frame') {
		for (const k of Object.keys(p.look.resolved)) if (!(k in own)) delete (p as any)[k];
		Object.assign(p, own);
		p.look.resolved = { ...own };
	} else if (i.kind !== 'Text' || i.node) {
		(p as any).style = { ...own };
		p.look.resolved = { ...own };
	}
	projectLook(fig);
}
