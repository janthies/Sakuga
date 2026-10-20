import { lookStyles } from './look';
// The generated blocks: icons, theme, frames and legend.
import { lineItems } from '../model/tree';
import { subtreeState } from '../model/tree-queries';
import { context } from '../context';
import { labelOptions } from './label';
import { styleDefOptions } from './style-line';
import { emitOptions } from './options';
import { nodeIcon } from '../geometry/boxes';
import { routeObjects } from '../geometry/figure-geometry';
import { PALETTE, darkerColor, fill } from '../model/colour';
import { DEFAULT_WIDTH } from '../model/constants';
import { Figure, Group } from '../model/figure';
import {
	categories,
	edges,
	fontSize,
	groupMembers,
	groups,
	isHidden,
	legendOn,
	nodeLayer,
	nodes,
	opacity,
	smallerFont,
	styleDefs,
} from '../model/queries';
import { frameAppearance } from '../styles/appearance';
import { num } from '../util/num';

function iconCode(fig: Figure): string[] {
	const usedCats = new Set(nodes(fig).map((n) => n.cat));
	const used = new Set(
		[
			...nodes(fig).map((n) => nodeIcon(fig, n)),
			...categories(fig)
				.filter((c) => legendOn(fig) && c.legend)
				.map((c) => c.icon),
		].filter(Boolean),
	);
	if (!used.size && !nodes(fig).some((n) => n.kind === 'icon')) {
		return [];
	}
	return [
		String.raw`\tikzset{sg icon stroke/.style={draw=black!60,line width=0.6pt,line cap=round,line join=round}}`,
		String.raw`\tikzset{pics/sg object/.style n args={3}{code={\path (-#2/2,-#3/2) rectangle (#2/2,#3/2);\node[anchor=center,inner sep=0pt,outer sep=0pt,minimum width=#2mm,minimum height=#3mm] (-center) at (0,0) {};\if\relax\detokenize{#1}\relax\else\pic[xscale=#2/3,yscale=#3/3] at (-#2/2,#3/2) {sg icon/#1};\fi\node[anchor=west,inner sep=0pt,align=left] (-label) at (#2/2+1,0) {\tikzpictext};}}}`,
		String.raw`\def\sgicon#1{\tikz[baseline=-0.3pt]{\path[use as bounding box] (0,0) rectangle (8.544pt,8.544pt);\pic at (0,8.544pt) {sg icon/#1};}}`,
		...context.icons
			.filter((i) => used.has(i.name))
			.map(
				(i) =>
					String.raw`\tikzset{sg icon/${i.name}/.pic={\begin{scope}[x=1pt,y=1pt,scale=0.355659449,yscale=-1,sg icon stroke]` +
					i.paths.map((p) => `\\draw svg "${p}";`).join('') +
					(i.circles ?? []).map((c) => `\\draw (${c.cx},${c.cy}) circle[radius=${c.r}];`).join('') +
					(i.rects ?? [])
						.map(
							(r) =>
								`\\draw[rounded corners=${r.rx ?? 0}pt] (${r.x},${r.y}) rectangle (${r.x + r.width},${r.y + r.height});`,
						)
						.join('') +
					String.raw`\end{scope}}}`,
			),
	];
}

export function themeBlock(fig: Figure): string[] {
	const custom = new Set<string>();
	for (const m of lookStyles(fig)
		.join(',')
		.matchAll(/sgc([0-9A-F]{6})/g))
		custom.add(m[1]);
	for (const d of styleDefs(fig)) {
		for (const match of styleDefOptions(d)
			.join(', ')
			.matchAll(/sgc([0-9A-F]{6})/g)) {
			custom.add(match[1]);
		}
	}
	for (const [objects, arrow] of [
		[nodes(fig), false],
		[edges(fig), true],
	] as const) {
		for (const o of objects) {
			for (const match of [...emitOptions(o.style, { arrow }), ...o.extra].join(', ').matchAll(/sgc([0-9A-F]{6})/g)) {
				custom.add(match[1]);
			}
		}
	}

	for (const g of groups(fig)) {
		for (const c of [
			g.color,
			frameAppearance(g).color,
			g.frameColor,
			g.titleColor,
			g.labelStyle?.color,
			darkerColor(g.color),
			darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373')),
		]) {
			if (c && /^#[0-9a-f]{6}$/i.test(c)) custom.add(c.slice(1).toUpperCase());
		}
	}
	for (const e of edges(fig))
		for (const l of [e.labelStyle, ...(e.labels || []).map((l) => l.style)])
			if (l?.color?.startsWith('#')) custom.add(l.color.slice(1).toUpperCase());
	return [
		'% sakuga theme begin (generated from the style lines above)',
		...iconCode(fig),
		...[...custom].sort().map((hex) => `\\definecolor{sgc${hex}}{HTML}{${hex}}`),
		...Object.keys(PALETTE)
			.filter((c) => c !== 'white')
			.map(
				(c) =>
					`\\definecolor{${PALETTE[c].name}}{HTML}{${fig.theme?.palette?.[c]?.replace('#', '') || PALETTE[c].hex}}`,
			),
		String.raw`\def\sgcontent#1#2#3{\def\sgpos{#1}\def\sgleft{left}\def\sgright{right}\def\sgsw{sw}\def\sgse{se}\ifx\sgpos\sgleft\makebox[#2mm][r]{\parbox{\dimexpr#2mm-4mm\relax}{\centering#3}}\else\ifx\sgpos\sgright\makebox[#2mm][l]{\parbox{\dimexpr#2mm-4mm\relax}{\centering#3}}\else\ifx\sgpos\sgsw\parbox{#2mm}{\centering#3\par\vspace*{4mm}}\else\ifx\sgpos\sgse\parbox{#2mm}{\centering#3\par\vspace*{4mm}}\else\parbox{#2mm}{\vspace*{4mm}\centering#3}\fi\fi\fi\fi}`,
		String.raw`\def\sgcodesize{}\tikzset{sg want/.style={},sg code font/.code={\def\sgcodesize{\csname#1\endcsname}}}`,
		String.raw`\def\sgcode#1{{\ifdim\csname f@size\endcsname pt<9pt\tiny\else\ifdim\csname f@size\endcsname pt<10pt\scriptsize\else\ifdim\csname f@size\endcsname pt<10.5pt\footnotesize\else\ifdim\csname f@size\endcsname pt<11.5pt\small\else\normalsize\fi\fi\fi\fi\sgcodesize\ttfamily\textcolor{black!48}{#1}}}`,
		String.raw`\def\sgstep#1{\tikz[baseline=-0.6ex]\node[circle,fill=.,text=white,font=\sffamily\bfseries\scriptsize,inner sep=1pt,minimum size=3.6mm]{#1};}`,
		String.raw`\def\sglabel#1#2{\raisebox{\dimexpr\depth/2-\height/2\relax}{\sgstep{#1}}\hspace{0.8mm}\raisebox{\dimexpr\depth/2-\height/2\relax}{\shortstack{#2}}}`,
		'\\tikzset{',
		`  sg box/.style={draw=black!38, line width=0.45pt, rounded corners=1.4pt, align=center,`,
		`    inner xsep=3pt, inner ysep=3.5pt, minimum height=6mm, text width=${DEFAULT_WIDTH}mm, fill=white},`,
		'  sg shape/.style={sg box}, sg text/.style={sg box, draw=none, fill=none, rounded corners=0pt}, sg conn/.style={arr}, sg line/.style={draw=black!50,line width=0.45pt}, sg frame/.style={}, sg id/.style={},',
		'  sg compact/.style={inner xsep=1pt, inner ysep=1pt, minimum height=0pt},',
		'  sg label/.style={sg box, draw=none, fill=none, rounded corners=0pt}, sg label height/.style={minimum height={#1mm-0.45pt}},',

		'  arr/.style={-{Latex[length=1.5mm, width=1.2mm]}, draw=black!50, line width=0.45pt, rounded corners=2pt},',
		'  head both/.style={{Latex[length=1.5mm, width=1.2mm]}-{Latex[length=1.5mm, width=1.2mm]}},',
		'  head none/.style={-},',
		'  sg label/.style={align=center,text width={},draw=none,rounded corners=0pt,text=black!65,font=\\sffamily\\scriptsize,fill=white,inner sep=1pt},',
		'  sg elabel/.style={align=center, text=black!65, font=\\sffamily\\scriptsize, fill=white, inner sep=1pt},',
		'  sg labels/.style={}, sg label side/.style={}, sg label position/.style={}, sg step/.style={}, sg lane/.style={}, sg line width/.style={}, sg tip length/.style={}, sg tip width/.style={}, sg route/.style={}, sg mid/.style={}, sg bend/.style={}, sg implicit from/.style={}, sg implicit to/.style={},',
		'  sg straight/.style={}, sg manhattan/.style={}, sg curved/.style={}, sg fixed/.style={},',
		'  sg icon height/.style={minimum height=#1mm}, sg icon/.style={}, sg icon position/.style={}, sg in/.style={}, sg layer/.style={}, sg hidden/.style={}, sg locked/.style={}, sg opacity/.style={},',
		'  sg frame dashed/.style={draw=black!55, line width=0.7pt, dash pattern=on 9pt off 3pt, rounded corners=2.5pt, inner sep=2.8mm},',
		'  sg frame dotted/.style={draw=black!55, line width=1.5pt, line cap=round, dash pattern=on 0pt off 4.5pt, rounded corners=2.5pt, inner sep=1.8mm},',
		'  sg frame region/.style={rounded corners=1.5pt, inner sep=3mm},',
		'  sg frame solid/.style={draw=black!55, line width=0.7pt, rounded corners=2.5pt, inner sep=3mm},',
		'  sg frame none/.style={inner sep=0pt},',
		'  sg glabel/.style={font=\\sffamily\\scriptsize, text=black!55, inner sep=1.5pt},',
		'  arr-dashed/.style={arr, draw=black!35, dash pattern=on 1.4pt off 1.4pt},',
		'  sg swatch/.style={draw=black!38, line width=0.45pt, rounded corners=1pt,',
		'    minimum width=3.6mm, minimum height=3.6mm, inner sep=0pt},',
		...lookStyles(fig),
		'}',
		'% sakuga theme end',
	];
}

// Frames and regions of the groups, behind everything else; inner groups first, so that an outer
// frame can fit around an inner one.
export function groupsBlock(fig: Figure): string[] {
	const gs = groups(fig).filter(
		(g) =>
			!subtreeState(fig, g.id, 'hidden') &&
			(g.frame !== 'none' || edges(fig).some((e) => e.from === g.id || e.to === g.id)),
	);
	if (!gs.length) {
		return [];
	}
	const visible = nodes(fig).filter((n) => !isHidden(fig, n));
	const members = (gid: string): string[] => [
		...lineItems(fig)
			.filter((l) => l.group === gid && !subtreeState(fig, l.id, 'hidden'))
			.map((l) => `(${l.start.join(',')}) (${l.end.join(',')})`),
		...visible
			.filter((n) => n.group === gid)
			.map((n) => (n.kind === 'icon' ? `(${n.id}-center) (${n.id}-label)` : `(${n.id})`)),
		...groups(fig)
			.filter((g) => g.parent === gid)
			.flatMap((g) => (g.frame === 'none' ? members(g.id) : members(g.id).length ? [`(${g.id})`] : [])),
	];
	const depth = (g: Group): number =>
		g.parent ? 1 + depth(groups(fig).find((x) => x.id === g.parent) ?? { ...g, parent: '' }) : 0;
	const out = ['% sakuga groups begin (generated from the group lines)', '\\begin{scope}[on background layer]'];
	// first the size of every frame, inner ones first; then the drawing, outer ones first
	const sized = [...gs].sort((a, b) => depth(b) - depth(a)).filter((g) => members(g.id).length);
	const objects = routeObjects(fig);
	for (const g of sized) {
		const b = objects.find((n) => n.id === g.id);
		out.push(
			`\\node[sg frame, inner sep=0pt, outer sep=0pt, fit={(${b.x - b.w / 2},${b.y - b.h / 2}) (${b.x + b.w / 2},${b.y + b.h / 2})}] (${g.id}) {};`,
		);
	}

	out.push('\\end{scope}', '% sakuga groups end');
	return out;
}

// Legend: one swatch per used category, three per column, below the figure's bottom-left corner.
export function legendBlock(fig: Figure): string[] {
	const used = new Set(nodes(fig).map((n) => n.cat));
	const cats = categories(fig).filter((c) => c.legend);
	if (!legendOn(fig) || cats.length === 0) {
		return [];
	}
	const out = ['% sakuga legend begin (generated)', '\\begin{scope}[shift={(current bounding box.south west)}]'];
	cats.forEach((c, i) => {
		const x = Math.floor(i / 3) * 34,
			y = -7 - (i % 3) * 6;
		out.push(
			c.icon
				? `\\node[anchor=center,inner sep=0pt] at (${x + 1.8},${y - 1.8}) {\\sgicon{${c.icon}}};`
				: `\\node[sg swatch, fill=${fill(c.color || 'white')}, anchor=north west] at (${x},${y}) {};`,
		);
		out.push(
			`\\node[anchor=west, inner sep=0pt, font=\\sffamily\\${smallerFont(fontSize(fig))}] at (${num(x + 4.6)},${num(y - 1.8)}) {${c.name}};`,
		);
	});
	out.push('\\end{scope}', '% sakuga legend end');
	return out;
}

export function pictureFont(line: string, size: string): string {
	const font = `font=\\sffamily\\${size}`;
	if (/font=\\sffamily\\\w+/.test(line)) {
		return line.replace(/font=\\sffamily\\\w+/, font);
	}
	return line.replace(
		/\\begin\{tikzpicture\}(?:\[([^\]]*)\])?/,
		(_, options: string) => `\\begin{tikzpicture}[${options ? options + ', ' : ''}${font}]`,
	);
}
