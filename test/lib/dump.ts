import { loadIcons } from './env';

const t = loadIcons();

// Geometry as the serializer side sees it: node boxes, frames, and the path of every arrow.
export function serializerDump(text: string) {
	const fig = t.parse(text);
	const objects = t.routeObjects(fig);
	const cats = t.categories(fig);
	const font = t.fontSize(fig);
	const sized = (n: any) => {
		const c = cats.find((c: any) => c.key === n.cat);
		const icon = n.icon === 'none' ? undefined : n.icon === 'category' || (!n.icon && c?.boxes) ? c?.icon : n.icon;
		return { ...n, icon, style: { ...n.style, font: n.style?.font || font } };
	};
	const byId = new Map(t.nodes(fig).map((n: any) => [n.id, n]));
	return {
		nodes: objects.filter((o: any) => !o.frame).map((o: any) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, boxHalf: t.boxHalf(sized(byId.get(o.id))) })),
		frames: objects.filter((o: any) => o.frame).map((o: any) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h })),
		edges: t.edges(fig).map((e: any, index: number) => {
			const a: any = byId.get(e.from), b: any = byId.get(e.to);
			return {
				index, from: e.from, to: e.to,
				route: a && b ? t.resolveRoute(e, sized(a), sized(b), t.arrowStyle(fig)) : null,
				geometry: t.specialGeometry(fig, e),
			};
		}),
	};
}

// Geometry as the canvas (media/editor.js) computes it, read through the test hook.
export function canvasDump(hook: any) {
	const s = hook.state();
	const byId = new Map(s.nodes.map((n: any) => [n.id, n]));
	return {
		nodes: s.nodes.map((n: any) => { const l = hook.layout(n); return { id: n.id, x: n.x, y: n.y, w: l.w, h: l.h, lines: l.lines.length, boxHalf: hook.boxHalf(n) }; }),
		frames: s.groups.filter((g: any) => g.frame !== 'none').map((g: any) => hook.frameRect(g.id)).filter(Boolean).map((o: any) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h })),
		frameTitles: s.groups.map((g: any) => ({ id: g.id, title: hook.frameTitleGeom(g) })),
		edges: s.edges.map((e: any, index: number) => {
			const a: any = byId.get(e.from), b: any = byId.get(e.to);
			return {
				index, from: e.from, to: e.to,
				route: a && b ? hook.resolveRoute(e, a, b) : null,
				base: hook.baseEdgeGeom(e),
				geometry: hook.edgeGeom(e),
				labels: [...(e.labelStyle || e.label ? [{ slot: null, g: hook.arrowLabelGeom(e) }] : []), ...(e.labels || []).map((l: any, slot: number) => ({ slot, g: hook.arrowLabelGeom(e, l.style || {}, l.text, 0) }))],
			};
		}),
		contentBox: hook.contentBox(),
	};
}

export interface Drift { object: string; what: string; mm: number; detail?: unknown }
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const num = (v: number | undefined, w: number | undefined) => (v === undefined || w === undefined ? Infinity : Math.abs(v - w));

// Differences between the two sides, in mm. Equal values (to 0.0005 mm) are not listed.
export function drift(S: ReturnType<typeof serializerDump>, C: ReturnType<typeof canvasDump>): Drift[] {
	const out: Drift[] = [];
	const add = (object: string, what: string, mm: number, detail?: unknown) => { if (r3(mm) > 0) { out.push({ object, what, mm: r3(mm), detail }); } };
	for (const sn of S.nodes) {
		const cn = C.nodes.find(n => n.id === sn.id);
		if (!cn) { continue; }
		add(`node:${sn.id}`, 'size (routeObjects vs layout)', Math.max(num(sn.w, cn.w), num(sn.h, cn.h)), { tikz: [sn.w, sn.h], canvas: [cn.w, cn.h] });
		// The canvas keeps its own boxHalf for the legacy route choice (editor.js 382); the serializer uses the text layout.
		add(`node:${sn.id}`, 'boxHalf (tikz.ts vs editor.js copy)', Math.max(num(sn.boxHalf[0], cn.boxHalf[0]), num(sn.boxHalf[1], cn.boxHalf[1])), { tikz: sn.boxHalf, canvas: cn.boxHalf });
	}
	for (const sf of S.frames) {
		const cf = C.frames.find(f => f.id === sf.id);
		if (!cf) { add(`frame:${sf.id}`, 'frame only on the serializer side', Infinity); continue; }
		add(`frame:${sf.id}`, 'bounds', Math.max(num(sf.x, cf.x), num(sf.y, cf.y), num(sf.w, cf.w), num(sf.h, cf.h)), { tikz: [sf.x, sf.y, sf.w, sf.h], canvas: [cf.x, cf.y, cf.w, cf.h] });
	}
	for (const se of S.edges) {
		const ce = C.edges[se.index], name = `edge:${se.index} ${se.from}->${se.to}`;
		const sg = se.geometry, cg = ce.base;
		if (sg && cg) {
			const sp = sg.curve || sg.pts, cp = cg.curve || cg.pts;
			if (!!sg.curve !== !!cg.curve || sp.length !== cp.length) { add(name, 'path shape (points)', Infinity, { tikz: sp.length, canvas: cp.length }); }
			else { add(name, 'path points', Math.max(0, ...sp.flatMap((p: number[], i: number) => p.map((v, k) => num(v, cp[i][k])))), { tikz: sp, canvas: cp }); }
			if (sg.label && cg.label) { add(name, 'label anchor (before side and offsets)', Math.max(num(sg.label[0], cg.label[0]), num(sg.label[1], cg.label[1])), { tikz: sg.label, canvas: cg.label }); }
		} else if (!sg) {
			// Plain legacy route: the serializer chooses it with resolveRoute and TikZ draws it; the canvas draws it from its own copy.
			const a = se.route, b = ce.route;
			if (JSON.stringify(a) !== JSON.stringify(b)) { add(name, 'route choice (resolveRoute)', a?.type === b?.type ? Math.abs((a?.mid ?? 0) - (b?.mid ?? 0)) : Infinity, { tikz: a, canvas: b }); }
		} else {
			add(name, 'arrow missing on the canvas (serializer routes it)', Infinity);
		}
	}
	return out;
}
