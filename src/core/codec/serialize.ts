import { categoryHeader, themeHeader } from './look';
// Writing a figure back to TikZ.
import { resolvePorts } from '../geometry/ports';
import { subtreeState } from '../model/tree-queries';
import { lineReference } from './line-reference';
import { lineSource } from './line';
import { treeState } from './tree-state';
import { syncTree, lineItems } from '../model/tree';
import { groupsBlock, legendBlock, pictureFont, themeBlock } from './blocks';
import { edgeLine } from './edge-line';
import { groupOptions } from './group';
import { attachedIcons, hiddenReference, nodeLine } from './node-line';
import { nodeIcon, resolveAttachments } from '../geometry/boxes';
import { geometryOf } from '../geometry/figure-geometry';
import { FigNode, Figure, Line } from '../model/figure';
import { edges, fontSize, groupMembers, groups, isHidden, layers, nodeLayer, nodes, opacity } from '../model/queries';
import { settle } from '../styles/resolve';

// The \node line of a box.
export function nodeSource(fig: Figure, n: FigNode): string {
	return nodeLine(
		{
			...n,
			style: n.style,
			hidden: isHidden(fig, n),
			extra: [...n.extra, ...(n.hidden && nodeLayer(fig, n).hidden ? ['sg hidden'] : [])],
		},
		fontSize(fig),
		!!nodeIcon(fig, n),
		opacity(nodeLayer(fig, n).opacity),
		fig,
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
		const p = n.attachment && nodes(fig).find((p) => p.id === n.attachment!.parent);
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
		...themeHeader(fig),
		...lines.flatMap((l) => {
			switch (l.t) {
				case 'tree':
					return [treeState(fig)];
				case 'line':
					return [lineSource(fig, l.line), ...lineReference(fig, l.line)];
				case 'node':
					return [
						nodeSource(fig, l.n),
						...hiddenReference(fig, l.n),
						...(nodeIcon(fig, l.n) && l.n.kind !== 'icon' && !isHidden(fig, l.n) ? attachedIcons(fig, [l.n]) : []),
					];
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
						`% sakuga group ${l.g.id} {${l.g.name}} ${l.g.frame} ${l.g.color}${l.g.parent ? ` in=${l.g.parent}` : ''}${groupOptions(l.g)}`,
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
					return attachedIcons(fig);
				case 'legend':
					return legendBlock(fig);
				case 'raw':
					return [l.text.includes('\\begin{tikzpicture}') ? pictureFont(l.text, fontSize(fig)) : l.text];
			}
		}),
	].join('\n');
}
