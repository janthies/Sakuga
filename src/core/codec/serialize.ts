// Writing a figure back to TikZ.
import { groupsBlock, legendBlock, pictureFont, themeBlock } from './blocks';
import { edgeLine } from './edge-line';
import { groupOptions } from './group';
import { attachedIcons, hiddenReference, nodeLine } from './node-line';
import { styleLine } from './style-line';
import { nodeIcon, resolveAttachments } from '../geometry/boxes';
import { FigNode, Figure, Line } from '../model/figure';
import { edges, fontSize, groupMembers, groups, isHidden, layers, nodeLayer, nodes, opacity } from '../model/queries';
import { settle } from '../styles/resolve';

export function serialize(fig: Figure): string {
	settle(fig);
	resolveAttachments(fig);
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
	let nextNode = 0;
	const lines: Line[] = fig.lines
		.filter((l) => l.t !== 'edge' && l.t !== 'groups' && l.t !== 'icons')
		.map((l) => (l.t === 'node' ? { t: 'node', n: ordered[nextNode++] } : l));
	let afterNodes = lines.map((l) => l.t).lastIndexOf('node') + 1;
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
		const at = lines.map((l) => l.t).lastIndexOf('node');
		lines.splice(at + 1, 0, { t: 'groups' });
	}
	if (!lines.some((l) => l.t === 'legend')) {
		const at = lines.findIndex((l) => l.t === 'raw' && l.text.includes('\\end{tikzpicture}'));
		lines.splice(at < 0 ? lines.length : at, 0, { t: 'legend' });
	}
	return lines
		.flatMap((l) => {
			switch (l.t) {
				case 'node':
					return [
						nodeLine(
							{
								...l.n,
								style: l.n.style,
								hidden: isHidden(fig, l.n),
								extra: [...l.n.extra, ...(l.n.hidden && nodeLayer(fig, l.n).hidden ? ['sg hidden'] : [])],
							},
							fontSize(fig),
							!!nodeIcon(fig, l.n),
							opacity(nodeLayer(fig, l.n).opacity),
							fig,
						),
						...hiddenReference(fig, l.n),
						...(nodeIcon(fig, l.n) && l.n.kind !== 'icon' && !isHidden(fig, l.n) ? attachedIcons(fig, [l.n]) : []),
					];
				case 'edge': {
					const hiddenGroup = groups(fig).some(
						(g) => (g.id === l.e.from || g.id === l.e.to) && groupMembers(fig, g.id).every((n) => isHidden(fig, n)),
					);
					const hid = hiddenGroup || nodes(fig).some((n) => isHidden(fig, n) && (n.id === l.e.from || n.id === l.e.to));
					return [hid ? `% sakuga hidden ${edgeLine(fig, l.e)}` : edgeLine(fig, l.e)];
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
					return [styleLine(l.s)];
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
		})
		.join('\n');
}
