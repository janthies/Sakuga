// @ts-nocheck
import * as coreRoutes from '../../core/layout/route';
import { store } from '../store/store';
import { r1 } from '../store/constants';
import { byId, layout, post } from '../store/model';
import { resolveRoute } from '../render/geometry';
import { edgeGeom } from '../render/edges';
import { src } from '../platform/dom';
import { render } from '../render/scene';

// Copy also includes selected arrows and the endpoint boxes needed to paste them.
function nodeLine(n) {
	if (n.kind === 'icon') {
		return `\\pic[pic text={${n.title}}] (${n.id}) at (${r1(n.x)},${r1(n.y)}) {sg object={${n.icon || ''}}{${r1(n.width)}}{${r1(n.minh || n.width)}}};`;
	}
	const o = [n.cat ? `sg style/${n.cat}` : n.kind === 'label' ? 'sg label' : 'sg box'];
	if (n.wantWidth !== undefined && n.wantWidth !== n.width) o.push(`sg want=${n.wantWidth}`);
	if (n.codeFont) o.push(`sg code font=${n.codeFont}`);
	if (n.width !== store.defaultWidth) {
		o.push(`text width=${n.width}mm`);
	}
	if (n.minh > 0) {
		o.push(`minimum height=${r1(n.minh)}mm`);
	}
	if (n.icon) {
		o.push(`sg icon=${n.icon}`);
	}
	if (n.iconPosition) {
		o.push(`sg icon position=${n.iconPosition}`);
	}
	const lbl = n.code ? `${n.title}\\\\[-1pt]\\sgcode{${n.code}}` : n.title;
	return `\\node[${[...o, ...(n.extra || [])].join(', ')}] (${n.id}) at (${r1(n.x)},${r1(n.y)}) {${lbl}};`;
}
function edgeLine(e) {
	const o = [e.styleKey ? `sg style/${e.styleKey}` : e.kind, ...(e.head !== 'end' ? [`head ${e.head}`] : [])];
	if (e.from === e.to) o.push('sg fixed');
	else if (['straight', 'manhattan', 'curved'].includes(e.route)) {
		o.push(`sg ${e.route}`);
	} else if (e.route !== 'auto') {
		o.push('sg fixed');
	}
	o.push(...(e.extra || []));
	const a = byId(e.from),
		b = byId(e.to),
		r = resolveRoute(e, a, b),
		A = e.from,
		B = e.to;
	const lbl = (pos) => (e.label ? ` node[sg elabel${pos}] {${e.label}}` : '');
	let path;
	const G = edgeGeom(e);
	if (G && (G.rule || G.fixed || G.loop)) {
		const aa = { ...a, ...layout(a) },
			bb = { ...b, ...layout(b) },
			sa = G.sa || e.fromAnchor || 'east',
			sb = G.sb || e.toAnchor || 'west';
		if (G.loop)
			path = `${coreRoutes.portText(aa, sa, G.pts[0])} to[out=${G.out},in=${G.inn},min distance=${e.loopSize ?? 8}mm]${lbl('')} ${coreRoutes.portText(bb, sb, G.pts.at(-1))}`;
		else {
			if (G.rule)
				o.push(
					`sg route=${e.route}`,
					...(!e.fromAnchor ? ['sg implicit from'] : []),
					...(!e.toAnchor ? ['sg implicit to'] : []),
				);
			path = coreRoutes.polyline(
				G.pts,
				coreRoutes.portText(aa, sa, G.pts[0]),
				coreRoutes.portText(bb, sb, G.pts.at(-1)),
				lbl(''),
			);
		}
	} else if (r.type === 'vert') {
		const s1 = b.y < a.y ? 'south' : 'north',
			s2 = b.y < a.y ? 'north' : 'south';
		path = r.at === 'b' ? `(${A}.${s1} -| ${B}) --${lbl('')} (${B})` : `(${A}) --${lbl('')} (${A} |- ${B}.${s2})`;
	} else if (r.type === 'horz') {
		const s1 = b.x > a.x ? 'east' : 'west',
			s2 = b.x > a.x ? 'west' : 'east';
		path = r.at === 'b' ? `(${A}.${s1} |- ${B}) --${lbl('')} (${B})` : `(${A}) --${lbl('')} (${A} -| ${B}.${s2})`;
	} else if (r.type === 'hvh' || r.type === 'vhv') {
		const op = r.type === 'hvh' ? '-|' : '|-';
		path =
			r.mid === null || r.mid === undefined
				? `(${A}) ${op}${lbl(', pos=0.25')} (${B})`
				: `(${A}) ${op}${lbl(', pos=0.75')} (${r.type === 'hvh' ? `${r1(r.mid)},${r1(b.y)}` : `${r1(b.x)},${r1(r.mid)}`}) -- (${B})`;
	} else if (r.type === 'bend') {
		const d = r.bend || 0;
		path = `(${A}) to[bend ${d >= 0 ? 'left' : 'right'}=${r1(Math.abs(d))}]${lbl('')} (${B})`;
	} else {
		path = `(${A}) --${lbl('')} (${B})`;
	}
	return `\\draw[${o.join(', ')}] ${path};`;
}
export function clip() {
	const ids = new Set([...store.selN].filter((id) => byId(id) && !byId(id).locked && !byId(id).hidden));
	const selected = store.edges.filter((e, i) => store.selE.has(i) || (ids.has(e.from) && ids.has(e.to)));
	const copiedGroups = new Set();
	const includeGroup = (id) => {
		if (typeof store.groups === 'undefined') return;
		const g = store.groups.find((g) => g.id === id);
		if (!g || copiedGroups.has(id)) return;
		copiedGroups.add(id);
		for (const child of store.groups.filter((g) => g.parent === id)) includeGroup(child.id);
		for (const n of store.nodes.filter((n) => n.group === id && !n.hidden && !n.locked)) ids.add(n.id);
	};
	if (store.selG) includeGroup(store.selG);
	for (const e of selected) {
		includeGroup(e.from);
		includeGroup(e.to);
	}
	for (const e of selected) {
		if (byId(e.from)) ids.add(e.from);
		if (byId(e.to)) ids.add(e.to);
	}
	for (const id of ids) {
		const a = byId(id)?.attachment;
		if (a && byId(a.parent)) {
			ids.add(a.parent);
		}
	}
	if (!ids.size) {
		return '';
	}
	const used = new Set([...[...ids].map((id) => byId(id).cat), ...selected.map((e) => e.styleKey)].filter(Boolean));
	return [
		...store.styles.filter((s) => used.has(s.key)).map((s) => s.line),
		...(typeof store.groups === 'undefined'
			? []
			: store.groups
					.filter((g) => copiedGroups.has(g.id))
					.map(
						(g) =>
							src.value.split('\n').find((line) => line.startsWith('% sakuga group ' + g.id + ' ')) ||
							`% sakuga group ${g.id} {${g.name}} ${g.frame} ${g.color}${g.parent ? ' in=' + g.parent : ''}`,
					)),
		...store.nodes
			.filter((n) => ids.has(n.id))
			.map(
				(n) =>
					src.value
						.split('\n')
						.find((line) => new RegExp(String.raw`\\(?:node|pic)\[.*\]\s*\(${n.id}\)\s*at\s*\(`).test(line)) ||
					nodeLine(n),
			),
		...selected
			.filter((e) => (ids.has(e.from) || copiedGroups.has(e.from)) && (ids.has(e.to) || copiedGroups.has(e.to)))
			.map((e) => {
				const index = store.edges.indexOf(e);
				return (
					src.value
						.split('\n')
						.filter((line) => /^(?:% sakuga hidden )?\\draw\[/.test(line))
						.map((line) => line.replace(/^% sakuga hidden /, ''))[index] || edgeLine(e)
				);
			}),
	].join('\n');
}
export function duplicate(ids, dx, dy) {
	let next = Math.max(0, ...store.nodes.map((n) => +(/^n(\d+)$/.exec(n.id) || [0, 0])[1])) + 1;
	const map = new Map(ids.map((id) => [id, `n${next++}`]));
	const ops = ids.map((id) => {
		const n = byId(id);
		return {
			op: 'addNode',
			wantWidth: n.wantWidth,
			codeFont: n.codeFont,
			titlePosition: n.titlePosition,
			id: map.get(id),
			x: n.x + dx,
			y: n.y + dy,
			title: n.title,
			icon: n.icon,
			iconPosition: n.iconPosition,
			kind: n.kind,
			code: n.code,
			cat: n.cat,
			width: n.width,
			minh: n.minh,
			style: n.style,
			extra: n.extra,
		};
	});
	for (const id of ids) {
		const n = byId(id),
			a = n.attachment;
		if (a) {
			ops.push({
				op: 'attach',
				id: map.get(id),
				attachment: {
					...a,
					parent: map.get(a.parent) || a.parent,
					dx: a.dx + (map.has(a.parent) ? 0 : dx),
					dy: a.dy + (map.has(a.parent) ? 0 : dy),
				},
			});
		}
	}
	for (const e of store.edges) {
		if (map.has(e.from) && map.has(e.to)) {
			ops.push({
				op: 'addEdge',
				styleKey: e.styleKey,
				fromAnchor: e.fromAnchor,
				toAnchor: e.toAnchor,
				fromOffset: e.fromOffset,
				toOffset: e.toOffset,
				loopSide: e.loopSide,
				loopSize: e.loopSize,
				loopOut: e.loopOut,
				loopIn: e.loopIn,
				looseness: e.looseness,
				loopMax: e.loopMax,
				...(e.route === 'fixed'
					? {
							waypoints: edgeGeom(e)
								.pts.slice(1, -1)
								.map((p) => [p[0] + dx, p[1] + dy]),
						}
					: {}),
				from: map.get(e.from),
				to: map.get(e.to),
				kind: e.kind,
				route: e.route,
				mid: e.mid,
				bend: e.bend,
				head: e.head,
				label: e.label,
				labelStyle: e.labelStyle,
				labels: e.labels,
				style: e.style,
				extra: e.extra,
			});
		}
	}
	store.pendingSelect = [...map.values()];
	post({ op: 'batch', ops });
}
export function deleteSelection() {
	if (store.selN.label) {
		post({ op: 'label', ...store.selN.label, text: '' });
		delete store.selN.label;
		render();
		return;
	}
	const ids = [...store.selN].filter(byId),
		ix = [...store.selE].filter((k) => store.edges[k]);
	// arrows first, highest index first, so the indices stay valid; then the boxes
	const ops = [...ix].sort((a, b) => b - a).map((k) => ({ op: 'deleteEdge', index: k }));
	post({ op: 'batch', ops: [...ops, ...ids.map((id) => ({ op: 'deleteNode', id }))] });
	store.selN = new Set();
	store.selE = new Set();
}
