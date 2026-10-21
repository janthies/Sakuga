import type { Attachment } from '../model/figure';
/** Read native relative nodes and the old anchor/offset dialect into migration input. */
export function readRelative(line: string): { line: string; attachment?: Attachment } {
	const m =
		/at\s*\((?:\[([^\]]*)\])?([\w-]+)\.(north west|north east|south west|south east|north|south|east|west|center)\)/.exec(
			line,
		);
	if (!m) return { line };
	const own =
		/(?:\[|,\s*)anchor=(north west|north east|south west|south east|north|south|east|west|center)(?=,|\])/.exec(
			line,
		)?.[1] || 'center';
	const shift = /shift=\{\((-?[\d.]+)(?:mm)?,\s*(-?[\d.]+)(?:mm)?\)\}/.exec(m[1] || '');
	const axis = (k: string) => +new RegExp(k + 'shift=(-?[\\d.]+)(?:mm)?').exec(m[1] || '')?.[1]! || 0;
	return {
		line: line.replace(m[0], 'at (0,0)'),
		attachment: {
			parent: m[2],
			anchor: m[3],
			ownAnchor: own,
			dx: shift ? +shift[1] : axis('x'),
			dy: shift ? +shift[2] : axis('y'),
		},
	};
}
