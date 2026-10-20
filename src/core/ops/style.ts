// Operations on named styles and categories.
import { Figure, StyleDef } from '../model/figure';
import { insert } from '../model/lines';
import { edges, findStyle, nodes, styleDefs } from '../model/queries';
import { patchStyle, restyle, slugKey, usersOf } from './style-helpers';
import { isSet, objectKind, styleOf, styleableOf } from '../styles/resolve';
import { styleable, travelGroups } from '../schema';
import type { StyleOp, Run } from './types';

export function applyStyle(fig: Figure, op: StyleOp, run: Run): void {
	const node = (id: string) => nodes(fig).find((n) => n.id === id);
	switch (op.op) {
		case 'style':
			for (const n of nodes(fig)) {
				if (op.ids?.includes(n.id)) {
					n.style = patchStyle(fig, n, op.style);
				}
			}
			for (const i of op.indices || []) {
				const e = edges(fig)[i];
				if (e) {
					e.style = patchStyle(fig, e, op.style);
					if (op.style.start !== undefined || op.style.end !== undefined) {
						e.style.start = e.style.start || (e.head === 'both' ? 'Latex' : 'none');
						e.style.end = e.style.end || (e.head === 'none' ? 'none' : 'Latex');
						e.head = 'end';
					}
					if (op.style.border !== undefined) {
						e.kind = 'arr';
					}
				}
			}
			break;
		case 'styleAdd': {
			if (op.kind !== 'box') {
				run(fig, {
					op: 'themeEdit',
					kind: op.kind === 'arrow' ? 'Connector' : op.kind === 'frame' ? 'Frame' : 'Text',
					props: op.props,
				});
				break;
			}
			const taken = styleDefs(fig).map((d) => d.key);
			const key = op.key && /^[\w-]+$/.test(op.key) && !taken.includes(op.key) ? op.key : slugKey(op.name, taken);
			const src: any =
				op.from?.id !== undefined
					? node(op.from.id)
					: op.from?.index !== undefined
						? edges(fig)[op.from.index]
						: undefined;
			const def: StyleDef = {
				kind: op.kind,
				key,
				name: op.name,
				props: {},
				color: op.icon ? undefined : op.props?.fill || 'white',
				fill: op.icon ? op.props?.fill : undefined,
				outlineColor: op.props?.color,
				outline: op.props?.border,
				...(op.icon ? { icon: op.icon } : {}),
				...(op.boxes ? { boxes: true } : {}),
				legend: op.legend ?? false,
			};
			const themeProps = Object.fromEntries(
				Object.entries(op.props || {}).filter(([k]) => !['fill', 'color', 'border'].includes(k)),
			);
			if (Object.keys(themeProps).length) run(fig, { op: 'themeEdit', kind: 'Shape', props: themeProps });
			insert(fig, { t: 'style', s: def });
			const targets: any[] = [
				...(src ? [src] : []),
				...(op.assign?.ids || []).flatMap((id) => node(id) ?? []),
				...(op.assign?.indices || []).flatMap((i) => edges(fig)[i] ?? []),
			];
			for (const t of targets) {
				if ('from' in t) {
					t.styleKey = key;
				} else {
					t.cat = key;
				}
			}
			break;
		}
		case 'styleEdit': {
			const def = findStyle(fig, op.key);
			if (!def) {
				break;
			}
			if (def.kind === 'box') {
				const patch = {
					...(op.name !== undefined ? { name: op.name } : {}),
					...(op.icon !== undefined ? { icon: op.icon } : {}),
					...(op.legend !== undefined ? { legend: op.legend } : {}),
					...(op.props?.fill !== undefined ? { fill: op.props?.fill } : {}),
					...(op.props?.color !== undefined ? { outlineColor: op.props?.color } : {}),
					...(op.props?.border !== undefined ? { outline: op.props?.border } : {}),
				};
				run(fig, { op: 'categoryEdit', key: op.key, patch });
				break;
			}
			restyle(fig, def, (users) => {
				if (op.name !== undefined && op.name !== def.name) {
					const key = slugKey(
						op.name,
						styleDefs(fig)
							.filter((d) => d !== def)
							.map((d) => d.key),
					);
					for (const u of users) {
						if ('from' in u) {
							u.styleKey = key;
						} else {
							u.cat = key;
						}
					}
					def.key = key;
					def.name = op.name;
				}
				for (const [k, v] of Object.entries(op.props || {})) {
					if (isSet(v)) {
						def.props[k] = v;
					} else {
						delete def.props[k];
					}
				}
				if (op.icon !== undefined) {
					if (op.icon) {
						def.icon = op.icon;
					} else {
						delete def.icon;
					}
				}
				if (op.boxes !== undefined) {
					def.boxes = op.boxes;
				}
				if (op.legend !== undefined) {
					def.legend = op.legend;
				}
			});
			break;
		}
		case 'styleUpdate': {
			const def = findStyle(fig, op.key);
			if (!def) {
				break;
			}
			const src: any = op.id !== undefined ? node(op.id) : op.index !== undefined ? edges(fig)[op.index] : undefined;
			if (!src) {
				break;
			}
			restyle(fig, def, () => {
				Object.assign(def.props, styleableOf(def.kind, src.style));
			});
			break;
		}
		case 'styleDelete': {
			if (!op.to && findStyle(fig, op.key)?.kind === 'box') {
				run(fig, { op: 'categoryDelete', key: op.key });
				break;
			}
			const def = findStyle(fig, op.key);
			if (!def) {
				break;
			}
			const dest = findStyle(fig, op.to, def.kind);
			for (const u of usersOf(fig, def)) {
				if (dest) {
					for (const k of styleable(def.kind)) {
						delete (u.style as any)?.[k];
					}
					if ('from' in u) {
						u.styleKey = dest.key;
					} else {
						u.cat = dest.key;
					}
				} else if ('from' in u) {
					delete u.styleKey;
				} else {
					u.cat = '';
				}
			}
			fig.lines = fig.lines.filter((l) => !(l.t === 'style' && l.s === def));
			break;
		}
		case 'resetStyle': {
			const targets: any[] = [
				...nodes(fig).filter((n) => op.ids?.includes(n.id)),
				...(op.indices || []).flatMap((i) => edges(fig)[i] ?? []),
			];
			for (const t of targets) {
				const kind = objectKind(t);
				if (!kind) {
					continue;
				}
				const keys = new Set(op.keys?.length ? op.keys : styleable(kind));
				for (const g of travelGroups(kind)) {
					if (g.some((k) => keys.has(k))) {
						g.forEach((k) => keys.add(k));
					}
				}
				for (const k of keys) {
					delete t.style?.[k];
				}
			}
			break;
		}
		case 'addCategory':
			run(fig, {
				op: 'categoryAdd',
				category: {
					key: op.key,
					name: op.name,
					...(op.icon ? { icon: op.icon } : { color: op.color }),
					legend: op.legend ?? true,
				},
			});
			break;
		case 'category': {
			const patch = Object.fromEntries(
				Object.entries(op).filter(([k, v]) => !['op', 'key', 'boxes'].includes(k) && v !== undefined),
			);
			run(fig, { op: 'categoryEdit', key: op.key, patch });
			break;
		}
		case 'deleteCategory':
			run(fig, { op: 'categoryDelete', key: op.key });
			break;
	}
}
