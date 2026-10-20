import { readCategoryOption } from './look';
// The path of an arrow: coordinates in parentheses, operators between them, at most one label node.
import { pathLabels } from './path-labels';
import { fromHex } from '../util/hex';
import { MARKERS } from './keys';
import { readOptions } from './options';
import { ARROWS } from '../model/constants';
import { FigEdge } from '../model/figure';

// The path of an arrow: coordinates in parentheses, operators between them, at most one label node.
export function parsePath(o: string[], path: string): FigEdge | null {
	const labelStart = /node\[[^\]]*\]\s*\{/.exec(path);
	let label: string | undefined,
		routePath = path;
	if (labelStart) {
		let depth = 1,
			i = labelStart.index + labelStart[0].length;
		for (; i < path.length && depth; i++) {
			let slashes = 0;
			for (let j = i - 1; j >= 0 && path[j] === '\\'; j--) slashes++;
			if (slashes % 2) continue;
			if (path[i] === '{') depth++;
			if (path[i] === '}') depth--;
		}
		label = path.slice(labelStart.index, i);
		routePath = path.slice(0, labelStart.index) + path.slice(i);
	}
	while (/node\[[^\]]*\]\s*\{/.test(routePath)) {
		const m = /node\[[^\]]*\]\s*\{/.exec(routePath)!;
		let d = 1,
			i = m.index + m[0].length;
		for (; i < routePath.length && d; i++) {
			if (routePath[i - 1] === '\\') continue;
			if (routePath[i] === '{') d++;
			if (routePath[i] === '}') d--;
		}
		routePath = routePath.slice(0, m.index) + routePath.slice(i);
	}
	const tokens = routePath.match(/\([^()]*\)|--|-\||\|-|to\[[^\]]*\]/g);
	if (!tokens) return null;
	const coords = tokens.filter((t) => t.startsWith('('));
	const ops = tokens.filter((t) => !t.startsWith('('));
	const ids = (c: string) =>
		c
			.slice(1, -1)
			.replace(/^\[[^\]]*\]/, '')
			.split(/-\||\|-/)
			.map((p) => p.trim().split('.')[0])
			.filter((p) => /^[A-Za-z_][\w-]*$/.test(p));
	if (coords.length < 2 || !ids(coords[0]).length || !ids(coords[coords.length - 1]).length) {
		return null;
	}
	const from = ids(coords[0])[0],
		to = ids(coords[coords.length - 1]).slice(-1)[0];
	const endpointAnchor = (c: string) =>
		/-\||\|-/.test(c)
			? undefined
			: /\.(north west|north east|south west|south east|north|south|east|west|center)(?=\s|\))/.exec(c)?.[1];
	const styleOpt = o.find((x) => x.startsWith('sg style/'));
	const kind = o.find((x) => (ARROWS as readonly string[]).includes(x)) ?? 'arr';
	const head = o.includes('head both') ? 'both' : o.includes('head none') ? 'none' : 'end';
	const e: FigEdge = {
		cat: readCategoryOption(o),
		...(styleOpt ? { styleKey: styleOpt.slice(9) } : {}),
		id: o.find((x) => x.startsWith('sg id='))?.slice(6),
		from,
		to,
		fromAnchor: endpointAnchor(coords[0]),
		toAnchor: endpointAnchor(coords[coords.length - 1]),
		kind,
		route: 'auto',
		mid: null,
		bend: 0,
		head,
		label: label ? label.replace(/^node\[[^\]]*\]\s*\{/, '').slice(0, -1) : '',
		...readOptions(
			o.filter(
				(x) =>
					x !== 'sg conn' &&
					!x.startsWith('sg id=') &&
					x !== kind &&
					x !== styleOpt &&
					x !== 'head both' &&
					x !== 'head none' &&
					!MARKERS.includes(x) &&
					!/^sg (lane|route|mid|bend)=/.test(x) &&
					!/^sg implicit /.test(x) &&
					!x.startsWith('sg labels='),
			),
			true,
			!!styleOpt,
		),
	};
	const meta = o.find((x) => x.startsWith('sg labels='));
	if (meta) {
		const data = JSON.parse(fromHex(meta.slice(10)));
		e.labelStyle = data.style;
		e.labels = data.labels;
		if (data.text !== undefined) e.label = data.text;
	}
	if (!meta) {
		const labels = pathLabels(path);
		if (labels.length && (labels.length > 1 || !path.includes('node[sg elabel'))) {
			e.label = labels[0].text;
			e.labelStyle = labels[0].style;
			e.labels = labels.slice(1);
		}
	}
	if (label) {
		e.style = {
			...e.style,
			...(/near start/.test(label) ? { position: 'start' } : /near end/.test(label) ? { position: 'end' } : {}),
			...(!e.labelStyle?.side && /, above/.test(label)
				? { side: 'above' }
				: !e.labelStyle?.side && /, below/.test(label)
					? { side: 'below' }
					: !e.labelStyle?.side && /, left/.test(label)
						? { side: 'left' }
						: !e.labelStyle?.side && /, right/.test(label)
							? { side: 'right' }
							: {}),
		};
	}
	const lane = o.find((v) => v.startsWith('sg lane='));
	if (lane) {
		e.lane = +lane.slice(8);
	}
	const routeMeta = o.find((v) => v.startsWith('sg route='));
	const offset = (c: string) => {
		if (/xshift=.*yshift=/.test(c)) return undefined;
		const m = /[xy]shift=(-?[\d.]+)mm/.exec(c);
		return m ? +m[1] : undefined;
	};
	e.fromOffset = offset(coords[0]);
	e.toOffset = offset(coords[coords.length - 1]);
	let parsedPath = false;
	const loop = /to\[([^\]]*(?:out=|loop )[^\]]*)\]/.exec(routePath);
	if (from === to && loop) {
		const opts = loop[1],
			value = (name: string) => {
				const m = new RegExp('(?:^|,\\s*)' + name + '=(-?[\\d.]+)(?:mm)?').exec(opts);
				return m ? +m[1] : undefined;
			};
		e.route = 'loop';
		e.loopOut = value('out');
		e.loopIn = value('in');
		e.loopSize = value('min distance') ?? 8;
		e.looseness = value('looseness');
		e.loopMax = value('max distance');
		const angle = e.loopOut ?? 90;
		e.loopSide =
			e.fromAnchor ||
			(angle >= 45 && angle < 135
				? 'north'
				: angle >= 135 && angle < 225
					? 'west'
					: angle >= 225 && angle < 315
						? 'south'
						: 'east');
		parsedPath = true;
	}
	if (
		o.includes('sg fixed') &&
		!routeMeta &&
		!ops.some((op) => op.startsWith('to')) &&
		!(
			coords.length === 3 &&
			ops[1] === '--' &&
			/^\(-?[\d.]+,-?[\d.]+\)$/.test(coords[1]) &&
			!e.fromAnchor &&
			!e.toAnchor
		)
	) {
		e.route = 'fixed';
		e.chain = tokens;
		parsedPath = true;
	}

	if (meta) {
		const data = JSON.parse(fromHex(meta.slice(10)));
		if (data.legacySide) e.style = { ...e.style, side: data.legacySide };
		if (data.legacyPosition) e.style = { ...e.style, position: data.legacyPosition };
	}
	if (e.style?.step) {
		if (e.label.startsWith('\\sglabel{')) e.label = e.label.replace(/^\\sglabel\{[^}]*\}\{/, '').slice(0, -1);
		e.label = e.label.replace(/^\\sgstep\{[^}]*\}(?:\\ )?/, '');
		if (e.label.startsWith('\\shortstack{') && e.label.endsWith('}')) e.label = e.label.slice(12, -1);
	}
	if (parsedPath) return e;
	if (routeMeta) {
		for (const end of ['from', 'to'] as const) {
			const key = 'sg implicit ' + end,
				implicit = o.find((x) => x === key || x.startsWith(key + '='));
			if (implicit) {
				if (implicit === key) delete e[end === 'from' ? 'fromAnchor' : 'toAnchor'];
				else e[end === 'from' ? 'fromAnchor' : 'toAnchor'] = implicit.slice(key.length + 1);
				delete e[end === 'from' ? 'fromOffset' : 'toOffset'];
			}
		}
		e.route = routeMeta.slice(9);
		const mid = o.find((v) => v.startsWith('sg mid=')),
			bend = o.find((v) => v.startsWith('sg bend='));
		if (mid) e.mid = +mid.slice(7);
		if (bend) e.bend = +bend.slice(8);
		return e;
	}

	const marker = o.find((x) => MARKERS.includes(x));
	if (marker && marker !== 'sg fixed') {
		e.route = marker.slice(3);
	} else if (marker === 'sg fixed') {
		const xy = coords.length === 3 ? coords[1].slice(1, -1).split(',').map(Number) : null;
		if (ops[0] === '-|') {
			e.route = 'hvh';
			e.mid = xy ? xy[0] : null;
		} else if (ops[0] === '|-') {
			e.route = 'vhv';
			e.mid = xy ? xy[1] : null;
		} else if (ops[0]?.startsWith('to')) {
			const a = /bend (left|right)(?:=(-?[\d.]+))?/.exec(ops[0]);
			e.route = 'bend';
			e.bend = (a && a[2] ? +a[2] : 30) * (a && a[1] === 'right' ? -1 : 1);
		} else {
			e.route = 'straight';
		}
	}
	return e;
}
