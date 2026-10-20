// TikZ path text of a routed arrow: anchored port references and the polyline between them.
import type { Obj, Point } from '../model/node';
import { eps, fmt } from './route-base';

export function portText(n: Obj, s: string, p: Point): string {
	const h = /north|south/.test(s),
		shift = p[h ? 0 : 1] - n[h ? 'x' : 'y'];
	return Math.abs(shift) < eps ? `(${n.id}.${s})` : `([${h ? 'x' : 'y'}shift=${fmt(shift)}mm]${n.id}.${s})`;
}
export function polyline(
	pts: Point[],
	S: string,
	T: string,
	label: string | ((i: number) => string) = '',
	projectStraight = false,
): string {
	if (pts.length === 1) pts = [pts[0], pts[0]];
	if (
		projectStraight &&
		pts.length === 2 &&
		(Math.abs(pts[0][0] - pts[1][0]) < eps || Math.abs(pts[0][1] - pts[1][1]) < eps)
	) {
		const v = Math.abs(pts[0][0] - pts[1][0]) < eps,
			target = T.replace(/^\(\[[^\]]*\]/, '(');
		return `${S} --${typeof label === 'function' ? label(0) : label} (${S.slice(1, -1)} ${v ? '|-' : '-|'} ${target.slice(1, -1)})`;
	}
	if (label) {
		const coords = pts.map((p, i) => {
			if (!i) return S;
			if (i === pts.length - 1) return T;
			const first = i === 1,
				last = i === pts.length - 2;
			if (first || last) {
				const ref = first ? S : T,
					adjacent = first ? pts[0] : pts.at(-1)!,
					v = Math.abs(p[0] - adjacent[0]) < eps;
				return `(${ref.slice(1, -1)} ${v ? '|-' : '-|'} ${v ? '0,' + fmt(p[1]) : fmt(p[0]) + ',0'})`;
			}
			return `(${p.map(fmt).join(',')})`;
		});
		return coords
			.map((c, i) =>
				i
					? ` --${typeof label === 'function' ? label(i - 1) : i - 1 === (pts.length === 4 ? 1 : 0) ? label : ''} ${c}`
					: c,
			)
			.join('');
	}
	const p = pts,
		k = p.length - 1,
		v = Math.abs(p[0][0] - p[1][0]) < eps,
		coord = (p: any) => `(${p.map(fmt).join(',')})`;
	if (k === 1) return `${S} --${label} ${T}`;
	if (k === 2) return `${S} ${v ? '|-' : '-|'}${label} ${T}`;
	if (k === 3)
		return v
			? `${S} -- (${S.slice(1, -1)} |- 0,${fmt(p[1][1])}) -|${label} ${T}`
			: `${S} -- (${S.slice(1, -1)} -| ${fmt(p[1][0])},0) |-${label} ${T}`;
	if (k === 4)
		return `${S} ${v ? '|-' : '-|'}${label} ${coord(v ? [p[2][0], p[1][1]] : [p[1][0], p[2][1]])} ${v ? '|-' : '-|'} ${T}`;
	return [S, ...p.slice(1, -1).map(coord), T].join(' --' + label + ' ');
}
// Evaluate the calc-free coordinate/projection grammar used in fixed chains.
