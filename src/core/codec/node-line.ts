import { itemById } from '../model/tree-queries';
import { slotCell } from '../model/slots';
import { INNER_PADDING, OUTER_GAP, slotRect } from '../geometry/slot-layout';
import { categoryOption } from './look';
import { itemOverrides } from '../styles/cascade';
// Writing boxes: the node line, its hidden reference and attached icons.
import { emitOptions } from './options';
import { opacityOptions } from './opt-stroke';
import { anchorPoint, boxHalf, nodeIcon } from '../geometry/boxes';
import { DEFAULT_WIDTH } from '../model/constants';
import { FigNode, Figure, ObjectStyle } from '../model/figure';
import { findStyle, fontSize, isHidden, nodeOpacity, nodeStyleKind, nodes, smallerFont } from '../model/queries';
import { fill } from '../model/colour';
import { num } from '../util/num';

function ownAnchor(n: FigNode): string {
	if (!n.slot || n.kind === 'icon') return 'center';
	const [c, r] = slotCell(n.slot);
	return (
		[
			r === 0 ? 'south' : r === 4 ? 'north' : r === 1 ? 'north' : r === 3 ? 'south' : '',
			c === 0 ? 'east' : c === 4 ? 'west' : c === 1 ? 'west' : c === 3 ? 'east' : '',
		]
			.filter(Boolean)
			.join(' ') || 'center'
	);
}
function coordinate(n: FigNode, fig?: Figure): string {
	if (n.slot && n.treeParent && (!fig || itemById(fig, n.treeParent)?.kind === 'Shape')) {
		const [c, r] = slotCell(n.slot),
			anchor =
				[r <= 1 ? 'north' : r >= 3 ? 'south' : '', c <= 1 ? 'west' : c >= 3 ? 'east' : ''].filter(Boolean).join(' ') ||
				'center';
		const p = fig && itemById(fig, n.treeParent),
			b = p?.kind === 'Shape' ? slotRect(p.node) : undefined;
		const a = b
			? [b.x + (c <= 1 ? -b.w / 2 : c >= 3 ? b.w / 2 : 0), b.y + (r <= 1 ? b.h / 2 : r >= 3 ? -b.h / 2 : 0)]
			: [0, 0];
		const own = ownAnchor(n),
			size = fig ? slotRect(nodes(fig).find((v) => v.id === n.id)!) : undefined;
		const w = size?.w || boxHalf(n)[0] * 2,
			h = size?.h || boxHalf(n)[1] * 2;
		const dx = n.x - a[0] + (own.includes('west') ? -w / 2 : own.includes('east') ? w / 2 : 0),
			dy = n.y - a[1] + (own.includes('north') ? h / 2 : own.includes('south') ? -h / 2 : 0);
		return `([shift={(${num(dx)}mm,${num(dy)}mm)}]${n.treeParent}.${anchor})`;
	}
	return `(${num(n.x)},${num(n.y)})`;
}

export function nodeLine(
	n: FigNode,
	figureFont = 'small',
	hasIcon = !!n.icon,
	layerOpacity = 1,
	fig?: Figure,
	inlineLabel?: FigNode,
): string {
	if (n.kind === 'icon') {
		const o = [
			'sg icon',
			...categoryOption(n.cat, 'Icon'),
			...emitOptions(itemOverrides(n)),
			`pic text={${n.title}}`,

			...(n.layer ? [`sg layer=${n.layer}`] : []),
			...(n.group ? [`sg in=${n.group}`] : []),
			...(n.locked ? ['sg locked'] : []),
			...opacityOptions(n.style?.opacity, layerOpacity),
			...n.extra,
		];
		const line = `\\pic[${o.join(', ')}] (${n.id}) at ${coordinate(n, fig)} {sg object={${n.icon || ''}}{${num(n.width)}}{${num(n.minh || n.width)}}};`;
		return n.hidden ? `% sakuga hidden ${line}` : line;
	}
	const def = fig && n.cat && nodeStyleKind(n) ? findStyle(fig, n.cat, nodeStyleKind(n)!) : undefined;
	const own: ObjectStyle | undefined = itemOverrides(n);
	const o = [
		n.kind === 'label' ? 'sg text' : 'sg shape',
		...categoryOption(n.cat, n.kind === 'label' ? 'Text' : 'Shape'),
	];
	if (n.kind === 'label') {
		o.push(`sg label height=${boxHalf({ ...n, style: { ...n.style, font: n.style?.font || figureFont } })[1] * 2}`);
	}
	if (n.kind === 'label' && own?.border && own.border !== 'none') {
		o.push('draw=black!38');
	}
	if (n.slot) o.push(`anchor=${ownAnchor(n)}`);
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
	if (n.style?.compact) {
		const body =
			(boxHalf({ ...n, style: { ...n.style, font: n.style?.font || figureFont } })[1] * 2 - (2 * 25.4) / 72.27) /
			(25.4 / 72.27);
		o.push(`text height=${body * 0.6}pt`, `text depth=${body * 0.4}pt`);
	}
	const title = n.kind === 'label' && n.style?.step ? `\\sglabel{${n.style.step}}{${n.title}}` : n.title;
	let content = n.code ? `${title}\\\\[-1pt]\\sgcode{${n.code}}` : title;

	if (inlineLabel) {
		const st = inlineLabel.style || {},
			b = slotRect(inlineLabel);
		content = `\\sglabeltext{${st.font || figureFont}}{${fill(st.textColor || 'black')}}{${st.text?.startsWith('bold') ? 'bfseries' : 'mdseries'}}{${st.text?.includes('italic') ? 'itshape' : 'upshape'}}{${num(b?.textWidth || inlineLabel.width)}}{${content}}`;
	}
	if (n.titleHidden) content = `\\phantom{${content}}`;
	const label = hasIcon ? `\\sgcontent{${n.iconPosition || 'left'}}{${n.width}}{${content}}` : content;
	const line = `\\node[${[...o, ...emitOptions(own, { forceDefaults: true, height: boxHalf({ ...n, style: { ...n.style, font: n.style?.font || figureFont } })[1] * 2, thin: !!def && (def.props.lineWidth !== undefined || (!!def.props.weight && def.props.weight !== 'thin')), redraw: !!def && def.kind === 'box' && def.props.border === 'none' }), ...opacityOptions(n.style?.opacity, layerOpacity), ...n.extra].join(', ')}] (${n.id}) at ${coordinate(n, fig)} {${label}};`;
	return n.hidden ? `% sakuga hidden ${line}` : line;
}
