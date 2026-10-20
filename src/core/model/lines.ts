// Inserting lines into the figure at the place their kind belongs.
import { Figure, Line } from './figure';
import { layers, nodeLayer, nodes } from './queries';

export function materializeLayers(fig: Figure) {
	if (!fig.lines.some((l) => l.t === 'layer')) {
		insert(fig, { t: 'layer', layer: { ...layers(fig)[0] } });
	}
	for (const n of nodes(fig)) {
		n.layer = nodeLayer(fig, n).id;
	}
}

// Insert after the last line of the same kind, else at a sensible place.
export function insert(fig: Figure, line: Line) {
	const last = (t: string) => fig.lines.map((l) => l.t).lastIndexOf(t as Line['t']);
	let at = last(line.t);
	if (at < 0 && line.t === 'edge') {
		at = last('node');
	}
	if (at < 0 && line.t === 'group') {
		at = Math.max(last('style'), last('legendflag'), last('arrowsflag'));
	}
	if (at < 0 && (line.t === 'legendflag' || line.t === 'arrowsflag')) {
		at = Math.max(last('style'), last('legendflag'));
	}
	if (
		at < 0 &&
		(line.t === 'style' ||
			line.t === 'legendflag' ||
			line.t === 'arrowsflag' ||
			line.t === 'group' ||
			line.t === 'layer')
	) {
		at = fig.lines.findIndex((l) => l.t === 'raw' && l.text.includes('\\begin{tikzpicture}')) - 1;
	}
	if (at < 0 && line.t === 'node') {
		at = fig.lines.findIndex((l) => l.t === 'theme');
	}
	if (at < 0) {
		at = fig.lines.findIndex((l) => l.t === 'legend' || (l.t === 'raw' && l.text.includes('\\end{tikzpicture}'))) - 1;
	}
	fig.lines.splice(at + 1, 0, line);
}
