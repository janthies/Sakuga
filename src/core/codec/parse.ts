// Reading a figure file into the model.
import { readGroup } from './group';
import { ARROWSFLAG, CAT, CODE, EDGE, GROUP, HIDDEN, LAYER, LEGENDFLAG, NODE, PIC, STYLE, opts } from './lexer';
import { parsePath } from './parse-path';
import { readOptions } from './options';
import { readStyleLine } from './style-line';
import { normalizeWidth, resolveAttachments } from '../geometry/boxes';
import { DEFAULT_WIDTH } from '../model/constants';
import { Attachment, Figure, Line, StyleKind } from '../model/figure';
import { nodeLayer, nodes, opacity } from '../model/queries';
import { settle } from '../styles/resolve';

export function parse(text: string): Figure {
	const lines: Line[] = [];
	const individuallyHidden = new Set<string>();
	const labelKeys = new Set(Array.from(text.matchAll(/^%\s*sakuga style label\s+([\w-]+)/gm), (m) => m[1]));
	let block: 'theme' | 'legend' | 'groups' | 'icons' | null = null;
	for (let line of text.split(/\r?\n/)) {
		const hidden = HIDDEN.exec(line);
		if (hidden && !block) {
			line = hidden[1];
		}
		if (block) {
			if (line.includes(`% sakuga ${block} end`)) {
				block = null;
			}
			continue;
		}
		if (/^%\s*sakuga (theme|legend|groups|icons) begin/.test(line)) {
			block = line.includes('icons')
				? 'icons'
				: line.includes('theme')
					? 'theme'
					: line.includes('groups')
						? 'groups'
						: 'legend';
			lines.push({ t: block });
			continue;
		}
		const relative =
			/at \(\[shift=\{\((-?[\d.]+)(?:mm)?,\s*(-?[\d.]+)(?:mm)?\)\}\]([\w-]+)\.(north west|north east|south west|south east|north|south|east|west|center)\)/.exec(
				line,
			);
		const own =
			/(?:\[|,\s*)anchor=(north west|north east|south west|south east|north|south|east|west|center)(?=,|\])/.exec(line);
		const attachment: Attachment | undefined = relative
			? {
					parent: relative[3],
					anchor: relative[4],
					ownAnchor: own?.[1] || 'center',
					dx: +relative[1],
					dy: +relative[2],
				}
			: undefined;
		if (relative) {
			line = line.replace(relative[0], 'at (0,0)');
		}
		let m = LAYER.exec(line);
		if (m) {
			lines.push({
				t: 'layer',
				layer: {
					id: m[1],
					name: m[2],
					hidden: !!m[3],
					locked: !!m[4],
					...(m[5] !== undefined ? { opacity: opacity(+m[5]) } : {}),
				},
			});
			continue;
		}
		m = CAT.exec(line);
		if (m) {
			lines.push({
				t: 'style',
				s: { kind: 'box', key: m[1], name: m[2], props: { fill: m[3] }, icon: m[4], boxes: !!m[5], legend: !m[6] },
			});
			continue;
		}
		m = STYLE.exec(line);
		if (m) {
			lines.push({ t: 'style', s: readStyleLine(m[1] as StyleKind, m[2], m[3], m[4]) });
			continue;
		}
		m = LEGENDFLAG.exec(line);
		if (m) {
			lines.push({ t: 'legendflag', on: m[1] === 'on' });
			continue;
		}
		m = PIC.exec(line);
		if (m) {
			// Pics use their origin, so the emitted shift already accounts for the own anchor.
			if (attachment) {
				attachment.dx += attachment.ownAnchor.includes('west')
					? -+m[6] / 2
					: attachment.ownAnchor.includes('east')
						? +m[6] / 2
						: 0;
				attachment.dy += attachment.ownAnchor.includes('north')
					? +m[7] / 2
					: attachment.ownAnchor.includes('south')
						? -+m[7] / 2
						: 0;
			}
			const o = opts(m[1]),
				value = (key: string) => o.find((v) => v.startsWith(key + '='))?.slice(key.length + 1) || '';
			lines.push({
				t: 'node',
				n: {
					id: m[2],
					attachment,
					kind: 'icon',
					icon: m[5],
					x: +m[3],
					y: +m[4],
					width: +m[6],
					minh: +m[7],
					title: value('pic text').slice(1, -1),
					code: '',
					cat: '',
					layer: value('sg layer'),
					group: value('sg in'),
					hidden: !!hidden || o.includes('sg hidden'),
					locked: o.includes('sg locked'),
					...readOptions(
						o.filter((v) => !/^(?:pic text|anchor|sg layer|sg in)=/.test(v) && v !== 'sg locked' && v !== 'sg hidden'),
					),
				},
			});
			if (o.includes('sg hidden')) {
				individuallyHidden.add(m[2]);
			}
			continue;
		}
		m = NODE.exec(line);
		if (m) {
			const o = opts(m[1]);
			if (o.includes('sg hidden')) {
				individuallyHidden.add(m[2]);
			}
			const styleOpt = o.find((x) => x.startsWith('sg style/') || x.startsWith('cat-'));
			const cat = styleOpt ? styleOpt.slice(styleOpt.startsWith('cat-') ? 4 : 9) : '';
			const isLabel = o.includes('sg label') || labelKeys.has(cat);
			const w = o.find((x) => /^text width\s*=/.test(x));
			const h = o.find((x) => /^minimum height\s*=/.test(x));
			const layer = o.find((x) => /^sg layer\s*=/.test(x));
			const g = o.find((x) => /^sg in\s*=/.test(x));
			let content = /^\\sgcontent\{[\w-]+\}\{[\d.]+\}\{([\s\S]*)\}$/.exec(m[5])?.[1] ?? m[5];
			const positioned =
				/^\\parbox\[c\]\[([\d.]+)mm\]\[([tcb])\]\{[\d.]+mm\}\{\\(raggedright|centering|raggedleft) ([\s\S]*)\}$/.exec(
					content,
				);
			let titlePosition: string | undefined;
			if (positioned) {
				const vertical = { t: 'north', c: '', b: 'south' }[positioned[2]];
				const horizontal = { raggedright: 'west', centering: '', raggedleft: 'east' }[positioned[3]];
				titlePosition = [vertical, horizontal].filter(Boolean).join(' ') || 'center';
				content = positioned[4];
			}
			const code = CODE.exec(content);
			const title = code ? content.slice(0, code.index) : content;
			const icon = /^\\sgicon\{([\w-]+)\}\\ /.exec(title);
			lines.push({
				t: 'node',
				n: {
					id: m[2],
					attachment,
					titlePosition,
					kind: isLabel ? 'label' : undefined,
					cat,
					x: +m[3],
					y: +m[4],
					title: icon ? title.slice(icon[0].length) : title,
					icon: o.find((x) => x.startsWith('sg icon='))?.slice(8) || icon?.[1],
					iconPosition: o.find((x) => x.startsWith('sg icon position='))?.slice(17),
					code: code ? code[1] : '',
					wantWidth: o.some((x) => x.startsWith('sg want='))
						? +o.find((x) => x.startsWith('sg want='))!.slice(8)
						: undefined,
					codeFont: o.find((x) => x.startsWith('sg code font='))?.slice(13),
					width: w ? parseFloat(w.split('=')[1]) : DEFAULT_WIDTH,
					minh: h ? parseFloat(h.split('=')[1]) : 0,
					layer: layer ? layer.split('=')[1].trim() : '',
					group: g ? g.split('=')[1].trim() : '',
					hidden: o.includes('sg hidden') || !!hidden,
					locked: o.includes('sg locked'),
					...readOptions(
						o.filter(
							(x) =>
								!x.startsWith('sg want=') &&
								!x.startsWith('sg code font=') &&
								!x.startsWith('sg icon') &&
								x !== styleOpt &&
								x !== 'sg box' &&
								x !== 'sg label' &&
								!x.startsWith('sg label height=') &&
								!(o.includes('sg compact') && /^(text height|text depth)=/.test(x)) &&
								!(isLabel && x === 'draw=black!38') &&
								!(attachment && x === `anchor=${attachment.ownAnchor}`) &&
								x !== w &&
								x !== h &&
								x !== g &&
								x !== layer &&
								x !== 'sg hidden' &&
								x !== 'sg locked',
						),
						false,
						!!cat,
					),
				},
			});
			continue;
		}
		m = GROUP.exec(line);
		if (m) {
			lines.push({
				t: 'group',
				g: { id: m[1], name: m[2], frame: m[3], color: m[4], parent: m[5] ?? '', ...readGroup(m[6]) },
			});
			continue;
		}
		m = ARROWSFLAG.exec(line);
		if (m) {
			lines.push({ t: 'arrowsflag', style: m[1] });
			continue;
		}
		m = EDGE.exec(line);
		const e = m && parsePath(opts(m[1]), m[2]);
		if (e) {
			lines.push({ t: 'edge', e });
			continue;
		}
		lines.push({ t: 'raw', text: line });
	}
	const fig = { lines };
	for (const n of nodes(fig))
		if (n.kind === 'label' && n.style?.step)
			n.title = n.title.startsWith('\\sglabel{')
				? n.title.replace(/^\\sglabel\{[^}]*\}\{/, '').slice(0, -1)
				: n.title.replace(/^\\sgstep\{[^}]*\}(?:\\ )?/, '');
	for (const n of nodes(fig)) {
		if (nodeLayer(fig, n).hidden) {
			n.hidden = individuallyHidden.has(n.id);
		}
	}
	for (const n of nodes(fig)) normalizeWidth(fig, n);
	resolveAttachments(fig);
	settle(fig);
	return fig;
}
