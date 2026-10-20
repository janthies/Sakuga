// Writing arrows.
import * as routing from '../geometry/route';
import { toHex } from '../util/hex';
import { labelMetrics, labelOptions } from './label';
import { emitOptions } from './options';
import { opacityOptions } from './opt-stroke';
import { FigureGeometry, geometryOf } from '../geometry/figure-geometry';
import { FigEdge, Figure, LabelStyle, ObjectStyle } from '../model/figure';
import { edgeLayerOpacity, fontSize, nodes } from '../model/queries';
import { cleanLabel } from '../styles/appearance';
import { overrideOf, styleOf } from '../styles/resolve';
import { num } from '../util/num';

export function edgeLine(fig: Figure, e: FigEdge, geo: FigureGeometry = geometryOf(fig)): string {
	const edef = styleOf(fig, e);
	const eown: ObjectStyle | undefined = edef ? overrideOf('arrow', e.style || {}, edef.props) : e.style;
	const o = [e.styleKey ? `sg style/${e.styleKey}` : e.kind];
	const labelData = {
		...(Object.keys(cleanLabel(e.labelStyle)).length ? { style: cleanLabel(e.labelStyle) } : {}),
		...(e.labels?.length ? { labels: e.labels.map((l) => ({ ...l, style: cleanLabel(l.style) })) } : {}),
	};
	if (e.labels?.length) (labelData as any).text = e.label;
	if (e.labelStyle || e.labels?.length) {
		if (e.style?.side) (labelData as any).legacySide = e.style.side;
		if (e.style?.position) (labelData as any).legacyPosition = e.style.position;
	}
	if (Object.keys(labelData).length) o.push('sg labels=' + toHex(JSON.stringify(labelData)));
	if (!e.label) {
		if (e.style?.side) o.push(`sg label side=${e.style.side}`);
		if (e.style?.position) o.push(`sg label position=${e.style.position}`);
	}
	if (e.head !== 'end') {
		o.push(`head ${e.head}`);
	}
	if (e.from === e.to) {
		o.push('sg fixed');
	} else if (e.route === 'straight' || e.route === 'manhattan' || e.route === 'curved') {
		o.push(`sg ${e.route}`);
	} else if (e.route !== 'auto') {
		o.push('sg fixed');
	}
	const a = nodes(fig).find((n) => n.id === e.from),
		b = nodes(fig).find((n) => n.id === e.to);
	const r = geo.route(e);
	const content =
		e.style?.step && e.label
			? `\\sglabel{${e.style.step}}{${e.label}}`
			: e.style?.step
				? `\\sgstep{${e.style.step}}`
				: e.label;
	const lbl = (pos: string, extras = true) =>
		content
			? ` node[sg elabel${e.labelStyle ? '' : e.label && e.style?.position ? ', near ' + e.style.position : pos}${e.label && e.style?.side && !e.labelStyle?.side ? ', ' + e.style.side : ''}${labelMetrics(e.label, e.labelStyle, fontSize(fig), e.style?.step)}${labelOptions(e.labelStyle, { font: fontSize(fig), color: e.style?.color || '', pos: e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : undefined })}] {${content}}${(extras ? e.labels || [] : []).map((l) => ` node[sg elabel${labelMetrics(l.text, l.style, fontSize(fig))}${labelOptions(l.style, { font: fontSize(fig), color: e.style?.color || '', side: e.style?.side, pos: e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : undefined })}] {${l.text}}`).join('')}`
			: (e.labels || [])
					.map(
						(l) =>
							` node[sg elabel${labelMetrics(l.text, l.style, fontSize(fig))}${labelOptions(l.style, { font: fontSize(fig), color: e.style?.color || '', side: e.style?.side, pos: e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : undefined })}] {${l.text}}`,
					)
					.join('');
	const A = a?.kind === 'icon' ? e.from + '-center' : e.from,
		B = b?.kind === 'icon' ? e.to + '-center' : e.to;
	let path: string;
	const G = geo.special(e);
	if (e.lane !== undefined) o.push(`sg lane=${e.lane}`);
	if (G && (G.rule || G.loop || G.fixed)) {
		const objects = geo.objects(),
			aa = objects.find((n) => n.id === e.from),
			bb = objects.find((n) => n.id === e.to);
		const inferred = (n: any, p: number[], other: any) =>
			Math.abs(p[0] - (n.x + n.w / 2)) < 0.001
				? 'east'
				: Math.abs(p[0] - (n.x - n.w / 2)) < 0.001
					? 'west'
					: p[1] >= n.y
						? 'north'
						: 'south';
		const sa = G.sa || e.fromAnchor || inferred(aa, G.pts[0], bb),
			sb = G.sb || e.toAnchor || inferred(bb, G.pts[G.pts.length - 1], aa);
		let start = routing.portText(aa, sa, G.pts[0]),
			stop = routing.portText(bb, sb, G.pts[G.pts.length - 1]);
		const zero = (id: string, side: string) => `([${/north|south/.test(side) ? 'x' : 'y'}shift=0mm]${id}.${side})`;
		if (e.fromOffset === 0) start = zero(A, sa);
		if (e.toOffset === 0) stop = zero(B, sb);
		if (G.loop) {
			if (/circle|ellipse/.test(aa.style?.shape)) {
				start = `(${A}.${num(G.out)})`;
				stop = `(${A}.${num(G.inn)})`;
			}
			const options = [
				`out=${G.out}`,
				`in=${G.inn}`,
				`min distance=${e.loopSize ?? 8}mm`,
				...(e.looseness !== undefined && e.looseness !== 1 ? [`looseness=${e.looseness}`] : []),
				...(e.loopMax !== undefined ? [`max distance=${e.loopMax}mm`] : []),
			];
			path = `${start} to[${options.join(',')}]${lbl(e.style?.side || e.labelStyle?.side ? '' : ', ' + (({ north: 'above', south: 'below', east: 'right', west: 'left' } as Record<string, string>)[G.side] || 'above'))} ${stop}`;
		} else {
			if (!G.fixed) {
				o.push(`sg route=${e.route}`);
				if (!e.fromAnchor) o.push('sg implicit from');
				else if (e.fromOffset === undefined) o.push('sg implicit from=' + e.fromAnchor);
				if (!e.toAnchor) o.push('sg implicit to');
				else if (e.toOffset === undefined) o.push('sg implicit to=' + e.toAnchor);
				if (e.mid !== null) o.push(`sg mid=${e.mid}`);
				if (e.bend) o.push(`sg bend=${e.bend}`);
			}
			const segment = (st: LabelStyle | undefined) =>
				Math.max(
					0,
					Math.min(
						G.pts.length - 2,
						st?.segment ??
							(e.style?.position === 'start'
								? 0
								: e.style?.position === 'end'
									? G.pts.length - 2
									: G.pts.length === 4
										? 1
										: 0),
					),
				);
			const labels = (i: number) =>
				(segment(e.labelStyle) === i ? lbl('', false) : '') +
				(e.labels || [])
					.filter((l) => segment(l.style) === i)
					.map(
						(l) =>
							` node[sg elabel${labelMetrics(l.text, l.style, fontSize(fig))}${labelOptions(l.style, { font: fontSize(fig), color: e.style?.color || '', side: e.style?.side })}] {${l.text}}`,
					)
					.join('');
			path = routing.polyline(G.pts, start, stop, content || e.labels?.length ? labels : '', !!G.rule && !e.toAnchor);
		}
	} else if (G) {
		o.push(`sg route=${e.route}`);
		if (!e.fromAnchor) o.push('sg implicit from');
		if (!e.toAnchor) o.push('sg implicit to');
		if (e.mid !== null) o.push(`sg mid=${e.mid}`);
		if (e.bend) o.push(`sg bend=${e.bend}`);
		const objects = geo.objects(),
			end = (id: string, anchor: string | undefined, p: number[]) => {
				const n = objects.find((n) => n.id === id),
					c = anchor ? routing.point(n, anchor, n) : [n.x, n.y];
				const offset = id === e.from ? e.fromOffset : e.toOffset;
				if (offset !== undefined && /^(north|south|east|west)$/.test(anchor || '')) {
					const text = routing.portText(n, anchor!, p);
					return offset === 0 && !text.includes('shift')
						? `([${/north|south/.test(anchor!) ? 'x' : 'y'}shift=0mm]${id}.${anchor})`
						: text;
				}
				return `([xshift=${p[0] - c[0]}mm,yshift=${p[1] - c[1]}mm]${id}${anchor ? '.' + anchor : '.center'})`;
			};
		const points = G.curve || G.pts,
			start = end(e.from, e.fromAnchor, points[0]),
			stop = end(e.to, e.toAnchor, points[points.length - 1]);
		const segment = (st: LabelStyle | undefined) =>
			Math.max(
				0,
				Math.min(
					points.length - 2,
					st?.segment ??
						(e.style?.position === 'start'
							? 0
							: e.style?.position === 'end'
								? points.length - 2
								: points.length === 4
									? 1
									: 0),
				),
			);
		const at = (i: number) => {
			const primary = segment(e.labelStyle) === i && content ? lbl('', false) : '';
			const extras = (e.labels || [])
				.filter((l) => segment(l.style) === i)
				.map(
					(l) =>
						` node[sg elabel${labelMetrics(l.text, l.style, fontSize(fig))}${labelOptions(l.style, { font: fontSize(fig), color: e.style?.color || '', side: e.style?.side, pos: e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : undefined })}] {${l.text}}`,
				)
				.join('');
			return primary + extras;
		};
		path = G.curve
			? `${start} .. controls (${points[1]}) and (${points[2]}) ..${lbl('')} ${stop}`
			: points
					.map((p: number[], i: number) =>
						i === 0 ? start : ` --${at(i - 1)} ${i === points.length - 1 ? stop : '(' + p.join(',') + ')'}`,
					)
					.join('');
	} else if (r.type === 'vert' && a && b) {
		const side = b.y < a.y ? 'south' : 'north',
			bside = b.y < a.y ? 'north' : 'south';
		path = r.at === 'b' ? `(${A}.${side} -| ${B}) --${lbl('')} (${B})` : `(${A}) --${lbl('')} (${A} |- ${B}.${bside})`;
	} else if (r.type === 'horz' && a && b) {
		const side = b.x > a.x ? 'east' : 'west',
			bside = b.x > a.x ? 'west' : 'east';
		path = r.at === 'b' ? `(${A}.${side} |- ${B}) --${lbl('')} (${B})` : `(${A}) --${lbl('')} (${A} -| ${B}.${bside})`;
	} else if (r.type === 'hvh' && b) {
		path =
			r.mid === null || r.mid === undefined
				? `(${A}) -|${lbl(', pos=0.25')} (${B})`
				: `(${A}) -|${lbl(', pos=0.75')} (${num(r.mid)},${num(b.y)}) -- (${B})`;
	} else if (r.type === 'vhv' && b) {
		path =
			r.mid === null || r.mid === undefined
				? `(${A}) |-${lbl(', pos=0.25')} (${B})`
				: `(${A}) |-${lbl(', pos=0.75')} (${num(b.x)},${num(r.mid)}) -- (${B})`;
	} else if (r.type === 'bend') {
		const d = r.bend ?? 20;
		path = `(${A}) to[bend ${d >= 0 ? 'left' : 'right'}=${num(Math.abs(d))}]${lbl('')} (${B})`;
	} else {
		path = `(${A}) --${lbl('')} (${B})`;
	}
	return `\\draw[${[...o, ...emitOptions(eown && (eown.start || eown.end || eown.tipLength !== undefined || eown.tipWidth !== undefined) ? { ...eown, start: eown.start || (e.head === 'both' ? 'Latex' : 'none'), end: eown.end || (e.head === 'none' ? 'none' : 'Latex') } : eown, { arrow: true }), ...opacityOptions(e.style?.opacity, edgeLayerOpacity(fig, e)), ...e.extra].join(', ')}] ${path};`;
}
