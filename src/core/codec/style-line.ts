// Named styles: the `% sakuga style` lines and the TikZ style definitions.
import { styleOptions } from './style-options';
import { PALETTE } from '../model/colour';
import { ObjectStyle, StyleDef, StyleKind } from '../model/figure';
import { BOOLEAN_PROPS, NUMBER_PROPS, PRIMARY, STYLEABLE } from '../styles/tables';

// ---- Named styles: reading and writing the `% sakuga style` lines ----
export function readStyleLine(kind: StyleKind, key: string, name: string, tail: string): StyleDef {
	const def: StyleDef = { kind, key, name, props: {}, legend: false };
	for (const tok of tail.trim().split(/\s+/).filter(Boolean)) {
		let m: RegExpExecArray | null;
		if (tok === 'boxes') {
			def.boxes = true;
		} else if (tok === 'legend') {
			def.legend = true;
		} else if ((m = /^icon=([\w-]+)$/.exec(tok))) {
			def.icon = m[1];
		} else if ((m = /^([A-Za-z]+)=(.*)$/.exec(tok))) {
			def.props[m[1]] = NUMBER_PROPS.includes(m[1]) ? +m[2] : BOOLEAN_PROPS.includes(m[1]) ? m[2] === 'true' : m[2];
		} else if (kind === 'arrow' && /^(solid|dashed|dotted|double)$/.test(tok)) {
			def.props.border = tok;
		} else if (kind === 'frame' && /^(none|dashed|dotted|solid|region)$/.test(tok)) {
			def.props.frame = tok;
		} else if (PALETTE[tok] || /^#[0-9a-f]{6}$/i.test(tok)) {
			def.props[PRIMARY[kind]] = tok;
		}
	}
	return def;
}

const isColour = (v: unknown) => typeof v === 'string' && (!!PALETTE[v] || /^#[0-9a-f]{6}$/i.test(v));

export function styleLine(d: StyleDef): string {
	const p = { ...d.props },
		parts: string[] = [];
	if (d.kind === 'arrow' && p.border) {
		parts.push(p.border);
		delete p.border;
	}
	if (d.kind === 'frame' && p.frame) {
		parts.push(p.frame);
		delete p.frame;
	}
	const primary = PRIMARY[d.kind];
	if (isColour(p[primary])) {
		parts.push(p[primary]);
		delete p[primary];
	}
	if (d.icon) {
		parts.push('icon=' + d.icon);
	}
	if (d.boxes) {
		parts.push('boxes');
	}
	if (d.legend) {
		parts.push('legend');
	}
	for (const k of STYLEABLE[d.kind]) {
		if (p[k] !== undefined && p[k] !== null && p[k] !== '') {
			parts.push(`${k}=${p[k]}`);
		}
	}
	return `% sakuga style ${d.kind} ${d.key} {${d.name}}${parts.length ? ' ' + parts.join(' ') : ''}`;
}

function withTips(st: ObjectStyle): ObjectStyle {
	return st.start || st.end || st.tipLength !== undefined || st.tipWidth !== undefined
		? { ...st, start: st.start || 'none', end: st.end || 'Latex' }
		: st;
}

// Options of the TikZ style definition `sg style/<key>`.
export function styleDefOptions(d: StyleDef): string[] {
	const p = d.props as ObjectStyle;
	if (d.kind === 'box') {
		return ['sg box', ...styleOptions(p, false)];
	}
	if (d.kind === 'label') {
		return ['sg label', ...(p.border && p.border !== 'none' ? ['draw=black!38'] : []), ...styleOptions(p, false)];
	}
	if (d.kind === 'arrow') {
		return ['arr', ...styleOptions(withTips(p), true)];
	}
	return [`sg frame ${d.props.frame && d.props.frame !== 'none' ? d.props.frame : 'dashed'}`];
}
