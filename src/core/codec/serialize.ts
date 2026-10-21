import { childrenOf, itemById } from '../model/tree-queries';
import { slotRect } from '../geometry/slot-layout';
import { categoryHeader, themeHeader } from './look';
// Writing a figure back to TikZ.
import { resolvePorts } from '../geometry/ports';
import { ancestors, subtreeState } from '../model/tree-queries';
import { lineReference } from './line-reference';
import { lineSource } from './line';
import { treeState } from './tree-state';
import { syncTree, lineItems } from '../model/tree';
import { groupsBlock, legendBlock, pictureFont, themeBlock } from './blocks';
import { edgeLine } from './edge-line';
import { groupOptions } from './group';
import { nodeLine } from './node-line';
import { nodeIcon, resolveAttachments } from '../geometry/boxes';
import { geometryOf } from '../geometry/figure-geometry';
import { FigNode, Figure, Line } from '../model/figure';
import { edges, fontSize, groupMembers, groups, isHidden, layers, nodeLayer, nodes, opacity } from '../model/queries';
import { settle } from '../styles/resolve';

// The \node line of a box.
export function nodeSource(fig: Figure, n: FigNode): string {
	const label = childrenOf(fig, n.id).find((i) => i.kind === 'Text' && i.slot === 'centre');
	const b = slotRect(n);
	return nodeLine(
		{
			...n,
			...(n.kind === 'label' && b?.textWidth ? { width: b.textWidth } : {}),
			...(label?.kind === 'Text'
				? { title: label.text, code: label.code || '', codeFont: label.node?.codeFont, titleHidden: label.hidden }
				: {}),
			...(!n.kind && b
				? {
						minh: b.h,
						width: !n.style?.shape || ['rectangle', 'rounded', 'pill'].includes(n.style.shape) ? b.w - 2.2675 : n.width,
					}
				: {}),
			iconPosition: n.iconPosition || (nodeIcon(fig, n) && n.cat ? 'nw' : undefined),
			style: n.style,
			hidden: isHidden(fig, n),
			extra: [...n.extra, ...(n.hidden && nodeLayer(fig, n).hidden ? ['sg hidden'] : [])],
		},
		fontSize(fig),
		!!nodeIcon(fig, n),
		opacity(nodeLayer(fig, n).opacity),
		fig,
		label?.kind === 'Text' ? label.node : undefined,
	);
}

export function serialize(fig: Figure): string {
	syncTree(fig);
	settle(fig);
	resolveAttachments(fig);
	resolvePorts(fig);
	const ordered: FigNode[] = [],
		visited = new Set<string>();
	const visit = (n: FigNode) => {
		if (visited.has(n.id)) {
			return;
		}
		visited.add(n.id);
		const parent = ancestors(fig, n.id).find((i) => i.kind === 'Shape');
		const p = parent && 'node' in parent ? parent.node : undefined;
		if (p) {
			visit(p);
		}
		ordered.push(n);
	};
	layers(fig).forEach((layer) =>
		nodes(fig)
			.filter((n) => nodeLayer(fig, n).id === layer.id)
			.forEach(visit),
	);
	// Reuse node slots so unrecognised TikZ and comments keep their positions.
	let nextNode = 0,
		nextLine = 0;
	const freeLines = lineItems(fig);
	const lines: Line[] = fig.lines
		.filter((l) => l.t !== 'edge' && l.t !== 'groups' && l.t !== 'icons')
		.map((l) =>
			l.t === 'node'
				? { t: 'node', n: ordered[nextNode++] }
				: l.t === 'line'
					? { t: 'line', line: freeLines[nextLine++] }
					: l,
		);
	let afterNodes = Math.max(lines.map((l) => l.t).lastIndexOf('node'), lines.map((l) => l.t).lastIndexOf('line')) + 1;
	if (!afterNodes) {
		afterNodes = lines.findIndex((l) => l.t === 'legend' || (l.t === 'raw' && l.text.includes('\\end{tikzpicture}')));
		if (afterNodes < 0) {
			afterNodes = lines.length;
		}
	}
	lines.splice(afterNodes, 0, ...edges(fig).map((e) => ({ t: 'edge' as const, e })));

	if (!lines.some((l) => l.t === 'theme')) {
		const at = lines.findIndex((l) => l.t === 'raw' && l.text.includes('\\begin{tikzpicture}'));
		lines.splice(at + 1, 0, { t: 'theme' });
	}
	if (
		!lines.some((l) => l.t === 'groups') &&
		groups(fig).some((g) => g.frame !== 'none' || edges(fig).some((e) => e.from === g.id || e.to === g.id))
	) {
		const at = Math.max(lines.map((l) => l.t).lastIndexOf('node'), lines.map((l) => l.t).lastIndexOf('line'));
		lines.splice(at + 1, 0, { t: 'groups' });
	}
	if (!lines.some((l) => l.t === 'legend')) {
		const at = lines.findIndex((l) => l.t === 'raw' && l.text.includes('\\end{tikzpicture}'));
		lines.splice(at < 0 ? lines.length : at, 0, { t: 'legend' });
	}
	if (!lines.some((l) => l.t === 'tree')) {
		const at = lines.findIndex((l) => l.t === 'raw' && l.text.includes('\\begin{tikzpicture}'));
		lines.splice(at < 0 ? 0 : at, 0, { t: 'tree' });
	}
	const geo = geometryOf(fig);
	return [
		...(fig.figure
			? [`% sakuga figure place=${fig.figure.place} label=${fig.figure.label} caption={${fig.figure.caption}}`]
			: []),
		...themeHeader(fig),
		...lines.flatMap((l) => {
			switch (l.t) {
				case 'tree':
					return [treeState(fig)];
				case 'line':
					return [lineSource(fig, l.line), ...lineReference(fig, l.line)];
				case 'node':
					if (
						l.n.kind === 'label' &&
						l.n.slot === 'centre' &&
						itemById(fig, l.n.treeParent || '')?.kind === 'Shape' &&
						childrenOf(fig, l.n.treeParent!).find((i) => i.kind === 'Text' && i.slot === 'centre')?.id === l.n.id
					)
						return [];
					return [nodeSource(fig, l.n)];
				case 'edge': {
					const hiddenGroup = groups(fig).some(
						(g) => (g.id === l.e.from || g.id === l.e.to) && groupMembers(fig, g.id).every((n) => isHidden(fig, n)),
					);
					const hid =
						subtreeState(fig, l.e.id!, 'hidden') ||
						hiddenGroup ||
						[l.e.from, l.e.to].some((id) => subtreeState(fig, id, 'hidden')) ||
						nodes(fig).some((n) => isHidden(fig, n) && (n.id === l.e.from || n.id === l.e.to));
					return [hid ? `% sakuga hidden ${edgeLine(fig, l.e, geo)}` : edgeLine(fig, l.e, geo)];
				}
				case 'layer':
					return [
						`% sakuga layer ${l.layer.id} {${l.layer.name}}${l.layer.hidden ? ' hidden' : ''}${l.layer.locked ? ' locked' : ''}${opacity(l.layer.opacity) !== 1 ? ` opacity=${opacity(l.layer.opacity)}` : ''}`,
					];
				case 'group':
					return [
						`${subtreeState(fig, l.g.id, 'hidden') ? '% sakuga hidden ' : ''}% sakuga group ${l.g.id} {${l.g.name}} ${l.g.frame} ${l.g.color}${l.g.parent ? ` in=${l.g.parent}` : ''}${groupOptions(l.g)}`,
					];
				case 'groups':
					return groupsBlock(fig);
				case 'arrowsflag':
					return [`% sakuga arrows ${l.style}`];
				case 'style':
					return [categoryHeader(l.s)];
				case 'legendflag':
					return [`% sakuga legend ${l.on ? 'on' : 'off'}`];
				case 'theme':
					return themeBlock(fig);
				case 'icons':
					return [];
				case 'legend':
					return legendBlock(fig);
				case 'raw':
					return [l.text.includes('\\begin{tikzpicture}') ? pictureFont(l.text, fontSize(fig)) : l.text];
			}
		}),
	].join('\n');
}
