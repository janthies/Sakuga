// Normalised label styles and the look of a group frame.
import { darkerColor } from '../model/colour';
import { Group, LabelStyle } from '../model/figure';

export function cleanLabel(st: LabelStyle = {}): LabelStyle {
	const out: any = {};
	const defaults: any = { pos: 0.5, dx: 0, dy: 0, side: '', font: '', color: '' };
	for (const [k, v] of Object.entries(st)) if (v !== undefined && v !== null && v !== defaults[k]) out[k] = v;
	return out;
}

export function frameAppearance(g: Group) {
	return {
		fill: g.fill || (g.frame === 'region' ? 'tint' : 'none'),
		strength: g.fillStrength ?? 30,
		outline: g.outline || (g.frame === 'region' || g.frame === 'none' ? (g.lineWidth ? 'solid' : 'none') : g.frame),
		color: g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'),
		width: g.lineWidth || (g.frame === 'dotted' ? 1.5 : 0.7),
	};
}
