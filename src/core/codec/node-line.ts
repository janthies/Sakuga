// Writing boxes: the node line, its hidden reference and attached icons.
import { emitOptions } from './options';
import { opacityOptions } from './opt-stroke';
import { anchorPoint, boxHalf, nodeIcon } from '../geometry/boxes';
import { DEFAULT_WIDTH } from '../model/constants';
import { FigNode, Figure, ObjectStyle } from '../model/figure';
import { findStyle, fontSize, isHidden, nodeOpacity, nodeStyleKind, nodes, smallerFont } from '../model/queries';
import { overrideOf } from '../styles/resolve';
import { num } from '../util/num';

function coordinate(n: FigNode): string {
	const a = n.attachment;
	const [ox, oy] = a && n.kind === 'icon' ? anchorPoint({ ...n, x: 0, y: 0 }, a.ownAnchor) : [0, 0];
	return a
		? `([shift={(${num(a.dx - ox)}mm,${num(a.dy - oy)}mm)}]${a.parent}.${a.anchor})`
		: `(${num(n.x)},${num(n.y)})`;
}

export function nodeLine(n: FigNode, figureFont = 'small', hasIcon = !!n.icon, layerOpacity = 1, fig?: Figure): string {
	if (n.kind === 'icon') {
		const o = [
			`pic text={${n.title}}`,
			...(n.attachment ? [`anchor=${n.attachment.ownAnchor}`] : []),
			...(n.layer ? [`sg layer=${n.layer}`] : []),
			...(n.group ? [`sg in=${n.group}`] : []),
			...(n.locked ? ['sg locked'] : []),
			...opacityOptions(n.style?.opacity, layerOpacity),
			...n.extra,
		];
		const line = `\\pic[${o.join(', ')}] (${n.id}) at ${coordinate(n)} {sg object={${n.icon || ''}}{${num(n.width)}}{${num(n.minh || n.width)}}};`;
		return n.hidden ? `% sakuga hidden ${line}` : line;
	}
	const def = fig && n.cat && nodeStyleKind(n) ? findStyle(fig, n.cat, nodeStyleKind(n)!) : undefined;
	const own: ObjectStyle | undefined = def ? overrideOf(def.kind, n.style || {}, def.props) : n.style;
	const o = [n.cat ? `sg style/${n.cat}` : n.kind === 'label' ? 'sg label' : 'sg box'];
	if (n.kind === 'label') {
		o.push(`sg label height=${boxHalf({ ...n, style: { ...n.style, font: n.style?.font || figureFont } })[1] * 2}`);
	}
	if (n.kind === 'label' && own?.border && own.border !== 'none') {
		o.push('draw=black!38');
	}
	if (n.attachment && n.kind !== 'icon') {
		o.push(`anchor=${n.attachment.ownAnchor}`);
	}
	if (n.wantWidth !== undefined && n.wantWidth !== n.width) o.push(`sg want=${n.wantWidth}`);
	if (n.codeFont && n.codeFont !== smallerFont(n.style?.font || figureFont)) o.push(`sg code font=${n.codeFont}`);
	if (n.width !== DEFAULT_WIDTH) {
		o.push(`text width=${n.width}mm`);
	}
	if (n.minh > 0) {
		o.push(`minimum height=${num(n.minh)}mm`);
	}
	if (n.layer) {
		o.push(`sg layer=${n.layer}`);
	}
	if (n.group) {
		o.push(`sg in=${n.group}`);
	}
	if (n.locked) {
		o.push('sg locked');
	}
	if (n.icon) {
		o.push(`sg icon=${n.icon}`);
	}
	if (hasIcon) {
		o.push(
			`sg icon height=${num(boxHalf({ ...n, icon: 'active', style: { ...n.style, shape: '', font: n.style?.font || figureFont } })[1] * 2 - (0.45 * 25.4) / 72.27)}`,
		);
	}
	if (n.iconPosition) {
		o.push(`sg icon position=${n.iconPosition}`);
	}
	if (n.style?.compact) {
		const body =
			(boxHalf({ ...n, style: { ...n.style, font: n.style?.font || figureFont } })[1] * 2 - (2 * 25.4) / 72.27) /
			(25.4 / 72.27);
		o.push(`text height=${body * 0.6}pt`, `text depth=${body * 0.4}pt`);
	}
	const title = n.kind === 'label' && n.style?.step ? `\\sglabel{${n.style.step}}{${n.title}}` : n.title;
	let content = n.code ? `${title}\\\\[-1pt]\\sgcode{${n.code}}` : title;
	if (n.titlePosition && n.titlePosition !== 'center') {
		const pos = n.titlePosition,
			h =
				boxHalf({ ...n, icon: undefined, style: { ...n.style, shape: '', font: n.style?.font || figureFont } })[1] * 2 -
				(7.45 * 25.4) / 72.27;
		content = `\\parbox[c][${num(h)}mm][${pos.includes('north') ? 't' : pos.includes('south') ? 'b' : 'c'}]{${num(n.width)}mm}{\\${pos.includes('west') ? 'raggedright' : pos.includes('east') ? 'raggedleft' : 'centering'} ${content}}`;
	}
	const label = hasIcon ? `\\sgcontent{${n.iconPosition || 'left'}}{${n.width}}{${content}}` : content;
	const line = `\\node[${[...o, ...emitOptions(own, { height: boxHalf({ ...n, style: { ...n.style, font: n.style?.font || figureFont } })[1] * 2, thin: !!def && (def.props.lineWidth !== undefined || (!!def.props.weight && def.props.weight !== 'thin')), redraw: !!def && def.kind === 'box' && def.props.border === 'none' }), ...opacityOptions(n.style?.opacity, layerOpacity), ...n.extra].join(', ')}] (${n.id}) at ${coordinate(n)} {${label}};`;
	return n.hidden ? `% sakuga hidden ${line}` : line;
}

export function hiddenReference(fig: Figure, n: FigNode): string[] {
	if (!isHidden(fig, n)) {
		return [];
	}
	const descendants = (id: string, seen = new Set<string>()): boolean => {
		if (seen.has(id)) {
			return false;
		}
		seen.add(id);
		return nodes(fig).some(
			(child) => child.attachment?.parent === id && (!isHidden(fig, child) || descendants(child.id, seen)),
		);
	};
	if (!descendants(n.id)) {
		return [];
	}
	return [
		'% sakuga icons begin (generated anchor for hidden parent)',
		nodeLine(
			{ ...n, hidden: false, extra: [...n.extra, 'opacity=0', 'overlay'] },
			fontSize(fig),
			!!nodeIcon(fig, n),
			1,
			fig,
		),
		'% sakuga icons end',
	];
}

export function attachedIcons(fig: Figure, objects = nodes(fig)): string[] {
	const out = ['% sakuga icons begin (generated)'];
	for (const n of objects) {
		if (!nodeIcon(fig, n) || n.kind === 'icon' || isHidden(fig, n)) {
			continue;
		}
		const name = nodeIcon(fig, n);
		if (!name) {
			continue;
		}
		const p = n.iconPosition || 'left';
		const anchor =
			(
				{
					left: 'west',
					right: 'east',
					above: 'north',
					nw: 'north west',
					ne: 'north east',
					sw: 'south west',
					se: 'south east',
				} as Record<string, string>
			)[p] || 'west';
		const x = ['right', 'ne', 'se'].includes(p) ? -4 : p === 'above' ? -1.5 : 1;
		const y = ['above', 'nw', 'ne'].includes(p) ? -1 : ['sw', 'se'].includes(p) ? 4 : 1.5;
		out.push(
			`\\pic${nodeOpacity(fig, n) !== 1 ? `[${opacityOptions(nodeOpacity(fig, n)).join(', ')}]` : ''} at ([xshift=${x}mm,yshift=${y}mm]${n.id}.${anchor}) {sg icon/${name}};`,
		);
	}
	out.push('% sakuga icons end');
	return out;
}
