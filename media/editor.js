// Sakuga canvas. Draws the boxes and arrows of the TikZ file in the look they get in the PDF and
// sends edits as operations; the extension writes them into the file and sends the new state back.
(() => {
	const vscode = acquireVsCodeApi();
	window.addEventListener('error', (e) =>
		vscode.postMessage({ type: 'error', text: `${e.message} (${e.lineno}:${e.colno})` }),
	);
	const NS = 'http://www.w3.org/2000/svg';

	// Look of Fig. 5.2 (fig_components.tex); sizes measured from LuaLaTeX output.
	const PT = 25.4 / 72.27; // mm per TeX point
	const TITLE_PT = 10,
		CODE_PT = 8; // \small and \scriptsize in an 11 pt document
	const XSEP = 3 * PT,
		LINE = 0.45 * PT;
	const HEIGHTS = [0, 6.16, 9.55]; // box height in mm for 1 and 2 lines of text
	const STROKE = '#9e9e9e',
		ARROW = '#808080',
		ARROW_DASHED = '#a6a6a6',
		CODE = '#858585';
	const PX_PER_MM = 96 / 25.4; // 100 % zoom = true size on screen

	const svg = document.getElementById('canvas');
	const inspector = document.getElementById('inspector');
	const input = document.getElementById('edit');
	const src = document.getElementById('src');
	const measure = document.createElement('canvas').getContext('2d');

	let figureFont = 'small';
	const sizes = { scriptsize: 8, footnotesize: 9, small: 10, normalsize: 10.95, large: 12 };
	const smallerPt = (pt) => ({ 8: 6, 9: 8, 10: 9, 10.95: 10, 12: 10.95 })[pt] || 9;
	const fontPt = (n) => sizes[n?.style?.font || figureFont] || 10;
	const selectedLayers = new Set();
	let layers = [],
		activeLayer = 'layer1';
	const expandedLayers = new Set();
	let groups = [],
		selG = null,
		layerAnchor = null,
		layerDrag = null;
	const collapsed = new Set();
	let icons = [];
	let openStyles = new Set(),
		pendingStyleFocus = null;
	let nodes = [],
		edges = [],
		cats = [],
		styles = [],
		shared = [],
		legend = true,
		palette = {},
		defaultWidth = 26;
	let keyObject = null,
		freshBox = null;
	let selN = new Set(),
		selE = new Set(); // selected box ids and arrow indices
	let view = { s: 4, ox: 0, oy: 0 }; // px per mm and the position of (0,0) in px
	let drag = null,
		hover = null,
		editing = null,
		pendingEdit = null,
		moved = false,
		fitted = false,
		lastCat = '';
	let space = false,
		pendingSelect = null,
		styleClip = null,
		lastPaste = '',
		pasteCount = 0;
	let grid = (vscode.getState() || {}).grid || 1;
	let recentColors = (vscode.getState() || {}).recentColors || [];
	const saveState = () => vscode.setState({ ...vscode.getState(), grid, recentColors });
	let arrowsStyle = 'manhattan';
	const etools = document.getElementById('etools');
	const isTyping = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
	const r1 = (v) => String(Math.round(v * 10) / 10);

	const post = (op) => {
		const assign = (o) =>
			o.op === 'batch' ? { ...o, ops: o.ops.map(assign) } : o.op === 'addNode' ? { ...o, layer: activeLayer } : o;
		vscode.postMessage({ type: 'op', op: assign(op) });
	};
	const byId = (id) => nodes.find((n) => n.id === id);
	const catOf = (key) => cats.find((c) => c.key === key);
	const snap = (v) => Math.round(v / grid) * grid;
	const fine = (v) => Math.round(v * 10) / 10;
	const px = (x) => view.ox + x * view.s;
	const py = (y) => view.oy - y * view.s;

	const ANCHORS = ['north west', 'north', 'north east', 'west', 'center', 'east', 'south west', 'south', 'south east'];
	const isBox = (n) => n && !n.kind;
	function anchorPoint(n, a) {
		const { w, h } = layout(n);
		return {
			x: n.x + (a.includes('west') ? -w / 2 : a.includes('east') ? w / 2 : 0),
			y: n.y + (a.includes('north') ? h / 2 : a.includes('south') ? -h / 2 : 0),
		};
	}
	function descendant(id, parent) {
		const seen = new Set();
		let n = byId(id);
		while (n?.attachment && !seen.has(n.id)) {
			seen.add(n.id);
			if (n.attachment.parent === parent) {
				return true;
			}
			n = byId(n.attachment.parent);
		}
		return false;
	}
	function attachmentFor(n, parent, anchor, ownAnchor = anchor) {
		const p = anchorPoint(parent, anchor),
			o = anchorPoint(n, ownAnchor);
		return { parent: parent.id, anchor, ownAnchor, dx: fine(o.x - p.x), dy: fine(o.y - p.y) };
	}
	function resolveAttached() {
		const done = new Set(),
			visiting = new Set();
		const visit = (n) => {
			if (done.has(n.id) || visiting.has(n.id)) {
				return;
			}
			visiting.add(n.id);
			const a = n.attachment,
				p = a && byId(a.parent);
			if (p && !visiting.has(p.id)) {
				visit(p);
				const pt = anchorPoint(p, a.anchor),
					own = anchorPoint({ ...n, x: 0, y: 0 }, a.ownAnchor);
				n.x = pt.x + a.dx - own.x;
				n.y = pt.y + a.dy - own.y;
			}
			visiting.delete(n.id);
			done.add(n.id);
		};
		nodes.forEach(visit);
	}
	function anchorPicker(value, change) {
		const grid = document.createElement('div');
		grid.className = 'anchor-picker';
		grid.setAttribute('role', 'group');
		grid.setAttribute('aria-label', 'Anchor');
		for (const a of ANCHORS) {
			const b = document.createElement('button');
			b.textContent = '·';
			b.title = a;
			b.setAttribute('aria-label', a);
			b.setAttribute('aria-pressed', String(a === value));
			b.onclick = () => change(a);
			grid.append(b);
		}
		return grid;
	}
	function paintOrder() {
		const ordered = [],
			seen = new Set();
		const visit = (n) => {
			if (seen.has(n.id)) {
				return;
			}
			seen.add(n.id);
			const parent = n.attachment && byId(n.attachment.parent);
			if (parent) {
				visit(parent);
			}
			ordered.push(n);
		};
		nodes.forEach(visit);
		return ordered;
	}
	function dropAnchor(p, ids) {
		const parent = paintOrder()
			.reverse()
			.find(
				(n) =>
					isBox(n) &&
					!n.hidden &&
					!n.locked &&
					!ids.includes(n.id) &&
					!ids.some((id) => descendant(n.id, id)) &&
					Math.abs(p.x - n.x) <= layout(n).w / 2 &&
					Math.abs(p.y - n.y) <= layout(n).h / 2,
			);
		if (!parent) {
			return null;
		}
		const { w, h } = layout(parent),
			col = Math.max(0, Math.min(2, Math.floor(((p.x - parent.x + w / 2) / w) * 3))),
			row = Math.max(0, Math.min(2, Math.floor(((parent.y + h / 2 - p.y) / h) * 3)));
		return { parent, anchor: ANCHORS[row * 3 + col] };
	}

	function labelTarget(ref = selN.label) {
		if (!ref) return null;
		const g = ref.group && groups.find((g) => g.id === ref.group),
			e = ref.index === undefined ? null : edges[ref.index],
			l = ref.slot === undefined ? null : e?.labels?.[ref.slot];
		if (ref.slot !== undefined && !l) return null;
		return g
			? { text: g.name, style: g.labelStyle || {}, g }
			: e
				? { text: l ? l.text : e.label, style: (l ? l.style : e.labelStyle) || {}, e, step: l ? 0 : e.style?.step }
				: null;
	}
	function labelChange(style, ref = selN.label) {
		post({ op: 'label', ...ref, style });
	}
	function labelPoint(G, st = {}) {
		if (!G) return null;
		const t = st.pos ?? 0.5;
		if (G.curve)
			return [0, 1].map(
				(k) =>
					(1 - t) ** 3 * G.curve[0][k] +
					3 * (1 - t) ** 2 * t * G.curve[1][k] +
					3 * (1 - t) * t * t * G.curve[2][k] +
					t ** 3 * G.curve[3][k],
			);
		const i = Math.max(0, Math.min(G.pts.length - 2, st.segment ?? (G.pts.length === 4 ? 1 : 0))),
			a = G.pts[i],
			b = G.pts[i + 1];
		return a.map((v, k) => v + (b[k] - v) * t);
	}
	function arrowLabelGeom(e, st = e.labelStyle || {}, content = e.label, step = e.style?.step) {
		const G = baseEdgeGeom(e);
		if (!G) return null;
		const anchor = labelPoint(G, {
			segment:
				st.segment ?? (e.style?.position === 'start' ? 0 : e.style?.position === 'end' ? G.pts.length - 2 : undefined),
			pos: st.pos ?? (e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : undefined),
		});
		const pt = sizes[st.font || figureFont] || 10,
			lines = content.split('\\\\'),
			h = Math.max(lines.length * pt * PT * 1.25, step ? 3.6 : 0),
			w =
				Math.max(
					...lines.map((l) =>
						textMm(show(l), pt, 'Sakuga Sans', {
							text: st.bold && st.italic ? 'bold-italic' : st.bold ? 'bold' : st.italic ? 'italic' : '',
						}),
					),
				) +
				2 * PT +
				(step ? 4.4 : 0),
			side =
				st.side ||
				e.style?.side ||
				(G.loop ? { north: 'above', south: 'below', east: 'right', west: 'left' }[G.side] : undefined);
		const p = [anchor[0] + (st.dx || 0), anchor[1] + (st.dy || 0)];
		if (side === 'left' || side === 'right') p[0] += (side === 'right' ? 1 : -1) * (w / 2);
		else if (side) p[1] += (side === 'above' ? 1 : -1) * (h / 2 + PT);
		return { p, anchor, w, h, pt };
	}
	function frameTitleGeom(g) {
		const b = frameRect(g.id);
		if (!b) return null;
		const st = g.labelStyle || {},
			pos = g.titlePosition || 'legacy',
			pt = sizes[st.font || g.titleFont || 'scriptsize'],
			inside = pos.startsWith('inside') || pos === 'legacy',
			right = pos === 'inside-top-right',
			center = pos === 'above-center',
			below = pos === 'below-left';
		const anchor = [center ? b.x : right ? b.x + b.w / 2 : b.x - b.w / 2, below ? b.y - b.h / 2 : b.y + b.h / 2];
		return {
			p: [
				anchor[0] + (center ? 0 : right ? -1.5 * PT : 1.5 * PT) + (st.dx || 0),
				anchor[1] + (below ? -1 : inside ? -1 : 1) * (1.5 * PT + (pt * PT) / 2) + (st.dy || 0),
			],
			anchor,
			pt,
			align: center ? 'middle' : right ? 'end' : 'start',
		};
	}
	function labelSelection(g, ref, geom, w, h, align = 'middle') {
		const key = JSON.stringify(ref),
			selected = selN.label && JSON.stringify(selN.label) === key,
			p = geom.p;
		if (selected)
			el(
				'line',
				{
					x1: px(geom.anchor[0]),
					y1: py(geom.anchor[1]),
					x2: px(p[0]),
					y2: py(p[1]),
					stroke: 'var(--sel)',
					'stroke-width': 1,
					'stroke-dasharray': '3 3',
					'pointer-events': 'none',
				},
				g,
			);
		el(
			'rect',
			{
				x: px(p[0] - (align === 'middle' ? w / 2 : align === 'end' ? w : 0)),
				y: py(p[1] + h / 2),
				width: w * view.s,
				height: h * view.s,
				fill: 'transparent',
				stroke: selected ? 'var(--sel)' : 'none',
				'stroke-opacity': 0.5,
				'stroke-width': 1,
				'data-label': key,
				class: 'attached-label',
			},
			g,
		);
	}
	function projectLabel(e, p, content = e.label, step = e.style?.step) {
		const G = baseEdgeGeom({ ...e, labelStyle: e.labelStyle || {} });
		let best = { d: Infinity };
		for (let segment = 0; segment < (G.curve ? 1 : G.pts.length - 1); segment++)
			for (let i = 0; i <= 100; i++) {
				const pos = i / 100,
					q = labelPoint(G, { pos, segment }),
					d = Math.hypot(p.x - q[0], p.y - q[1]);
				if (d < best.d) best = { d, pos, q, segment };
			}
		let pos = best.pos;
		for (const v of [0.25, 0.5, 0.75]) if (Math.abs(pos - v) < 0.04) pos = v;
		const a = labelPoint(G, { pos, segment: best.segment }),
			dx = p.x - a[0],
			dy = p.y - a[1];
		const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'above' : 'below';
		const st = { pos, segment: best.segment, side, dx: 0, dy: 0 },
			base = arrowLabelGeom({ ...e, labelStyle: st }, st, content, step);
		st.dx = fine(p.x - base.p[0]);
		st.dy = fine(p.y - base.p[1]);
		if (Math.abs(st.dx) < 1) st.dx = 0;
		if (Math.abs(st.dy) < 1) st.dy = 0;
		return st;
	}
	function labelDrop(p, n) {
		if (n.kind !== 'label') return null;
		for (let i = edges.length - 1; i >= 0; i--) {
			const st = projectLabel(edges[i], p),
				a = labelPoint(baseEdgeGeom({ ...edges[i], labelStyle: st }), st);
			if (Math.hypot(a[0] - p.x, a[1] - p.y) < 3) return { index: i, style: st };
		}
		for (const g of typeof groups === 'undefined' ? [] : groups) {
			const b = frameRect(g.id);
			if (b && Math.abs(p.x - b.x) < b.w / 2 + 3 && Math.abs(p.y - b.y - b.h / 2) < 3) {
				const G = frameTitleGeom(g);
				return { group: g.id, style: { dx: fine(p.x - G.p[0]), dy: fine(p.y - G.p[1]) } };
			}
		}
		return null;
	}
	function darkerColor(color) {
		const hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color.slice(1) : (palette[color] || palette.grey).hex;
		return (
			'#' +
			[0, 2, 4]
				.map((i) =>
					Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.6)
						.toString(16)
						.padStart(2, '0'),
				)
				.join('')
				.toUpperCase()
		);
	}
	function frameRect(id) {
		if (typeof SakugaRoutes === 'undefined') return null;
		return SakugaRoutes.bounds(
			id,
			nodes.map((n) => ({ ...n, ...layout(n) })),
			groups,
			new Set(),
			edges,
		);
	}
	function endpointObject(id) {
		return byId(id) || frameRect(id);
	}
	function endpointTarget(p, disableSnap = false) {
		const n = nodeAt(p, 2);
		if (n && n.kind !== 'icon') {
			const { w, h } = layout(n),
				choices = [
					['west', Math.abs(p.x - (n.x - w / 2))],
					['east', Math.abs(p.x - (n.x + w / 2))],
					['north', Math.abs(p.y - (n.y + h / 2))],
					['south', Math.abs(p.y - (n.y - h / 2))],
				];
			const anchor = choices.sort((a, b) => a[1] - b[1])[0][0];
			return {
				id: n.id,
				anchor,
				...(typeof SakugaRoutes !== 'undefined' ? SakugaRoutes.snapPort({ ...n, w, h }, anchor, p, disableSnap) : {}),
			};
		}
		if (typeof groups === 'undefined') return null;
		let best = null;
		for (const g of groups.filter((g) => g.frame !== 'none')) {
			const b = frameRect(g.id);
			if (!b) continue;
			const choices = [
				['west', Math.abs(p.x - (b.x - b.w / 2)), Math.abs(p.y - b.y) <= b.h / 2 + 2],
				['east', Math.abs(p.x - (b.x + b.w / 2)), Math.abs(p.y - b.y) <= b.h / 2 + 2],
				['north', Math.abs(p.y - (b.y + b.h / 2)), Math.abs(p.x - b.x) <= b.w / 2 + 2],
				['south', Math.abs(p.y - (b.y - b.h / 2)), Math.abs(p.x - b.x) <= b.w / 2 + 2],
			];
			for (const [anchor, d, inside] of choices)
				if (inside && d < 2 && (!best || d < best.d)) best = { id: g.id, anchor, d };
		}
		return best;
	}
	function nextStep() {
		let n = 1;
		const used = new Set(edges.map((e) => e.style?.step));
		while (used.has(n)) n++;
		return n;
	}
	function numberControl(value, change, { step = 0.05, min = 0, placeholder = '' } = {}) {
		const input = document.createElement('input');
		input.type = 'number';
		input.step = String(step);
		input.min = String(min);
		input.value = value ?? '';
		input.placeholder = placeholder;
		input.addEventListener('change', () => {
			const v = input.value === '' ? null : +input.value;
			if (v === null || (Number.isFinite(v) && v >= min && (step !== 1 || Number.isInteger(v)))) change(v);
		});
		return input;
	}
	function sourceColour(indices) {
		post({
			op: 'batch',
			ops: indices.map((i) => {
				const n = byId(edges[i].from),
					g = typeof groups !== 'undefined' && groups.find((g) => g.id === edges[i].from);
				return { op: 'style', indices: [i], style: { color: darkerColor(catOf(n?.cat)?.color || g?.color || 'grey') } };
			}),
		});
	}
	function styleButtons(parent) {
		const wrap = document.createElement('div');
		wrap.className = 'buttons';
		for (const [name, fn] of [
			['Copy style', copyStyle],
			['Paste style', pasteStyle],
		]) {
			const b = document.createElement('button');
			b.textContent = name;
			b.disabled = name === 'Paste style' && !styleClip;
			b.addEventListener('click', fn);
			wrap.appendChild(b);
		}
		parent.appendChild(wrap);
	}

	function toMm(ev) {
		const r = svg.getBoundingClientRect();
		return { x: (ev.clientX - r.left - view.ox) / view.s, y: (view.oy - (ev.clientY - r.top)) / view.s };
	}

	// TeX to display text and back: \_ is an underscore, \cmd{x} shows x, \\ breaks the line.
	const show = (t) => t.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1').replace(/\\([_&%#$])/g, '$1');
	const tex = (t) => t.replace(/(^|[^\\])([_&%#$])/g, '$1\\$2').replace(/(^|[^\\])([_&%#$])/g, '$1\\$2');

	function fillOf(key) {
		const c = catOf(key);
		if (c && /^#[0-9a-f]{6}$/i.test(c.color)) return c.color;
		const p = c && palette[c.color];
		if (!p) {
			return '#ffffff';
		}
		const k = p.mix / 100;
		const ch = (i) => Math.round(parseInt(p.hex.slice(i, i + 2), 16) * k + 255 * (1 - k));
		return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
	}
	const styleColor = (key, fallback) => {
		if (key === 'none') {
			return 'none';
		}
		if (/^#[0-9a-f]{6}$/i.test(key || '')) {
			return key;
		}
		if (key === 'black!25') {
			return '#bfbfbf';
		}
		const p = palette[key];
		if (!p) {
			return fallback;
		}
		return `rgb(${[0, 2, 4].map((i) => Math.round((parseInt(p.hex.slice(i, i + 2), 16) * p.mix) / 100 + 255 * (1 - p.mix / 100))).join(',')})`;
	};
	const dash = (st) =>
		st?.border === 'dashed'
			? `${3 * PT * view.s} ${3 * PT * view.s}`
			: st?.border === 'dotted'
				? `${weight(st)} ${2 * PT * view.s}`
				: 'none';
	const weight = (st) => (st?.lineWidth ?? ({ medium: 0.8, thick: 1.2 }[st?.weight] || 0.45)) * PT * view.s;
	function textMm(t, pt, family, style = {}) {
		measure.font = `${`${style.text?.startsWith('bold') ? 'bold ' : ''}${style.text?.includes('italic') ? 'italic ' : ''}`}${(pt * 96) / 72.27}px '${family}'`;
		return (measure.measureText(t).width * 25.4) / 96;
	}
	// Title lines as TeX sets them with text width and align=center (greedy fill).
	function iconShape(parent, name) {
		const data = icons.find((i) => i.name === name);
		if (!data) {
			return;
		}
		for (const d of data.paths || []) {
			el('path', { d }, parent);
		}
		for (const c of data.circles || []) {
			el('circle', c, parent);
		}
		for (const r of data.rects || []) {
			el('rect', r, parent);
		}
	}
	function drawIcon(parent, name, x, y, w = 3, h = 3) {
		const g = el(
			'g',
			{
				transform: `translate(${px(x)},${py(y) - (h / 2) * view.s}) scale(${(w * view.s) / 24},${(h * view.s) / 24})`,
				fill: 'none',
				stroke: '#666',
				'stroke-width': (0.6 * PT * 24) / 3,
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
				'pointer-events': 'none',
			},
			parent,
		);
		iconShape(g, name);
		for (const shape of g.children) {
			shape.setAttribute('vector-effect', 'non-scaling-stroke');
			shape.setAttribute('stroke-width', 0.6 * PT * view.s);
		}
	}
	let floating = null,
		iconPanel = null,
		iconEntries = [],
		iconGroups = [],
		chooseIcon = null;
	function closeFloating(restore = true) {
		if (!floating) {
			return;
		}
		const { panel, anchor } = floating;
		panel.hidden = true;
		anchor.setAttribute('aria-expanded', 'false');
		floating = null;
		if (restore && anchor.isConnected) {
			anchor.focus();
		}
	}
	function floatAt(panel, anchor) {
		closeFloating(false);
		panel.hidden = false;
		anchor.setAttribute('aria-expanded', 'true');
		floating = { panel, anchor };
		const r = anchor.getBoundingClientRect(),
			b = panel.getBoundingClientRect();
		panel.style.left = `${Math.max(4, Math.min(r.left, innerWidth - b.width - 4))}px`;
		panel.style.top = `${Math.max(4, Math.min(r.bottom + 4, innerHeight - b.height - 4))}px`;
	}
	document.addEventListener('pointerdown', (e) => {
		if (floating && !floating.panel.contains(e.target) && !floating.anchor.contains(e.target)) {
			closeFloating(false);
		}
	});
	document.addEventListener(
		'keydown',
		(e) => {
			if (floating && e.key === 'Escape') {
				e.preventDefault();
				e.stopImmediatePropagation();
				closeFloating();
			}
		},
		true,
	);
	document.addEventListener('focusin', (e) => {
		if (floating && !floating.panel.contains(e.target) && !floating.anchor.contains(e.target)) {
			closeFloating(false);
		}
	});
	window.addEventListener('resize', () => closeFloating(false));
	function previewIcon(name) {
		const preview = el('svg', {
			viewBox: '0 0 24 24',
			width: 20,
			height: 20,
			fill: 'none',
			stroke: '#666',
			'stroke-width': (0.6 * PT * 24) / 3,
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		});
		iconShape(preview, name);
		return preview;
	}
	function buildIconPanel() {
		if (iconPanel) {
			closeFloating(false);
			iconPanel.remove();
		}
		iconPanel = document.createElement('div');
		iconPanel.className = 'floating-picker icon-panel';
		iconPanel.hidden = true;
		iconPanel.setAttribute('role', 'dialog');
		iconPanel.setAttribute('aria-label', 'Choose icon');
		const search = document.createElement('input');
		search.placeholder = 'Search icons';
		search.setAttribute('aria-label', 'Search icons');
		const body = document.createElement('div');
		body.className = 'icon-results';
		iconEntries = [];
		iconGroups = [];
		let active = 0;
		const entry = (name, parent, category = '') => {
			const b = document.createElement('button');
			b.type = 'button';
			b.title = name || 'No icon';
			b.setAttribute('aria-label', b.title);
			b.dataset.search = `${name} ${category} ${category.replace(/[-_]/g, ' ')}`.toLowerCase();
			b.dataset.value = name;
			b.tabIndex = -1;
			if (name) {
				b.append(previewIcon(name));
			} else {
				b.textContent = 'No icon';
				b.className = 'no-icon';
			}
			b.onclick = () => {
				const pick = chooseIcon;
				closeFloating();
				pick(name);
			};
			parent.append(b);
			iconEntries.push(b);
		};
		entry('', body);
		for (const category of [...new Set(icons.map((i) => i.category))].sort()) {
			const section = document.createElement('section'),
				h = document.createElement('h4'),
				grid = document.createElement('div');
			h.textContent = category.replace(/[-_]/g, ' ');
			grid.className = 'icon-grid';
			section.append(h, grid);
			body.append(section);
			for (const i of icons.filter((i) => i.category === category).sort((a, b) => a.name.localeCompare(b.name))) {
				entry(i.name, grid, category);
			}
			iconGroups.push(section);
		}
		const visible = () => iconEntries.filter((b) => !b.hidden);
		const mark = (index) => {
			const entries = visible();
			active = Math.max(0, Math.min(entries.length - 1, index));
			iconEntries.forEach((b) => b.classList.remove('active'));
			if (entries[active]) {
				entries[active].classList.add('active');
				entries[active].scrollIntoView({ block: 'nearest' });
			}
		};
		search.oninput = () => {
			const q = search.value.trim().toLowerCase();
			for (const b of iconEntries) {
				b.hidden = !!b.dataset.value && !b.dataset.search.includes(q);
			}
			for (const group of iconGroups) {
				group.hidden = ![...group.querySelectorAll('button')].some((b) => !b.hidden);
			}
			mark(0);
		};
		iconPanel.onkeydown = (e) => {
			if (e.key.startsWith('Arrow')) {
				const entries = visible(),
					current = entries[active];
				let next = active + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
				if (current && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
					const a = current.getBoundingClientRect(),
						dir = e.key === 'ArrowDown' ? 1 : -1;
					const row = entries
						.map((b, i) => ({ i, r: b.getBoundingClientRect() }))
						.filter((v) => dir * (v.r.top - a.top) > 1)
						.sort(
							(u, v) =>
								Math.abs(u.r.top - a.top) - Math.abs(v.r.top - a.top) ||
								Math.abs(u.r.left - a.left) - Math.abs(v.r.left - a.left),
						);
					if (row.length) {
						next = row[0].i;
					}
				}
				mark(next);
				search.focus();
				e.preventDefault();
				e.stopPropagation();
			} else if (e.key === 'Enter') {
				e.preventDefault();
				e.stopPropagation();
				visible()[active]?.click();
			}
		};
		iconPanel.append(search, body);
		document.body.append(iconPanel);
		iconPanel.reset = (value) => {
			search.value = '';
			search.oninput();
			const i = visible().findIndex((b) => b.dataset.value === value);
			mark(Math.max(0, i));
			search.focus();
		};
	}
	function iconPicker(value, onChange) {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'icon-picker';
		b.title = value || 'Choose icon';
		b.setAttribute('aria-label', 'Choose icon');
		b.setAttribute('aria-haspopup', 'dialog');
		b.setAttribute('aria-expanded', 'false');
		if (value) {
			b.append(previewIcon(value));
		} else {
			b.textContent = '+';
		}
		b.onclick = () => {
			if (!iconPanel) {
				buildIconPanel();
			}
			chooseIcon = onChange;
			floatAt(iconPanel, b);
			iconPanel.reset(value);
		};
		return b;
	}
	function visualChoice(options, value, onChange) {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'visual-choice';
		b.setAttribute('aria-haspopup', 'listbox');
		b.setAttribute('aria-expanded', 'false');
		const paint = (target, option) => {
			if (option.color) {
				const sw = document.createElement('i');
				sw.className = 'swatch';
				sw.style.background = option.color;
				target.append(sw);
			}
			if (option.icon) {
				target.append(previewIcon(option.icon));
			}
			const name = document.createElement('span');
			name.textContent = option.label;
			target.append(name);
		};
		paint(b, options.find((o) => o.value === value) || options[0]);
		b.onclick = () => {
			const panel = document.createElement('div');
			panel.className = 'floating-picker choice-panel';
			panel.setAttribute('role', 'listbox');
			panel.setAttribute('aria-label', 'Choose value');
			for (const o of options) {
				const item = document.createElement('button');
				item.type = 'button';
				item.setAttribute('role', 'option');
				item.setAttribute('aria-selected', String(o.value === value));
				paint(item, o);
				item.onclick = () => {
					closeFloating();
					panel.remove();
					onChange(o.value);
				};
				panel.append(item);
			}
			document.querySelectorAll('.choice-panel').forEach((p) => p.remove());
			document.body.append(panel);
			floatAt(panel, b);
			const items = [...panel.children];
			(items[options.findIndex((o) => o.value === value)] || items[0]).focus();
			panel.onkeydown = (e) => {
				let i = items.indexOf(document.activeElement);
				if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
					i =
						e.key === 'Home'
							? 0
							: e.key === 'End'
								? items.length - 1
								: (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
					items[i].focus();
					e.preventDefault();
					e.stopPropagation();
				} else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
					const found = items.find((item) => item.textContent.toLowerCase().startsWith(e.key.toLowerCase()));
					found?.focus();
					e.stopPropagation();
				}
			};
		};
		return b;
	}
	function categoryChoice(options, value, onChange) {
		return visualChoice(
			options.map(([value, label]) => {
				const c = catOf(value);
				return { value, label, color: c ? fillOf(value) : '', icon: c?.icon };
			}),
			value,
			onChange,
		);
	}
	function colourChoice(value, onChange) {
		return visualChoice(
			Object.keys(palette).map((k) => ({ value: k, label: k, color: styleColor(k, '#fff') })),
			value,
			onChange,
		);
	}
	const effectiveIcon = (n) => {
		const c = catOf(n.cat);
		return n.icon === 'none' ? '' : n.icon === 'category' || (!n.icon && c?.boxes) ? c?.icon : n.icon;
	};
	function titleLines(n) {
		return SakugaText.lines({ ...n, icon: effectiveIcon(n) }, figureFont);
	}
	function layout(n) {
		return SakugaText.layout({ ...n, icon: effectiveIcon(n) }, figureFont);
	}

	function nodeAt(p, margin = 0) {
		return paintOrder()
			.reverse()
			.find((n) => {
				if (n.hidden || n.locked) {
					return false;
				}
				const { w, h } = layout(n);
				return Math.abs(p.x - n.x) <= w / 2 + margin && Math.abs(p.y - n.y) <= h / 2 + margin;
			});
	}
	// Point on the border of n in the direction of (tx, ty), as TikZ does for (a) -- (b).
	function border(n, tx, ty) {
		const { w, h } = layout(n);
		const dx = tx - n.x,
			dy = ty - n.y;
		if (!dx && !dy) {
			return [n.x, n.y];
		}
		const shape = n.style?.shape;
		if (shape === 'ellipse' || shape === 'circle') {
			const t = 1 / Math.hypot(dx / (w / 2), dy / (h / 2));
			return [n.x + dx * t, n.y + dy * t];
		}
		if (shape === 'diamond') {
			const t = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2));
			return [n.x + dx * t, n.y + dy * t];
		}
		const t = Math.min(dx ? w / 2 / Math.abs(dx) : Infinity, dy ? h / 2 / Math.abs(dy) : Infinity);
		return [n.x + dx * t, n.y + dy * t];
	}
	function bbox() {
		const b = nodes.filter((n) => !n.hidden).map((n) => ({ n, ...layout(n) }));
		if (!b.length) {
			return { x0: 0, x1: 0, y0: 0, y1: 0 };
		}
		return {
			x0: Math.min(...b.map((o) => o.n.x - o.w / 2)),
			x1: Math.max(
				...b.map(
					(o) =>
						o.n.x +
						o.w / 2 +
						(o.n.kind === 'icon' && o.n.title ? 1 + textMm(show(o.n.title), fontPt(o.n), 'Sakuga Sans') : 0),
				),
			),
			y0: Math.min(...b.map((o) => o.n.y - o.h / 2)),
			y1: Math.max(...b.map((o) => o.n.y + o.h / 2)),
		};
	}

	function el(tag, attrs, parent) {
		const e = document.createElementNS(NS, tag);
		for (const k in attrs) {
			e.setAttribute(k, attrs[k]);
		}
		if (parent) {
			parent.appendChild(e);
		}
		return e;
	}
	function text(parent, x, y, s, pt, family, fill, anchor = 'middle') {
		const t = el(
			'text',
			{
				x: px(x),
				y: py(y),
				'text-anchor': anchor,
				'dominant-baseline': 'central',
				'font-size': pt * PT * view.s,
				'font-family': family,
				fill,
				'pointer-events': 'none',
			},
			parent,
		);
		t.textContent = s;
		return t;
	}

	// LaTeX arrow tip: length 1.5 mm, width 1.2 mm.
	function arrow(g, x1, y1, x2, y2, kind, attrs) {
		const len = Math.hypot(x2 - x1, y2 - y1) || 1;
		const ux = (x2 - x1) / len,
			uy = (y2 - y1) / len;
		const L = 1.5,
			W = 1.2;
		const bx = x2 - ux * L,
			by = y2 - uy * L;
		const color = kind === 'arr-dashed' ? ARROW_DASHED : ARROW;
		el(
			'line',
			{
				x1: px(x1),
				y1: py(y1),
				x2: px(bx + ux * 0.2),
				y2: py(by + uy * 0.2),
				stroke: color,
				'stroke-width': Math.max(0.8, LINE * view.s),
				'stroke-dasharray': kind === 'arr-dashed' ? `${1.4 * PT * view.s} ${1.4 * PT * view.s}` : 'none',
				...attrs,
			},
			g,
		);
		const c = 0.35;
		const d = [
			`M ${px(x2)} ${py(y2)}`,
			`Q ${px(bx + ux * L * c - uy * W * 0.15)} ${py(by + uy * L * c + ux * W * 0.15)} ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)}`,
			`L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}`,
			`Q ${px(bx + ux * L * c + uy * W * 0.15)} ${py(by + uy * L * c - ux * W * 0.15)} ${px(x2)} ${py(y2)} Z`,
		].join(' ');
		if (kind === 'circle') {
			const d =
				Array.from({ length: 25 }, (_, i) => {
					const th = (i / 24) * 2 * Math.PI;
					return `${i ? 'L' : 'M'} ${px(x2 - (ux * L) / 2 + (ux * Math.cos(th) * L) / 2 - (uy * Math.sin(th) * W) / 2)} ${py(y2 - (uy * L) / 2 + (uy * Math.cos(th) * L) / 2 + (ux * Math.sin(th) * W) / 2)}`;
				}).join(' ') + ' Z';
			el('path', { d, fill: color, ...attrs }, g);
		} else if (kind === 'bar') {
			el(
				'path',
				{
					d: `M ${px(x2 - (uy * W) / 2)} ${py(y2 + (ux * W) / 2)} L ${px(x2 + (uy * W) / 2)} ${py(y2 - (ux * W) / 2)}`,
					stroke: color,
					'stroke-width': LINE * view.s,
					...attrs,
				},
				g,
			);
		} else if (kind === 'triangle' || kind === 'barb' || kind === 'Stealth') {
			el(
				'path',
				{
					d: `M ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)} L ${px(x2)} ${py(y2)} L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}${kind === 'barb' ? '' : ' Z'}`,
					fill: kind === 'Stealth' ? color : '#fff',
					stroke: color,
					'stroke-width': LINE * view.s,
					...attrs,
				},
				g,
			);
		} else {
			el('path', { d, fill: color, ...attrs }, g);
		}
	}

	// Same routing rules as resolveRoute in tikz.ts, so the canvas draws what TikZ will draw.
	function boxHalf(n) {
		return [(n.width + 2.27) / 2, Math.max(n.code ? 9.55 : 6.16, n.minh || 0) / 2];
	}
	function resolveRoute(e, a, b) {
		const route = e.route === 'auto' ? arrowsStyle : e.route;
		if (route === 'straight') {
			return { type: 'line' };
		}
		if (route === 'curved') {
			return { type: 'bend', bend: 20 };
		}
		if (route === 'hvh' || route === 'vhv') {
			return { type: route, mid: e.mid };
		}
		if (route === 'bend') {
			return { type: 'bend', bend: e.bend };
		}
		const [aw, ah] = boxHalf(a),
			[bw, bh] = boxHalf(b);
		const dx = b.x - a.x,
			dy = b.y - a.y;
		const xo = Math.abs(dx) < aw + bw - 1,
			yo = Math.abs(dy) < ah + bh - 1;
		const midY = Math.round(((a.y + b.y) / 2) * 10) / 10,
			midX = Math.round(((a.x + b.x) / 2) * 10) / 10;
		if (xo && !yo) {
			if (Math.abs(dx) < 0.05) {
				return { type: 'line' };
			}
			if (Math.abs(dx) <= aw - 1) {
				return { type: 'vert', at: 'b' };
			}
			if (Math.abs(dx) <= bw - 1) {
				return { type: 'vert', at: 'a' };
			}
			return { type: 'vhv', mid: midY };
		}
		if (yo && !xo) {
			if (Math.abs(dy) < 0.05) {
				return { type: 'line' };
			}
			if (Math.abs(dy) <= ah - 1) {
				return { type: 'horz', at: 'b' };
			}
			if (Math.abs(dy) <= bh - 1) {
				return { type: 'horz', at: 'a' };
			}
			return { type: 'hvh', mid: midX };
		}
		return Math.abs(dy) >= Math.abs(dx) ? { type: 'vhv', mid: midY } : { type: 'hvh', mid: midX };
	}
	const half = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
	function baseEdgeGeom(e) {
		const a = byId(e.from),
			b = byId(e.to);
		if (
			typeof SakugaRoutes !== 'undefined' &&
			(['auto', 'manhattan', 'fixed', 'loop'].includes(e.route) ||
				e.from === e.to ||
				e.labelStyle ||
				e.labels?.length ||
				e.fromAnchor ||
				e.toAnchor ||
				!a ||
				!b ||
				SakugaRoutes.lane(e, edges) ||
				e.route === 'u')
		) {
			const aa = endpointObject(e.from),
				bb = endpointObject(e.to);
			if (!aa || !bb || aa.hidden || bb.hidden) return null;
			if (
				!['auto', 'manhattan', 'fixed', 'loop'].includes(e.route) &&
				e.from !== e.to &&
				!e.fromAnchor &&
				!e.toAnchor &&
				!aa.frame &&
				!bb.frame &&
				!SakugaRoutes.lane(e, edges) &&
				e.route !== 'u'
			)
				return SakugaRoutes.legacyGeometry(e, { ...aa, ...layout(aa) }, { ...bb, ...layout(bb) }, arrowsStyle);
			const objects = nodes
				.map((n) => ({ ...n, ...layout(n) }))
				.concat(
					(typeof groups === 'undefined' ? [] : groups)
						.filter((g) => g.frame !== 'none')
						.map((g) => frameRect(g.id))
						.filter(Boolean),
				);
			const prior = edges
				.slice(0, edges.indexOf(e))
				.map((o) => {
					const x = objects.find((n) => n.id === o.from),
						y = objects.find((n) => n.id === o.to);
					return x && y ? SakugaRoutes.geometry(o, x, y, edges, arrowsStyle, objects)?.pts : null;
				})
				.filter(Boolean);
			return SakugaRoutes.geometry(
				e,
				{ ...aa, ...(aa.frame ? {} : layout(aa)) },
				{ ...bb, ...(bb.frame ? {} : layout(bb)) },
				edges,
				arrowsStyle,
				objects,
				prior,
			);
		}
		if (!a || !b || a.hidden || b.hidden) {
			return null;
		}
		const r = resolveRoute(e, a, b);
		const la = layout(a),
			lb = layout(b);
		if (r.type === 'vert') {
			const x = r.at === 'b' ? b.x : a.x,
				down = b.y < a.y;
			const p1 = [x, a.y + (down ? -la.h / 2 : la.h / 2)],
				p2 = [x, b.y + (down ? lb.h / 2 : -lb.h / 2)];
			return { r, pts: [p1, p2], label: half(p1, p2) };
		}
		if (r.type === 'horz') {
			const y = r.at === 'b' ? b.y : a.y,
				right = b.x > a.x;
			const p1 = [a.x + (right ? la.w / 2 : -la.w / 2), y],
				p2 = [b.x + (right ? -lb.w / 2 : lb.w / 2), y];
			return { r, pts: [p1, p2], label: half(p1, p2) };
		}
		if (r.type === 'hvh' || r.type === 'vhv') {
			const h = r.type === 'hvh';
			if (r.mid === null || r.mid === undefined) {
				const c = h ? [b.x, a.y] : [a.x, b.y];
				const p1 = border(a, c[0], c[1]),
					p2 = border(b, c[0], c[1]);
				return { r, pts: [p1, c, p2], label: half(p1, c) };
			}
			const c1 = h ? [r.mid, a.y] : [a.x, r.mid],
				c2 = h ? [r.mid, b.y] : [b.x, r.mid];
			const p1 = border(a, c1[0], c1[1]),
				p2 = border(b, c2[0], c2[1]);
			return { r, pts: [p1, c1, c2, p2], label: half(c1, c2) };
		}
		if (r.type === 'bend') {
			const th = Math.atan2(b.y - a.y, b.x - a.x),
				d = ((r.bend || 0) * Math.PI) / 180;
			const out = th + d,
				inn = th + Math.PI - d;
			const p1 = border(a, a.x + Math.cos(out) * 1e3, a.y + Math.sin(out) * 1e3);
			const p2 = border(b, b.x + Math.cos(inn) * 1e3, b.y + Math.sin(inn) * 1e3);
			const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.3915;
			const c1 = [p1[0] + Math.cos(out) * L, p1[1] + Math.sin(out) * L];
			const c2 = [p2[0] + Math.cos(inn) * L, p2[1] + Math.sin(inn) * L];
			const m = [0, 1].map((k) => 0.125 * p1[k] + 0.375 * c1[k] + 0.375 * c2[k] + 0.125 * p2[k]);
			return { r, curve: [p1, c1, c2, p2], label: m };
		}
		const p1 = border(a, b.x, b.y),
			p2 = border(b, a.x, a.y);
		return { r, pts: [p1, p2], label: half(p1, p2) };
	}
	function edgeGeom(e) {
		const G = baseEdgeGeom(e);
		if (!G) {
			return G;
		}
		const t = e.style?.position === 'start' ? 0.25 : e.style?.position === 'end' ? 0.75 : 0.5;
		if (e.label && e.style?.position) {
			if (G.curve) {
				G.label = [0, 1].map(
					(k) =>
						(1 - t) ** 3 * G.curve[0][k] +
						3 * (1 - t) ** 2 * t * G.curve[1][k] +
						3 * (1 - t) * t * t * G.curve[2][k] +
						t ** 3 * G.curve[3][k],
				);
			} else {
				const bent = G.pts.length > 2,
					i = bent ? (e.style.position === 'start' ? 0 : G.special ? G.pts.length - 2 : 1) : 0,
					a = G.pts[i],
					b = G.pts[i + 1],
					u = G.special ? t : bent ? 0.5 : t;
				G.label = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
			}
		}
		if (e.label && e.style?.side) {
			const side = e.style.side,
				lines = e.label.split('\\\\'),
				h = lines.length * CODE_PT * PT * 1.25,
				w = Math.max(...lines.map((l) => textMm(show(l), CODE_PT, 'Sakuga Sans'))) + (e.style.step ? 4 : 0);
			if (side === 'left' || side === 'right') G.label[0] += (side === 'right' ? 1 : -1) * (w / 2);
			else G.label[1] += (side === 'above' ? 1 : -1) * (h / 2 + PT);
		}
		if (e.labelStyle) G.label = arrowLabelGeom(e).p;
		return G;
	}
	function tip(g, [x2, y2], [x1, y1], color, attrs, kind = 'Latex', style = {}) {
		const len = Math.hypot(x2 - x1, y2 - y1) || 1;
		const ux = (x2 - x1) / len,
			uy = (y2 - y1) / len;
		const L = style.tipLength ?? 1.5,
			W = style.tipWidth ?? 1.2,
			c = 0.35;
		const bx = x2 - ux * L,
			by = y2 - uy * L;
		const d = [
			`M ${px(x2)} ${py(y2)}`,
			`Q ${px(bx + ux * L * c - uy * W * 0.15)} ${py(by + uy * L * c + ux * W * 0.15)} ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)}`,
			`L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}`,
			`Q ${px(bx + ux * L * c + uy * W * 0.15)} ${py(by + uy * L * c - ux * W * 0.15)} ${px(x2)} ${py(y2)} Z`,
		].join(' ');
		if (kind === 'circle') {
			const d =
				Array.from({ length: 25 }, (_, i) => {
					const th = (i / 24) * 2 * Math.PI;
					return `${i ? 'L' : 'M'} ${px(x2 - (ux * L) / 2 + (ux * Math.cos(th) * L) / 2 - (uy * Math.sin(th) * W) / 2)} ${py(y2 - (uy * L) / 2 + (uy * Math.cos(th) * L) / 2 + (ux * Math.sin(th) * W) / 2)}`;
				}).join(' ') + ' Z';
			el('path', { d, fill: color, ...attrs }, g);
		} else if (kind === 'bar') {
			el(
				'path',
				{
					d: `M ${px(x2 - (uy * W) / 2)} ${py(y2 + (ux * W) / 2)} L ${px(x2 + (uy * W) / 2)} ${py(y2 - (ux * W) / 2)}`,
					stroke: color,
					'stroke-width': LINE * view.s,
					...attrs,
				},
				g,
			);
		} else if (kind === 'triangle' || kind === 'barb' || kind === 'Stealth') {
			el(
				'path',
				{
					d: `M ${px(bx - (uy * W) / 2)} ${py(by + (ux * W) / 2)} L ${px(x2)} ${py(y2)} L ${px(bx + (uy * W) / 2)} ${py(by - (ux * W) / 2)}${kind === 'barb' ? '' : ' Z'}`,
					fill: kind === 'Stealth' ? color : '#fff',
					stroke: color,
					'stroke-width': LINE * view.s,
					...attrs,
				},
				g,
			);
		} else {
			el('path', { d, fill: color, ...attrs }, g);
		}
		const shorten = kind === 'bar' ? 0 : L * 0.8;
		return [x2 - ux * shorten, y2 - uy * shorten];
	}
	function edgePath(G) {
		if (G.curve) {
			const [p1, c1, c2, p2] = G.curve;
			return `M ${px(p1[0])} ${py(p1[1])} C ${px(c1[0])} ${py(c1[1])} ${px(c2[0])} ${py(c2[1])} ${px(p2[0])} ${py(p2[1])}`;
		}
		const pts = G.pts,
			coord = (p) => `${px(p[0])} ${py(p[1])}`,
			parts = [`M ${coord(pts[0])}`];
		for (let i = 1; i < pts.length - 1; i++) {
			const a = pts[i - 1],
				b = pts[i],
				c = pts[i + 1],
				l1 = Math.hypot(a[0] - b[0], a[1] - b[1]),
				l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
			if (!l1 || !l2) {
				parts.push(`L ${coord(b)}`);
				continue;
			}
			const r = 2 * PT,
				pre = b.map((v, k) => v + ((a[k] - v) * r) / l1),
				post = b.map((v, k) => v + ((c[k] - v) * r) / l2);
			const c1 = pre.map((v, k) => v + 0.5522847 * (b[k] - v)),
				c2 = post.map((v, k) => v + 0.5522847 * (b[k] - v));
			parts.push(`L ${coord(pre)} C ${coord(c1)} ${coord(c2)} ${coord(post)}`);
		}
		parts.push(`L ${coord(pts[pts.length - 1])}`);
		return parts.join(' ');
	}
	function drawEdge(g, e, i) {
		const G = edgeGeom(e);
		if (!G) {
			return;
		}
		const alpha = (e.style?.opacity ?? 1) * (layers.find((l) => l.id === byId(e.from)?.layer)?.opacity ?? 1);
		g = el('g', { 'fill-opacity': alpha, 'stroke-opacity': alpha }, g);
		const color =
			e.style?.border === 'none' ? 'none' : styleColor(e.style?.color, e.kind === 'arr-dashed' ? ARROW_DASHED : ARROW);
		if (selE.has(i)) {
			el('path', { d: edgePath(G), fill: 'none', stroke: 'var(--sel)', 'stroke-width': 5, 'stroke-opacity': 0.35 }, g);
		}
		// the line stops inside the tip, as in TikZ
		const pts = G.curve ? G.curve.map((p) => [...p]) : G.pts.map((p) => [...p]);
		const last = pts.length - 1;
		if ((e.style?.end || (e.head === 'none' ? 'none' : 'Latex')) !== 'none') {
			pts[last] = tip(g, pts[last], pts[last - 1], color, {}, e.style?.end, e.style);
		}
		if ((e.style?.start || (e.head === 'both' ? 'Latex' : 'none')) !== 'none') {
			pts[0] = tip(g, pts[0], pts[1], color, {}, e.style?.start, e.style);
		}
		el(
			'path',
			{
				d: edgePath(G.curve ? { curve: pts } : { pts }),
				fill: 'none',
				stroke: color,
				'stroke-width': weight(e.style),
				'stroke-linejoin': 'round',
				'stroke-dasharray': e.style?.border
					? dash(e.style)
					: e.kind === 'arr-dashed'
						? `${1.4 * PT * view.s} ${1.4 * PT * view.s}`
						: 'none',
			},
			g,
		);
		if (G.blocked)
			el(
				'path',
				{
					d: edgePath(G),
					fill: 'none',
					stroke: '#d33',
					'stroke-width': 2,
					'stroke-dasharray': '5 4',
					'pointer-events': 'none',
				},
				g,
			);
		el(
			'path',
			{ d: edgePath(G), fill: 'none', stroke: 'transparent', 'stroke-width': 10, 'data-edge': i, class: 'hit' },
			g,
		);
		for (const [slot, content, st, badge] of [
			[undefined, e.label, e.labelStyle || {}, e.style?.step ? 4.4 : 0],
			...(e.labels || []).map((l, j) => [j, l.text, l.style || {}, 0]),
		]) {
			if (!content && !badge) continue;
			const geom = arrowLabelGeom(e, st, content, slot === undefined ? e.style?.step : 0),
				{
					p: [x, y],
					w,
					h,
					pt,
				} = geom,
				lines = content ? content.split('\\\\').map(show) : [],
				ref = { index: i, ...(slot === undefined ? {} : { slot }) };
			const c = styleColor(st.color || e.style?.color, '#595959');
			if (st.background !== false)
				el(
					'rect',
					{
						x: px(x - w / 2),
						y: py(y + h / 2),
						width: w * view.s,
						height: h * view.s,
						fill: '#fff',
						'pointer-events': 'none',
					},
					g,
				);
			lines.forEach((line, k) => {
				const t = text(g, x + badge / 2, y + ((lines.length - 1) / 2 - k) * pt * PT * 1.25, line, pt, 'Sakuga Sans', c);
				t.style.fontWeight = st.bold ? 'bold' : 'normal';
				t.style.fontStyle = st.italic ? 'italic' : 'normal';
			});
			if (badge) {
				const bx = x - w / 2 + 1.8;
				el('circle', { cx: px(bx), cy: py(y), r: 1.8 * view.s, fill: c, 'pointer-events': 'none' }, g);
				const t = text(g, bx, y, String(e.style.step), 8, 'Sakuga Sans', '#fff');
				t.style.fontWeight = 'bold';
			}
			labelSelection(g, ref, geom, w, h);
		}
	}
	function selBox(ids) {
		const b = ids
			.map((id) => byId(id))
			.filter(Boolean)
			.map((n) => ({ n, ...layout(n) }));
		return {
			x0: Math.min(...b.map((o) => o.n.x - o.w / 2)),
			x1: Math.max(
				...b.map(
					(o) =>
						o.n.x +
						o.w / 2 +
						(o.n.kind === 'icon' && o.n.title ? 1 + textMm(show(o.n.title), fontPt(o.n), 'Sakuga Sans') : 0),
				),
			),
			y0: Math.min(...b.map((o) => o.n.y - o.h / 2)),
			y1: Math.max(...b.map((o) => o.n.y + o.h / 2)),
		};
	}

	// Toolbar next to a selected arrow: route, heads and line, as in Figma's connector bar.
	const ICON = {
		eye: '<path d="M1 8 Q8 -1 15 8 Q8 17 1 8 Z"/><circle cx="8" cy="8" r="2"/>',
		eyeClosed: '<path d="M2 6 Q8 14 14 6 M3 9 L1 12 M8 11 V14 M13 9 L15 12"/>',
		lock: '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7 V5 a3 3 0 0 1 6 0 V7"/>',
		unlock: '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7 V5 a3 3 0 0 1 6 0"/>',
		folder: '<path d="M1 4 H6 L8 6 H15 V13 H1 Z"/>',
		triangle: '<path d="M5 3 L11 8 L5 13 Z"/>',
		straight: '<path d="M3 13 L13 3"/>',
		manhattan: '<path d="M3 13 H8 V3 H13"/>',
		curved: '<path d="M3 13 C3 5, 13 11, 13 3"/>',
		end: '<path d="M2 8 H12"/><path d="M10 5 L14 8 L10 11 Z" fill="currentColor"/>',
		both: '<path d="M4 8 H12"/><path d="M10 5 L14 8 L10 11 Z M6 5 L2 8 L6 11 Z" fill="currentColor"/>',
		none: '<path d="M2 8 H14"/>',
		dashed: '<path d="M2 8 H14" stroke-dasharray="3 2"/>',
	};
	const groupById = (id) => groups.find((g) => g.id === id);
	function inGroup(n, id, gs = groups) {
		let parent = n.group,
			seen = new Set();
		while (parent && !seen.has(parent)) {
			if (parent === id) {
				return true;
			}
			seen.add(parent);
			parent = gs.find((g) => g.id === parent)?.parent;
		}
		return false;
	}
	const members = (id) => nodes.filter((n) => inGroup(n, id)).map((n) => n.id);
	const icon = (key) =>
		`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">${ICON[key]}</svg>`;

	// Sort sibling subtrees by their frontmost node, then flatten each subtree as a block.
	function hierarchy(ns = nodes, gs = groups) {
		const rank = (item) =>
			item.kind === 'node'
				? ns.findIndex((n) => n.id === item.id)
				: Math.max(-1, ...ns.map((n, i) => (inGroup(n, item.id, gs) ? i : -1)));
		const walk = (parent, seen = new Set()) => {
			const children = [
				...ns.filter((n) => (n.group || '') === parent).map((n) => ({ kind: 'node', id: n.id })),
				...gs.filter((g) => (g.parent || '') === parent && !seen.has(g.id)).map((g) => ({ kind: 'group', id: g.id })),
			].sort((a, b) => rank(b) - rank(a));
			return children.map((item) => ({
				...item,
				children: item.kind === 'group' ? walk(item.id, new Set([...seen, item.id])) : [],
			}));
		};
		return walk('');
	}
	function completeOrder(ns, gs) {
		const flatten = (items) => items.flatMap((item) => (item.kind === 'node' ? [item.id] : flatten(item.children)));
		const front = flatten(hierarchy(ns, gs));
		return [...ns.map((n) => n.id).filter((id) => !front.includes(id)), ...front.reverse()];
	}
	function selectLayer(id, toggle = false) {
		const group = groupById(id),
			ids = group ? members(id) : [id];
		if (!toggle) {
			selN = new Set();
		}
		const remove = toggle && (group ? selG === id : selN.has(id));
		for (const key of ids.filter((key) => byId(key) && !byId(key).hidden && !byId(key).locked)) {
			if (remove) {
				selN.delete(key);
			} else {
				selN.add(key);
			}
		}
		selG = group && !remove && ids.some((key) => byId(key) && !byId(key).hidden && !byId(key).locked) ? id : null;
		keyObject = toggle && !remove ? id : null;
		selE = new Set();
	}
	function selectedRoots() {
		if (selG) {
			return [selG, ...[...selN].filter((id) => !inGroup(byId(id), selG))];
		}
		return [...selN];
	}
	function groupSelection() {
		const roots = selectedRoots();
		if (!roots.length || new Set([...selN].map((id) => byId(id)?.layer)).size > 1) {
			return;
		}
		const parents = roots.map((id) => groupById(id)?.parent ?? byId(id)?.group ?? '');
		const ancestors = (parent) => {
			const result = [''];
			while (parent && !result.includes(parent)) {
				result.unshift(parent);
				parent = groupById(parent)?.parent;
			}
			return result;
		};
		const parent = ancestors(parents[0]).find((p) => parents.every((q) => ancestors(q).includes(p))) || '';
		let i = 1;
		while (groupById(`g${i}`) || byId(`g${i}`)) {
			i++;
		}
		const group = {
			id: `g${i}`,
			name: `group ${i}`,
			frame: roots.some((id) => groupById(id)?.frame && groupById(id).frame !== 'none') ? 'solid' : 'dashed',
			color: 'grey',
			parent,
			fill: roots.some((id) => groupById(id)?.frame && groupById(id).frame !== 'none') ? 'none' : 'tint',
			outline: roots.some((id) => groupById(id)?.frame && groupById(id).frame !== 'none') ? 'solid' : 'dashed',
		};
		const ns = nodes.map((n) => ({ ...n, group: roots.includes(n.id) ? group.id : n.group }));
		const gs = [...groups.map((g) => ({ ...g, parent: roots.includes(g.id) ? group.id : g.parent })), group];
		selG = group.id;
		post({
			op: 'batch',
			ops: [
				{ op: 'addGroup', ...group },
				{ op: 'setGroup', ids: roots, group: group.id },
				{ op: 'reorder', order: completeOrder(ns, gs) },
			],
		});
	}
	function ungroupSelection() {
		if (!selG) {
			return;
		}
		post({ op: 'deleteGroup', id: selG });
		selG = null;
	}
	function dropLayers(target, above, into = true) {
		if (!layerDrag) {
			return;
		}
		const roots = layerDrag;
		const moving = new Set(roots.flatMap((id) => (groupById(id) ? members(id) : [id])));
		const targetGroup = groupById(target);
		const parent = targetGroup ? (into ? target : targetGroup.parent || '') : byId(target)?.group || '';
		if (
			roots.includes(target) ||
			moving.has(target) ||
			roots.some((id) => groupById(id) && (id === parent || inGroup({ group: parent }, id)))
		) {
			return;
		}
		const gs = groups.map((g) => ({ ...g, parent: roots.includes(g.id) ? parent : g.parent }));
		let ns = nodes.filter((n) => !moving.has(n.id));
		const block = nodes
			.filter((n) => moving.has(n.id))
			.map((n) => ({ ...n, group: roots.includes(n.id) ? parent : n.group }));
		let at;
		if (targetGroup) {
			const indices = ns.flatMap((n, i) => (inGroup(n, target, gs) ? [i] : []));
			at = indices.length ? (into || above ? Math.max(...indices) + 1 : Math.min(...indices)) : ns.length;
		} else {
			at = ns.findIndex((n) => n.id === target) + (above ? 1 : 0);
		}
		ns.splice(at, 0, ...block);
		post({
			op: 'batch',
			ops: [
				{ op: 'setGroup', ids: roots, group: parent },
				{ op: 'reorder', order: completeOrder(ns, gs) },
			],
		});
	}
	let layerScrollFrame = null,
		layerPointerY = null;
	function stopLayerScroll() {
		if (layerScrollFrame !== null) {
			cancelAnimationFrame(layerScrollFrame);
		}
		layerScrollFrame = null;
		layerPointerY = null;
	}
	function scrollLayers() {
		const list = document.getElementById('layer-list'),
			rect = list.getBoundingClientRect(),
			margin = 32;
		if (!layerDrag || layerPointerY === null) {
			stopLayerScroll();
			return;
		}
		const speed =
			layerPointerY < rect.top + margin
				? -Math.min(12, (rect.top + margin - layerPointerY) / 3)
				: layerPointerY > rect.bottom - margin
					? Math.min(12, (layerPointerY - rect.bottom + margin) / 3)
					: 0;
		list.scrollTop += speed;
		layerScrollFrame = requestAnimationFrame(scrollLayers);
	}
	const layerList = document.getElementById('layer-list');
	layerList.addEventListener('dragover', (ev) => {
		if (layerDrag) {
			ev.preventDefault();
			layerPointerY = ev.clientY;
			if (layerScrollFrame === null) {
				layerScrollFrame = requestAnimationFrame(scrollLayers);
			}
		}
	});
	layerList.addEventListener('dragleave', (ev) => {
		if (!layerList.contains(ev.relatedTarget)) {
			stopLayerScroll();
		}
	});
	for (const event of ['drop', 'dragend']) {
		document.addEventListener(event, () => {
			stopLayerScroll();
			layerList
				.querySelectorAll('.drop-group,.drop-above,.drop-below')
				.forEach((row) => row.classList.remove('drop-group', 'drop-above', 'drop-below'));
		});
	}
	let layerSignature = '';
	function moveToLayer(ids, layer) {
		if (!ids.length) {
			return;
		}
		post({ op: 'batch', ops: [{ op: 'setLayer', ids, layer }] });
		activeLayer = layer;
	}
	function renderLayers() {
		const list = document.getElementById('layer-list');
		if (list.querySelector('input')) {
			return;
		}
		const updateSelection = () => {
			for (const row of list.children) {
				const selected = row.classList.contains('container-layer')
					? selectedLayers.has(row.dataset.id)
					: groupById(row.dataset.id)
						? selG === row.dataset.id
						: selN.has(row.dataset.id);
				row.classList.toggle('selected', selected);
				row.setAttribute('aria-selected', String(selected));
				row.classList.remove('drop-group', 'drop-above', 'drop-below');
			}
			document.getElementById('group').disabled = !selN.size && !selG;
			document.getElementById('ungroup').disabled = !selG;
			const del = document.getElementById('delete-selection');
			if (del) {
				const count = selN.size + selE.size;
				del.textContent = selectedLayers.size ? 'Delete layer' : count === 1 ? 'Delete object' : 'Delete objects';
				del.disabled = selectedLayers.size ? layers.length < 2 : !count;
				del.title = del.textContent;
			}
			const move = document.querySelector('#layer-controls select');
			if (move) {
				move.disabled = !selN.size && !selG;
			}
		};
		if (selN.size || selE.size || selG) {
			selectedLayers.clear();
		}
		const signature = JSON.stringify([
			selN.size,
			selE.size,
			selG,
			layers,
			nodes.map((n) => [n.id, n.layer, n.group, n.title, n.cat, n.hidden, n.locked]),
			groups,
			cats,
			palette,
			activeLayer,
			[...selectedLayers],
			[...expandedLayers],
			[...collapsed],
		]);
		if (signature === layerSignature) {
			updateSelection();
			return;
		}
		layerSignature = signature;
		list.replaceChildren();
		const button = (row, key, title, action) => {
			const b = document.createElement('button');
			b.innerHTML = icon(key);
			b.title = title;
			b.setAttribute('aria-label', title);
			b.onclick = (ev) => {
				ev.stopPropagation();
				action();
			};
			b.ondblclick = (ev) => ev.stopPropagation();
			row.appendChild(b);
			return b;
		};
		const rename = (name, obj, op) => {
			const field = document.createElement('input');
			field.value = obj.name;
			name.replaceChildren(field);
			field.focus();
			field.select();
			let done = false;
			const finish = (commit) => {
				if (done) {
					return;
				}
				done = true;
				if (commit && field.value.trim()) {
					post({ op, id: obj.id, name: field.value.trim() });
				}
				field.remove();
				layerSignature = '';
				renderLayers();
			};
			field.onclick = (ev) => ev.stopPropagation();
			field.onkeydown = (ev) => {
				ev.stopPropagation();
				if (ev.key === 'Enter' || ev.key === 'Escape') {
					finish(ev.key === 'Enter');
				}
			};
			field.onblur = () => finish(true);
		};
		const makeRow = (id, depth) => {
			const row = document.createElement('div');
			row.className = 'layer-row';
			row.dataset.id = id;
			row.draggable = true;
			row.setAttribute('role', 'treeitem');
			row.setAttribute('aria-level', depth + 1);
			list.appendChild(row);
			return row;
		};
		const drop = (row, layer, target = null) => {
			row.ondragover = (ev) => {
				if (!layerDrag) {
					return;
				}
				ev.preventDefault();
				const fraction = (ev.clientY - row.getBoundingClientRect().top) / row.offsetHeight;
				row.classList.remove('drop-group', 'drop-above', 'drop-below');
				row.classList.add(
					!layerDrag.layer && (!target || (groupById(target) && fraction > 0.25 && fraction < 0.75))
						? 'drop-group'
						: fraction < 0.5
							? 'drop-above'
							: 'drop-below',
				);
			};
			row.ondragleave = () => row.classList.remove('drop-group', 'drop-above', 'drop-below');
			row.ondrop = (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				if (!layerDrag) {
					return;
				}
				if (layerDrag.layer) {
					const order = layers.map((l) => l.id).filter((id) => id !== layerDrag.layer);
					const above = ev.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
					order.splice(order.indexOf(layer.id) + (above ? 1 : 0), 0, layerDrag.layer);
					if (layer.id !== layerDrag.layer) {
						post({ op: 'reorderLayers', order });
					}
				} else {
					const ids = layerDrag;
					if (!ids.length) {
						layerDrag = null;
						return;
					}
					const moving = new Set(ids.flatMap((id) => (groupById(id) ? members(id) : [id])));
					if (target && (moving.has(target) || ids.includes(target))) {
						layerDrag = null;
						render();
						return;
					}
					const same = [...moving].every((id) => byId(id)?.layer === layer.id);
					const fraction = (ev.clientY - row.getBoundingClientRect().top) / row.offsetHeight;
					const into = groupById(target) && fraction > 0.25 && fraction < 0.75;
					if (target && same) {
						dropLayers(target, fraction < 0.5, into);
					} else {
						const ops = [{ op: 'setLayer', ids, layer: layer.id }];
						if (target) {
							const parent = groupById(target)
								? into
									? target
									: groupById(target).parent || ''
								: byId(target)?.group || '';
							ops.push({ op: 'setGroup', ids, group: parent });
							const order = nodes.filter((n) => !moving.has(n.id)).map((n) => n.id);
							const positions = groupById(target)
								? order.flatMap((id, i) => (inGroup(byId(id), target) ? [i] : []))
								: [order.indexOf(target)];
							const at = positions.length
								? into || fraction < 0.5
									? Math.max(...positions) + 1
									: Math.min(...positions)
								: order.length;
							order.splice(at, 0, ...nodes.filter((n) => moving.has(n.id)).map((n) => n.id));
							ops.push({ op: 'reorder', order });
						}
						post({ op: 'batch', ops });
					}
					activeLayer = layer.id;
				}
				layerDrag = null;
				render();
			};
			row.ondragend = () => {
				layerDrag = null;
				render();
			};
		};
		for (const layer of [...layers].reverse()) {
			const ns = nodes.filter((n) => n.layer === layer.id),
				row = makeRow(layer.id, 0);
			row.classList.add('container-layer');
			row.classList.toggle('selected', selectedLayers.has(layer.id));
			for (const [prop, on, off] of [
				['hidden', 'eyeClosed', 'eye'],
				['locked', 'lock', 'unlock'],
			]) {
				button(row, layer[prop] ? on : off, `${layer[prop] ? 'Disable' : 'Enable'} ${prop}`, () =>
					post({ op: 'layerProps', id: layer.id, [prop]: !layer[prop] }),
				);
			}
			const disclosure = button(
				row,
				'triangle',
				expandedLayers.has(layer.id) ? 'Collapse layer' : 'Expand layer',
				() => {
					if (expandedLayers.has(layer.id)) {
						expandedLayers.delete(layer.id);
					} else {
						expandedLayers.add(layer.id);
					}
					renderLayers();
				},
			);
			disclosure.classList.toggle('expanded', expandedLayers.has(layer.id));
			row.setAttribute('aria-expanded', String(expandedLayers.has(layer.id)));
			const name = document.createElement('span');
			name.className = 'layer-name';
			name.textContent = layer.name;
			row.appendChild(name);
			const count = document.createElement('span');
			count.className = 'layer-count';
			count.textContent = ns.length;
			row.appendChild(count);
			row.onclick = (ev) => {
				if (ev.shiftKey) {
					const a = layers.findIndex((l) => l.id === activeLayer),
						b = layers.indexOf(layer);
					if (!(ev.ctrlKey || ev.metaKey)) {
						selectedLayers.clear();
					}
					for (const l of layers.slice(Math.min(a, b), Math.max(a, b) + 1)) {
						selectedLayers.add(l.id);
					}
				} else if (ev.ctrlKey || ev.metaKey) {
					if (!selectedLayers.size) {
						selectedLayers.add(activeLayer);
					}
					if (selectedLayers.has(layer.id)) {
						selectedLayers.delete(layer.id);
					} else {
						selectedLayers.add(layer.id);
					}
				} else {
					selectedLayers.clear();
					selectedLayers.add(layer.id);
				}
				activeLayer = layer.id;
				selN.clear();
				selE.clear();
				selG = null;
				render();
			};
			name.ondblclick = () => rename(name, layer, 'layerProps');
			row.ondragstart = (ev) => {
				layerDrag = { layer: layer.id };
				ev.dataTransfer.setData('text/plain', layer.id);
			};
			drop(row, layer);
			if (!expandedLayers.has(layer.id)) {
				continue;
			}
			const gs = groups.filter((g) => members(g.id).some((id) => ns.some((n) => n.id === id)));
			const visit = (items, depth) => {
				for (const item of items) {
					const g = groupById(item.id),
						n = byId(item.id),
						child = makeRow(item.id, depth);
					child.style.paddingLeft = `${depth * 12}px`;
					child.classList.toggle('selected', g ? selG === g.id : selN.has(n.id));
					if (g) {
						const d = button(child, 'triangle', 'Expand/collapse group', () => {
							if (collapsed.has(g.id)) {
								collapsed.delete(g.id);
							} else {
								collapsed.add(g.id);
							}
							renderLayers();
						});
						d.classList.toggle('expanded', !collapsed.has(g.id));
						const folder = document.createElement('span');
						folder.innerHTML = icon('folder');
						child.appendChild(folder);
					} else {
						const swatch = document.createElement('i');
						swatch.className = 'layer-swatch';
						swatch.style.background = fillOf(n.cat);
						child.appendChild(swatch);
					}
					const label = document.createElement('span');
					label.className = 'layer-name';
					label.textContent = show(g ? g.name : n.title).replace(/\\/g, ' ');
					child.appendChild(label);
					child.onclick = (ev) => {
						selectedLayers.clear();
						activeLayer = layer.id;
						if (ev.shiftKey && layerAnchor) {
							const rows = [...list.children].filter((r) => !r.classList.contains('container-layer'));
							const a = rows.findIndex((r) => r.dataset.id === layerAnchor),
								b = rows.indexOf(child);
							if (a >= 0) {
								if (!(ev.ctrlKey || ev.metaKey)) {
									selN.clear();
								}
								for (const r of rows.slice(Math.min(a, b), Math.max(a, b) + 1)) {
									for (const id of groupById(r.dataset.id) ? members(r.dataset.id) : [r.dataset.id]) {
										if (byId(id) && !byId(id).locked && !byId(id).hidden) {
											selN.add(id);
										}
									}
								}
								selG = null;
								selE.clear();
							} else {
								selectLayer(item.id);
							}
						} else {
							selectLayer(item.id, ev.ctrlKey || ev.metaKey);
							layerAnchor = item.id;
						}
						keyObject =
							(ev.shiftKey || ev.ctrlKey || ev.metaKey) && (selN.has(item.id) || selG === item.id) ? item.id : null;
						render();
					};
					label.ondblclick = () => {
						if (g) {
							rename(label, g, 'groupProps');
						} else if (!n.locked && !n.hidden) {
							startEdit(n.id);
						}
					};
					child.ondragstart = (ev) => {
						ev.stopPropagation();
						if ((g ? members(g.id) : [n.id]).some((id) => byId(id).locked || byId(id).hidden)) {
							ev.preventDefault();
							return;
						}
						if (g ? selG !== g.id : !selN.has(item.id)) {
							selectLayer(item.id);
						}
						layerDrag = selectedRoots();
						ev.dataTransfer.setData('text/plain', item.id);
					};
					drop(child, layer, item.id);
					if (!collapsed.has(item.id)) {
						visit(item.children, depth + 1);
					}
				}
			};
			visit(hierarchy(ns, gs), 1);
		}
		let controls = document.getElementById('layer-controls');
		if (!controls) {
			controls = document.createElement('div');
			controls.id = 'layer-controls';
			document.getElementById('layer-tools').prepend(controls);
		}
		controls.replaceChildren();
		const add = document.createElement('button');
		add.textContent = '+ Layer';
		add.className = 'lc lc-add';
		add.title = 'New layer';
		add.onclick = () => {
			let i = 1;
			while (layers.some((l) => l.id === `layer${i}`)) {
				i++;
			}
			activeLayer = `layer${i}`;
			selN.clear();
			selE.clear();
			selG = null;
			selectedLayers.clear();
			selectedLayers.add(activeLayer);
			post({ op: 'addLayer', id: activeLayer, name: `Layer ${i}` });
		};
		controls.appendChild(add);
		const addObject = document.createElement('button');
		addObject.textContent = '+ Object';
		addObject.className = 'lc lc-obj';
		addObject.title = 'New box on the active layer';
		addObject.onclick = () => {
			const r = svg.getBoundingClientRect(),
				id = newId();
			pendingEdit = id;
			pendingSelect = [id];
			selectedLayers.clear();
			post({
				op: 'addNode',
				id,
				title: 'Box',
				cat: lastCat,
				x: snap((r.width / 2 - view.ox) / view.s),
				y: snap((view.oy - r.height / 2) / view.s),
			});
		};
		controls.appendChild(addObject);
		const dup = document.createElement('button');
		dup.textContent = 'Duplicate';
		dup.className = 'lc lc-dup';
		dup.title = 'Duplicate layer';
		dup.onclick = () => {
			let id = 'layer-copy',
				i = 2;
			while (layers.some((l) => l.id === id)) {
				id = `layer-copy-${i++}`;
			}
			const source = activeLayer;
			activeLayer = id;
			selN.clear();
			selE.clear();
			selG = null;
			selectedLayers.clear();
			selectedLayers.add(id);
			post({ op: 'batch', ops: [{ op: 'duplicateLayer', id: source, newId: id }] });
		};
		controls.appendChild(dup);
		const merge = document.createElement('button');
		merge.textContent = selectedLayers.size > 1 ? 'Merge selected' : 'Merge down';
		merge.className = 'lc lc-merge';
		merge.title = merge.textContent;
		merge.disabled = selectedLayers.size < 2 && layers.findIndex((l) => l.id === activeLayer) < 1;
		merge.onclick = () => {
			const ids =
				selectedLayers.size > 1
					? layers.filter((l) => selectedLayers.has(l.id)).map((l) => l.id)
					: [layers[layers.findIndex((l) => l.id === activeLayer) - 1].id, activeLayer];
			const target = ids[0];
			post({ op: 'batch', ops: [{ op: 'mergeLayers', ids, target }] });
			activeLayer = target;
			selN.clear();
			selE.clear();
			selG = null;
			selectedLayers.clear();
			selectedLayers.add(target);
		};
		controls.appendChild(merge);
		const del = document.createElement('button');
		del.id = 'delete-selection';
		del.className = 'lc lc-del';
		del.title = 'Delete';
		del.onclick = () => {
			if (selectedLayers.size) {
				post({ op: 'batch', ops: [...selectedLayers].map((id) => ({ op: 'deleteLayer', id })) });
				selectedLayers.clear();
			} else {
				deleteSelection();
			}
			render();
		};
		controls.appendChild(del);
		const move = document.createElement('select');
		move.setAttribute('aria-label', 'Move selection to layer');
		const placeholder = new Option('Move selection to…', '');
		move.appendChild(placeholder);
		for (const l of layers) {
			move.appendChild(new Option(l.name, l.id));
		}
		move.disabled = !selN.size && !selG;
		move.onchange = () => {
			if (move.value) {
				moveToLayer(selectedRoots(), move.value);
			}
		};
		controls.appendChild(move);
		updateSelection();
		document.getElementById('group').disabled = !selN.size && !selG;
		document.getElementById('ungroup').disabled = !selG;
	}

	function drawGroups(parent) {
		const draw = (items) => {
			for (const item of items) {
				const g = groupById(item.id);
				if (!g) {
					continue;
				}
				const ids = members(g.id).filter((id) => !byId(id).hidden);
				if (g.frame !== 'none' && ids.length) {
					const alpha = layers.find((l) => l.id === byId(ids[0]).layer)?.opacity ?? 1;
					const frameParent = el('g', { 'fill-opacity': alpha, 'stroke-opacity': alpha }, parent);
					const rect = frameRect(g.id),
						b = { x0: rect.x - rect.w / 2, x1: rect.x + rect.w / 2, y0: rect.y - rect.h / 2, y1: rect.y + rect.h / 2 },
						m = 0;
					const p = /^#[0-9a-f]{6}$/i.test(g.color) ? { hex: g.color.slice(1) } : palette[g.color] || palette.grey;
					const strength = (g.fillStrength ?? 30) / 100,
						outline =
							g.outline || (g.frame === 'region' || g.frame === 'none' ? (g.lineWidth ? 'solid' : 'none') : g.frame);
					const fill = p
						? `rgb(${[0, 2, 4].map((i) => Math.round(parseInt(p.hex.slice(i, i + 2), 16) * strength + 255 * (1 - strength))).join(',')})`
						: '#eee';
					el(
						'rect',
						{
							x: px(b.x0 - m),
							y: py(b.y1 + m),
							width: (b.x1 - b.x0 + 2 * m) * view.s,
							height: (b.y1 - b.y0 + 2 * m) * view.s,
							rx: (g.frame === 'region' ? 1.5 : 2.5) * PT * view.s,
							fill: (g.fill || (g.frame === 'region' ? 'tint' : 'none')) === 'none' ? 'none' : fill,
							stroke:
								outline === 'none'
									? 'none'
									: styleColor(g.frameColor || (g.outline ? darkerColor(g.color) : ''), '#737373'),
							'stroke-width': (g.lineWidth || (g.frame === 'dotted' ? 1.5 : 0.7)) * PT * view.s,
							'stroke-linecap': outline === 'dotted' ? 'round' : 'butt',
							'stroke-dasharray':
								outline === 'dashed'
									? `${9 * PT * view.s} ${3 * PT * view.s}`
									: outline === 'dotted'
										? `0 ${4.5 * PT * view.s}`
										: 'none',
							'data-group': g.id,
							class: 'group-frame',
							'pointer-events': g.frame === 'region' ? 'all' : 'stroke',
						},
						frameParent,
					);
					const pos = g.titlePosition || 'legacy';
					if (g.name && (pos !== 'legacy' || g.frame === 'region')) {
						const geom = frameTitleGeom(g),
							st = g.labelStyle || {},
							{
								p: [x, y],
								pt,
								align,
							} = geom,
							w = textMm(show(g.name), pt, 'Sakuga Sans') + 3 * PT,
							h = pt * PT + 3 * PT;
						if (st.background === true)
							el(
								'rect',
								{
									x: px(x - (align === 'middle' ? w / 2 : align === 'end' ? w : 0)),
									y: py(y + h / 2),
									width: w * view.s,
									height: h * view.s,
									fill: 'white',
								},
								frameParent,
							);
						const title = text(
							frameParent,
							x,
							y,
							show(g.name),
							pt,
							'Sakuga Sans',
							styleColor(
								st.color ||
									g.titleColor ||
									(pos === 'legacy' ? '' : darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'))),
								'#737373',
							),
							align,
						);
						title.style.fontWeight = (st.bold ?? g.titleBold) ? 'bold' : 'normal';
						title.style.fontStyle = st.italic ? 'italic' : 'normal';
						labelSelection(frameParent, { group: g.id }, geom, w, h, align);
					}
				}
				draw(item.children);
			}
		};
		draw(hierarchy());
	}
	document.getElementById('group').addEventListener('click', groupSelection);
	document.getElementById('ungroup').addEventListener('click', ungroupSelection);

	function resetToAuto(indices = [...selE]) {
		post({ op: 'batch', ops: indices.map((index) => ({ op: 'arrow', index, resetAuto: true })) });
	}
	function showToolbar(i, G) {
		const e = edges[i];
		const r = svg.getBoundingClientRect();
		const route = ['hvh', 'vhv', 'bend'].includes(e.route) ? 'fixed' : e.route;
		const buttons = [
			['route', 'auto', '↶', 'Reset to auto'],
			['route', 'straight', ICON.straight, 'Straight'],
			['route', 'manhattan', ICON.manhattan, 'Manhattan'],
			['route', 'curved', ICON.curved, 'Curved'],
			['route', 'u', 'U', 'U route'],
			null,
			['head', 'end', ICON.end, 'Head at the end'],
			['head', 'both', ICON.both, 'Heads at both ends'],
			['head', 'none', ICON.none, 'No head'],
			null,
			['kind', 'arr-dashed', ICON.dashed, 'Dashed'],
		];
		const wasOpen = !!etools.querySelector('details[open]');
		etools.replaceChildren();
		for (const b of buttons) {
			if (!b) {
				const sep = document.createElement('span');
				sep.className = 'sep';
				etools.appendChild(sep);
				continue;
			}
			const [prop, value, icon, title] = b;
			const btn = document.createElement('button');
			btn.title = title;
			btn.innerHTML = icon.startsWith('<')
				? `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4">${icon}</svg>`
				: icon;
			const active = prop === 'route' ? route === value : e[prop] === value;
			if (active) {
				btn.classList.add('on');
			}
			btn.addEventListener('pointerdown', (ev) => ev.stopPropagation());
			btn.addEventListener('click', () => {
				if (prop === 'route' && value === 'auto') {
					resetToAuto(selE.size ? [...selE] : [i]);
					return;
				}
				const v = prop === 'kind' ? (e.kind === 'arr-dashed' ? 'arr' : 'arr-dashed') : value;
				post({ op: 'arrow', index: i, [prop]: v, ...(prop === 'route' ? { mid: null, bend: 0 } : {}) });
			});
			etools.appendChild(btn);
		}
		const more = document.createElement('details');
		more.open = wasOpen;
		const summary = document.createElement('summary');
		summary.textContent = 'More';
		more.appendChild(summary);
		const panel = document.createElement('div');
		panel.className = 'arrow-more';
		for (const [name, prop, values] of styleFields(true)) {
			const label = document.createElement('label');
			label.textContent = name;
			label.appendChild(styleSelect(prop, values, [e], (style) => post({ op: 'style', indices: [i], style })));
			panel.appendChild(label);
		}
		const stepLabel = document.createElement('label');
		stepLabel.textContent = 'Step';
		stepLabel.appendChild(
			numberControl(e.style?.step, (v) => post({ op: 'style', indices: [i], style: { step: v || 0 } }), {
				step: 1,
				min: 1,
				placeholder: String(nextStep()),
			}),
		);
		panel.appendChild(stepLabel);
		const addStep = document.createElement('button');
		addStep.textContent = 'Set next step';
		addStep.onclick = () => post({ op: 'style', indices: [i], style: { step: nextStep() } });
		panel.appendChild(addStep);
		const colour = document.createElement('button');
		colour.textContent = 'Colour from source';
		colour.onclick = () => sourceColour([i]);
		panel.appendChild(colour);
		styleButtons(panel);
		more.appendChild(panel);
		etools.appendChild(more);
		etools.style.display = 'flex';
		const x = r.left + px(G.label[0]),
			y = r.top + py(G.label[1]);
		etools.style.left = `${Math.max(r.left + 4, Math.min(x - etools.offsetWidth / 2, r.right - etools.offsetWidth - 4))}px`;
		etools.style.top = `${Math.max(r.top + 4, y - etools.offsetHeight - 14)}px`;
	}

	function drawBox(n, w, h, attrs, parent) {
		const shape = n.style?.shape;
		if (shape === 'ellipse' || shape === 'circle') {
			return el('ellipse', { ...attrs, cx: px(n.x), cy: py(n.y), rx: (w * view.s) / 2, ry: (h * view.s) / 2 }, parent);
		}
		if (shape === 'diamond') {
			return el(
				'path',
				{
					...attrs,
					d: `M ${px(n.x)} ${py(n.y + h / 2)} L ${px(n.x + w / 2)} ${py(n.y)} L ${px(n.x)} ${py(n.y - h / 2)} L ${px(n.x - w / 2)} ${py(n.y)} Z`,
				},
				parent,
			);
		}
		if (shape === 'cylinder') {
			const x = px(n.x - w / 2),
				y = py(n.y + h / 2),
				ww = w * view.s,
				hh = h * view.s,
				rr = hh / 2;
			return el(
				'path',
				{
					...attrs,
					d: `M ${x + rr} ${y} L ${x + ww - rr} ${y} A ${rr} ${hh / 2} 0 0 1 ${x + ww - rr} ${y + hh} L ${x + rr} ${y + hh} A ${rr} ${hh / 2} 0 0 1 ${x + rr} ${y} M ${x + ww - rr} ${y} A ${rr} ${hh / 2} 0 0 0 ${x + ww - rr} ${y + hh}`,
				},
				parent,
			);
		}

		return el('rect', attrs, parent);
	}
	function drawDecorations(n, w, h, box, parent) {
		const st = n.style || {},
			scale = view.s,
			x = px(n.x - w / 2),
			y = py(n.y + h / 2),
			ww = w * scale,
			hh = h * scale;
		const defs = el('defs', {}, parent),
			clip = el('clipPath', { id: `sg-clip-${n.id}` }, defs),
			outline = box.cloneNode(false);
		for (const k of ['data-node', 'class', 'stroke', 'stroke-width', 'stroke-dasharray']) {
			outline.removeAttribute(k);
		}
		outline.setAttribute('fill', '#fff');
		clip.append(outline);
		if (st.border === 'double') {
			const outer = box.cloneNode(false);
			outer.setAttribute('fill', 'none');
			outer.setAttribute('stroke-width', 2 * weight(st) + 0.8 * PT * scale);
			outer.setAttribute('pointer-events', 'none');
			outer.removeAttribute('data-node');
			parent.append(outer);
			const gap = outer.cloneNode(false);
			gap.setAttribute('stroke', '#fff');
			gap.setAttribute('stroke-width', 0.8 * PT * scale);
			parent.append(gap);
		}
		const g = el('g', { 'clip-path': `url(#sg-clip-${n.id})`, 'pointer-events': 'none' }, parent);
		if (st.mark && st.mark !== 'none') {
			const corner = st.markCorner || 'ne',
				size = (st.markSize === 'medium' ? 5 : 2.4) * scale,
				right = corner.endsWith('e'),
				top = corner.startsWith('n'),
				cx = right ? x + ww : x,
				cy = top ? y : y + hh,
				dx = right ? -size : size,
				dy = top ? size : -size,
				fill = styleColor(st.markColor, '#33333A');
			if (st.mark === 'circle') {
				el('circle', { cx: cx + dx / 2, cy: cy + dy / 2, r: size / 2, fill }, g);
			} else {
				el('path', { d: `M ${cx} ${cy} l ${dx} 0 l ${-dx} ${dy} Z`, fill }, g);
			}
		}
		if (st.pattern && st.pattern !== 'none') {
			// Match the 3pt tiles and 0.4pt strokes in TikZ's patterns library.
			const tile = 3 * PT * scale,
				id = `sg-pattern-${n.id}`,
				pattern = el(
					'pattern',
					{ id, patternUnits: 'userSpaceOnUse', width: tile, height: tile, x: px(0), y: py(0) },
					defs,
				);
			const color = styleColor(st.patternColor, '#bfbfbf');
			if (st.pattern === 'dots') {
				for (const cx of [0, tile]) {
					for (const cy of [0, tile]) {
						el('circle', { cx, cy, r: 0.5 * PT * scale, fill: color }, pattern);
					}
				}
			} else {
				const d =
					st.pattern === 'horizontal'
						? `M 0 ${tile - 0.5 * PT * scale} H ${tile}`
						: st.pattern === 'vertical'
							? `M ${0.5 * PT * scale} 0 V ${tile}`
							: `M 0 ${tile} L ${tile} 0` + (st.pattern === 'crosshatch' ? ` M 0 0 L ${tile} ${tile}` : '');
				el('path', { d, stroke: color, 'stroke-width': 0.4 * PT * scale, fill: 'none' }, pattern);
			}
			el('rect', { x, y, width: ww, height: hh, fill: `url(#${id})` }, g);
		}
	}

	function contentObjects() {
		const boxes = nodes
			.filter((n) => !n.hidden)
			.map((n) => {
				const { w, h } = layout(n),
					labelWidth = n.kind === 'icon' && n.title ? 1 + textMm(show(n.title), fontPt(n), 'Sakuga Sans') : 0;
				return { x0: n.x - w / 2, x1: n.x + w / 2 + labelWidth, y0: n.y - h / 2, y1: n.y + h / 2 };
			});
		for (const g of groups) {
			const b = g.frame !== 'none' && frameRect(g.id);
			if (!b) continue;
			boxes.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h / 2, y1: b.y + b.h / 2 });
			if (g.name) {
				const G = frameTitleGeom(g),
					w = textMm(show(g.name), G.pt, 'Sakuga Sans') + 3 * PT,
					h = G.pt * PT + 3 * PT;
				const x = G.p[0] - (G.align === 'middle' ? w / 2 : G.align === 'end' ? w : 0);
				boxes.push({ x0: x, x1: x + w, y0: G.p[1] - h / 2, y1: G.p[1] + h / 2 });
			}
		}
		for (const e of edges) {
			if (e.hidden || byId(e.from)?.hidden || byId(e.to)?.hidden) continue;
			const G = edgeGeom(e);
			if (!G?.pts?.length) continue;
			boxes.push({
				x0: Math.min(...G.pts.map((p) => p[0])),
				x1: Math.max(...G.pts.map((p) => p[0])),
				y0: Math.min(...G.pts.map((p) => p[1])),
				y1: Math.max(...G.pts.map((p) => p[1])),
			});
			const labels = [
				...(e.label || e.style?.step ? [{ text: e.label || '', style: e.labelStyle, step: e.style?.step }] : []),
				...(e.labels || []),
			];
			for (const l of labels) {
				const L = arrowLabelGeom(e, l.style || {}, l.text, l.step);
				if (L) boxes.push({ x0: L.p[0] - L.w / 2, x1: L.p[0] + L.w / 2, y0: L.p[1] - L.h / 2, y1: L.p[1] + L.h / 2 });
			}
		}
		return boxes;
	}
	// The extent of everything drawn, with the legend rows; Fit and the size read-out use it.
	function contentBox() {
		if (!nodes.length) {
			return { x0: -40, x1: 40, y1: 40, y0: -40 };
		}
		const b = bbox(),
			used = new Set(nodes.map((n) => n.cat));
		const rows = Math.min(3, cats.filter((c) => used.has(c.key) && c.legend !== false).length);
		const objects = contentObjects();
		return {
			x0: Math.min(b.x0, ...objects.map((o) => o.x0)),
			x1: Math.max(b.x1, ...objects.map((o) => o.x1)),
			y0: Math.min(legend && rows ? b.y0 - 7 - rows * 6 : b.y0, ...objects.map((o) => o.y0)),
			y1: Math.max(b.y1, ...objects.map((o) => o.y1)),
		};
	}
	function updateZoombar() {
		const z = document.getElementById('zoombar');
		if (!z) {
			return;
		}
		const C = contentBox();
		document.getElementById('zi-size').textContent = nodes.length
			? `Figure ${Math.round(C.x1 - C.x0)} \u00d7 ${Math.round(C.y1 - C.y0)} mm`
			: 'Empty figure';
		document.getElementById('zi-zoom').textContent = `${Math.round((view.s / PX_PER_MM) * 100)} %`;
	}
	function render() {
		renderBase();
		drawTidyPreview();
		updateZoombar();
	}
	function renderBase() {
		if (selN.size || selE.size || selG) {
			selectedLayers.clear();
		}
		svg.replaceChildren();
		const gg = el('g', {}, svg),
			gf = el('g', {}, svg),
			gn = el('g', {}, svg),
			ge = el('g', {}, svg),
			go = el('g', {}, svg);
		if (grid >= 2 && grid * view.s >= 10) {
			const r = svg.getBoundingClientRect();
			const x0 = Math.ceil(-view.ox / view.s / grid) * grid,
				x1 = (r.width - view.ox) / view.s;
			const y1 = Math.floor(view.oy / view.s / grid) * grid,
				y0 = (view.oy - r.height) / view.s;
			const dots = [];
			for (let x = x0; x <= x1; x += grid) {
				for (let y = y1; y >= y0; y -= grid) {
					dots.push(`M ${px(x)} ${py(y)} h 0.01`);
				}
			}
			el('path', { d: dots.join(' '), stroke: '#c8c8c8', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, gg);
		}
		drawGroups(gf);
		edges.forEach((e, i) => drawEdge(ge, e, i));
		etools.style.display = 'none';
		if (selE.size === 1 && selN.size === 0 && !(drag && drag.mid !== undefined && drag.mid !== null && false)) {
			const i = [...selE][0],
				G = edges[i] && edgeGeom(edges[i]);
			if (G) {
				el(
					'circle',
					{
						cx: px(G.label[0]),
						cy: py(G.label[1]),
						r: 5,
						fill: '#fff',
						stroke: 'var(--sel)',
						'stroke-width': 1.5,
						'data-mid': i,
						class: 'midhandle',
					},
					ge,
				);
				if (!G.curve) {
					for (let j = 0; j < G.pts.length - 1; j++) {
						const a = G.pts[j],
							b = G.pts[j + 1];
						el(
							'rect',
							{
								x: px((a[0] + b[0]) / 2) - 4,
								y: py((a[1] + b[1]) / 2) - 4,
								width: 8,
								height: 8,
								fill: 'white',
								stroke: 'var(--sel)',
								'data-segment': i + ':' + j,
								class: 'handle',
							},
							ge,
						);
					}
					for (let j = 1; j < G.pts.length - 1; j++)
						el(
							'circle',
							{
								cx: px(G.pts[j][0]),
								cy: py(G.pts[j][1]),
								r: 3,
								fill: 'white',
								stroke: 'var(--sel)',
								'data-corner': i + ':' + j,
								class: 'handle',
							},
							ge,
						);
				}
				const pts = G.curve || G.pts;
				for (const [end, p] of [
					['from', pts[0]],
					['to', pts[pts.length - 1]],
				])
					el(
						'circle',
						{
							cx: px(p[0]),
							cy: py(p[1]),
							r: 5,
							fill: 'var(--handle)',
							stroke: 'var(--sel)',
							'stroke-width': 1.5,
							'data-endpoint': i + ':' + end,
							class: 'handle',
						},
						ge,
					);
				if (!drag) {
					showToolbar(i, G);
				}
			}
		}
		const svgNodes = gn;
		for (const n of paintOrder()) {
			if (n.hidden) {
				continue;
			}
			const alpha = (n.style?.opacity ?? 1) * (layers.find((l) => l.id === n.layer)?.opacity ?? 1);
			const gn = el('g', { 'fill-opacity': alpha, 'stroke-opacity': alpha }, svgNodes);
			const { w, h, lines } = layout(n);
			const selected = selN.has(n.id);

			const r =
				n.kind === 'label' || n.style?.shape === 'rectangle'
					? 0
					: n.style?.shape === 'pill'
						? (h / 2) * view.s
						: 1.4 * PT * view.s;
			if (n.kind === 'icon') {
				drawIcon(gn, n.icon, n.x - w / 2, n.y, w, h);
				el(
					'rect',
					{
						x: px(n.x - w / 2),
						y: py(n.y + h / 2),
						width: w * view.s,
						height: h * view.s,
						fill: 'transparent',
						class: n.locked ? 'locked-node' : 'node',
						...(n.locked ? {} : { 'data-node': n.id }),
					},
					gn,
				);
				if (editing !== n.id) {
					const label = text(gn, n.x + w / 2 + 1, n.y, show(n.title), fontPt(n), 'Sakuga Sans', '#000', 'start');
					label.setAttribute('data-node', n.id);
					label.setAttribute('pointer-events', n.locked ? 'none' : 'auto');
				}
			} else {
				if (n.kind === 'label') {
					el(
						'rect',
						{
							x: px(n.x - w / 2),
							y: py(n.y + h / 2),
							width: w * view.s,
							height: h * view.s,
							fill: 'transparent',
							...(n.locked ? { class: 'locked-node' } : { 'data-node': n.id }),
						},
						gn,
					);
				}
				const box = drawBox(
					n,
					w,
					h,
					{
						x: px(n.x - w / 2),
						y: py(n.y + h / 2),
						width: w * view.s,
						height: h * view.s,
						rx: r,
						ry: r,
						fill: styleColor(n.style?.fill, n.kind === 'label' ? 'none' : fillOf(n.cat)),
						stroke:
							n.style?.border === 'none' || (n.kind === 'label' && !n.style?.border)
								? 'none'
								: styleColor(n.style?.color, STROKE),
						'stroke-dasharray': dash(n.style),
						'stroke-width': weight(n.style),
						...(n.locked ? {} : { 'data-node': n.id }),
						class: n.locked ? 'locked-node' : 'node',
					},
					gn,
				);
				drawDecorations(n, w, h, box, gn);
			}
			if (selected) {
				const m = 1.2;
				el(
					'rect',
					{
						x: px(n.x - w / 2 - m),
						y: py(n.y + h / 2 + m),
						width: (w + 2 * m) * view.s,
						height: (h + 2 * m) * view.s,
						fill: 'none',
						stroke: 'var(--sel)',
						'stroke-width': 1,
						'stroke-dasharray': '3 2',
						'pointer-events': 'none',
					},
					go,
				);
			}
			if (editing !== n.id && n.kind !== 'icon') {
				const pitch = { 8: 9.5, 9: 11, 10: 12, 10.95: 13.6, 12: 14 }[fontPt(n)] * PT,
					codePitch = pitch - PT;
				const total = (lines.length - 1) * pitch + (n.code ? codePitch : 0);
				const pos = n.iconPosition || 'left',
					name = effectiveIcon(n);
				const shiftX = name ? (pos === 'left' ? 2 : pos === 'right' ? -2 : 0) : 0;
				const shiftY = name && !['left', 'right'].includes(pos) ? (['sw', 'se'].includes(pos) ? 2 : -2) : 0;
				if (name) {
					const x = ['right', 'ne', 'se'].includes(pos)
						? n.x + w / 2 - 4
						: pos === 'above'
							? n.x - 1.5
							: n.x - w / 2 + 1;
					const iy = ['above', 'nw', 'ne'].includes(pos)
						? n.y + h / 2 - 2.5
						: ['sw', 'se'].includes(pos)
							? n.y - h / 2 + 2.5
							: n.y;
					drawIcon(gn, name, x, iy);
				}
				const tp = n.titlePosition || 'center';
				const textAnchor = tp.includes('west') ? 'start' : tp.includes('east') ? 'end' : 'middle';
				const tx = n.x + shiftX + (tp.includes('west') ? -n.width / 2 : tp.includes('east') ? n.width / 2 : 0);
				let y =
					(tp.includes('north')
						? n.y + h / 2 - 3.5 * PT - (fontPt(n) * PT) / 2
						: tp.includes('south')
							? n.y - h / 2 + 3.5 * PT + (fontPt(n) * PT) / 2 + total
							: n.y + total / 2) + shiftY;
				for (const l of lines) {
					const titleText = text(
						gn,
						tx + (n.kind === 'label' && n.style?.step ? 2.2 : 0),
						y,
						l,
						fontPt(n),
						'Sakuga Sans',
						styleColor(n.style?.textColor, '#000'),
						textAnchor,
					);
					titleText.style.fontWeight = n.style?.text?.startsWith('bold') ? 'bold' : 'normal';
					titleText.style.fontStyle = n.style?.text?.includes('italic') ? 'italic' : 'normal';
					y -= pitch;
				}
				if (n.code) {
					text(
						gn,
						tx,
						y + pitch - codePitch,
						show(n.code),
						SakugaText.sizes[SakugaText.codeSize(n, figureFont)],
						'Sakuga Mono',
						CODE,
						textAnchor,
					);
				}
			}
			if (!n.locked && selected && selN.size === 1 && selE.size === 0 && editing !== n.id) {
				const hs = 7;
				for (const [dir, fx, fy] of [
					['nw', -1, 1],
					['n', 0, 1],
					['ne', 1, 1],
					['e', 1, 0],
					['se', 1, -1],
					['s', 0, -1],
					['sw', -1, -1],
					['w', -1, 0],
				]) {
					el(
						'rect',
						{
							x: px(n.x + (fx * w) / 2) - hs / 2,
							y: py(n.y + (fy * h) / 2) - hs / 2,
							width: hs,
							height: hs,
							fill: '#fff',
							stroke: 'var(--sel)',
							'stroke-width': 1,
							'data-resize': `${n.id}:${dir}`,
							class: `resize ${dir}`,
						},
						go,
					);
				}
			}
			if (
				isBox(n) &&
				!n.locked &&
				editing !== n.id &&
				((selected && selN.size === 1 && selE.size === 0) || (hover === n.id && !drag))
			) {
				for (const [hx, hy] of [
					[n.x + w / 2 + 4, n.y],
					[n.x - w / 2 - 4, n.y],
					[n.x, n.y + h / 2 + 4],
					[n.x, n.y - h / 2 - 4],
				]) {
					el(
						'circle',
						{
							cx: px(hx),
							cy: py(hy),
							r: 5,
							fill: 'var(--handle)',
							stroke: 'var(--sel)',
							'stroke-width': 1.5,
							'data-handle': n.id,
							class: 'handle',
						},
						go,
					);
				}
			}
		}
		if (selN.size > 1 && [...selN].every((id) => !byId(id).locked && !byId(id).hidden) && !editing) {
			const b = selBox([...selN]),
				m = 2.5,
				hs = 7;
			el(
				'rect',
				{
					x: px(b.x0 - m),
					y: py(b.y1 + m),
					width: (b.x1 - b.x0 + 2 * m) * view.s,
					height: (b.y1 - b.y0 + 2 * m) * view.s,
					fill: 'none',
					stroke: 'var(--sel)',
					'stroke-width': 1,
					'pointer-events': 'none',
				},
				gn,
			);
			const cx = (b.x0 + b.x1) / 2,
				cy = (b.y0 + b.y1) / 2;
			for (const [dir, x, y] of [
				['nw', b.x0 - m, b.y1 + m],
				['n', cx, b.y1 + m],
				['ne', b.x1 + m, b.y1 + m],
				['e', b.x1 + m, cy],
				['se', b.x1 + m, b.y0 - m],
				['s', cx, b.y0 - m],
				['sw', b.x0 - m, b.y0 - m],
				['w', b.x0 - m, cy],
			]) {
				el(
					'rect',
					{
						x: px(x) - hs / 2,
						y: py(y) - hs / 2,
						width: hs,
						height: hs,
						fill: 'var(--sel)',
						stroke: '#fff',
						'stroke-width': 1,
						'data-scale': dir,
						class: `resize ${dir}`,
					},
					gn,
				);
			}
		}
		for (const n of nodes.filter((n) => !n.hidden && n.kind === 'label' && n.style?.step)) {
			const { w } = layout(n);
			const x = n.x - w / 2 + 1.8,
				c = styleColor(n.style?.textColor, '#595959');
			el('circle', { cx: px(x), cy: py(n.y), r: 1.8 * view.s, fill: c }, gn);
			const badge = text(gn, x, n.y, String(n.style.step), 8, 'Sakuga Sans', '#fff');
			badge.style.fontWeight = 'bold';
		}
		for (const n of nodes.filter((n) => !n.hidden && selN.has(n.id))) {
			if (n.attachment && byId(n.attachment.parent)) {
				const p = anchorPoint(byId(n.attachment.parent), n.attachment.anchor),
					o = anchorPoint(n, n.attachment.ownAnchor);
				el(
					'line',
					{
						x1: px(p.x),
						y1: py(p.y),
						x2: px(o.x),
						y2: py(o.y),
						stroke: 'var(--sel)',
						'stroke-width': 1,
						'pointer-events': 'none',
					},
					svg,
				);
				el('circle', { cx: px(p.x), cy: py(p.y), r: 3, fill: 'var(--sel)', 'pointer-events': 'none' }, svg);
			}
		}

		for (const gd of (drag && drag.guides) || []) {
			el(
				'line',
				gd.x !== undefined
					? { x1: px(gd.x), y1: py(gd.a - 3), x2: px(gd.x), y2: py(gd.b + 3), stroke: '#d63384', 'stroke-width': 1 }
					: { x1: px(gd.a - 3), y1: py(gd.y), x2: px(gd.b + 3), y2: py(gd.y), stroke: '#d63384', 'stroke-width': 1 },
				gn,
			);
		}
		renderLegend(gn);
		if (drag && drag.move && drag.copy && (drag.dx || drag.dy)) {
			for (const id of drag.orig.keys()) {
				const n = byId(id);
				const { w, h } = layout(n);
				el(
					'rect',
					{
						x: px(n.x + drag.dx - w / 2),
						y: py(n.y + drag.dy + h / 2),
						width: w * view.s,
						height: h * view.s,
						fill: fillOf(n.cat),
						'fill-opacity': 0.5,
						stroke: 'var(--sel)',
						'stroke-width': 1,
						'pointer-events': 'none',
					},
					gn,
				);
			}
		}
		if (drag && drag.band) {
			const x = Math.min(drag.x0, drag.x1),
				y = Math.max(drag.y0, drag.y1);
			el(
				'rect',
				{
					x: px(x),
					y: py(y),
					width: Math.abs(drag.x1 - drag.x0) * view.s,
					height: Math.abs(drag.y1 - drag.y0) * view.s,
					fill: 'var(--sel)',
					'fill-opacity': 0.08,
					stroke: 'var(--sel)',
					'stroke-width': 1,
					'pointer-events': 'none',
				},
				gn,
			);
		}
		if (drag && (drag.connect || drag.endpoint !== undefined)) {
			const target = endpointTarget({ x: drag.x, y: drag.y });
			const n = target && endpointObject(target.id);
			if (n && !n.frame) {
				const box = { ...n, ...layout(n) };
				for (const side of ['north', 'east', 'south', 'west'])
					for (const f of [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]) {
						const off = (f - 0.5) * (/north|south/.test(side) ? box.w : box.h),
							p = SakugaRoutes.port(box, side, off);
						el(
							'circle',
							{ cx: px(p[0]), cy: py(p[1]), r: 2.5, fill: '#fff', stroke: 'var(--sel)', 'pointer-events': 'none' },
							go,
						);
					}
				if (target.fraction !== undefined)
					text(
						go,
						drag.x + 2,
						drag.y + 3,
						{ 0: '0', 0.25: '1/4', [1 / 3]: '1/3', 0.5: '1/2', [2 / 3]: '2/3', 0.75: '3/4', 1: '1' }[target.fraction],
						8,
						'Sakuga Sans',
						'#555',
					);
			}
		}
		if (drag && drag.connect) {
			const a = byId(drag.connect);
			const target = nodeAt(drag);
			const [x1, y1] = border(a, drag.x, drag.y);
			const [x2, y2] = target && target !== a ? border(target, a.x, a.y) : [drag.x, drag.y];
			arrow(gn, x1, y1, x2, y2, 'arr', { opacity: 0.6 });
		}
		if (drag?.endpoint !== undefined) {
			const n = drag.target && endpointObject(drag.target.id),
				pt =
					n && !n.frame
						? SakugaRoutes.port({ ...n, ...layout(n) }, drag.target.anchor, drag.target.offset)
						: [drag.x, drag.y];
			el(
				'circle',
				{
					cx: px(pt[0]),
					cy: py(pt[1]),
					r: 6,
					fill: 'none',
					stroke: drag.target ? '#43a047' : 'var(--sel)',
					'stroke-width': 2,
				},
				svg,
			);
		}
		if (drag?.target && drag.move) {
			const { parent, anchor } = drag.target,
				{ w, h } = layout(parent);
			ANCHORS.forEach((a, i) => {
				el(
					'rect',
					{
						x: px(parent.x - w / 2 + ((i % 3) * w) / 3),
						y: py(parent.y + h / 2 - (Math.floor(i / 3) * h) / 3),
						width: (w / 3) * view.s,
						height: (h / 3) * view.s,
						fill: a === anchor ? 'var(--sel)' : 'transparent',
						'fill-opacity': 0.16,
						stroke: 'var(--sel)',
						'stroke-width': 0.8,
						'pointer-events': 'none',
					},
					svg,
				);
				const pt = anchorPoint(parent, a);
				el('circle', { cx: px(pt.x), cy: py(pt.y), r: 3, fill: 'var(--sel)', 'pointer-events': 'none' }, svg);
			});
		}

		renderInspector();
		renderLayers();
	}

	// The same legend the TikZ output draws: one swatch per used category, three per column.
	function renderLegend(g) {
		const used = new Set(nodes.map((n) => n.cat));
		const list = cats.filter((c) => used.has(c.key) && c.legend !== false);
		if (!legend || !list.length) {
			return;
		}
		const b = bbox();
		list.forEach((c, i) => {
			const x = b.x0 + Math.floor(i / 3) * 34,
				y = b.y0 - 7 - (i % 3) * 6;
			el(
				'rect',
				{
					x: px(x),
					y: py(y),
					width: 3.6 * view.s,
					height: 3.6 * view.s,
					rx: PT * view.s,
					ry: PT * view.s,
					fill: fillOf(c.key),
					stroke: STROKE,
					'stroke-width': Math.max(0.8, LINE * view.s),
					'pointer-events': 'none',
				},
				g,
			);
			if (c.icon) {
				drawIcon(g, c.icon, x + 4.6, y - 1.8);
			}
			text(
				g,
				x + 4.6 + (c.icon ? 4 : 0),
				y - 1.8,
				show(c.name),
				smallerPt(sizes[figureFont]),
				'Sakuga Sans',
				'#000',
				'start',
			);
		});
	}

	// Inspector: the selection, the categories of this figure, and figure settings.
	const styleFields = (arrow) => [
		...(arrow
			? []
			: [
					['Shape', 'shape', ['', 'rectangle', 'pill', 'ellipse', 'circle', 'diamond', 'cylinder']],
					['Text', 'text', ['', 'bold', 'italic', 'bold-italic']],
					['Font size', 'font', ['', ...Object.keys(sizes)]],
					['Colour', 'fill', ['', ...Object.keys(palette), 'none']],
					['Pattern', 'pattern', ['', 'hatched', 'crosshatch', 'dots', 'horizontal', 'vertical']],
					['Pattern colour', 'patternColor', ['', ...Object.keys(palette)]],
					['Corner mark', 'mark', ['', 'triangle', 'circle']],
					['Corner', 'markCorner', ['', 'nw', 'se', 'sw']],
					['Mark size', 'markSize', ['', 'medium']],
					['Mark colour', 'markColor', ['', ...Object.keys(palette)]],
				]),
		['Line', 'border', ['', 'solid', 'dashed', 'dotted', 'none', ...(arrow ? [] : ['double'])]],
		['Colour', 'color', ['', ...Object.keys(palette)]],
		...(arrow
			? [
					['Line width (pt)', 'lineWidth', null],
					['Tip length (mm)', 'tipLength', null],
					['Tip width (mm)', 'tipWidth', null],
				]
			: [['Width', 'weight', ['', 'medium', 'thick']]]),
		...(arrow
			? [
					['Start', 'start', ['none', 'Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar']],
					['End', 'end', ['Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar', 'none']],
					['Label at', 'position', ['', 'start', 'end']],
					['Label side', 'side', ['', 'above', 'below', 'left', 'right']],
				]
			: []),
	];
	// Small visual choices share one keyboard-accessible button vocabulary.
	function emphasisToggle(key, value, change, inherit = false) {
		const wrap = document.createElement('div');
		wrap.className = 'segments';
		wrap.setAttribute('role', 'group');
		wrap.setAttribute('aria-label', key);
		if (inherit) {
			const reset = document.createElement('button');
			reset.type = 'button';
			reset.textContent = '↶';
			reset.title = 'Inherit';
			reset.setAttribute('aria-label', 'Inherit ' + key);
			reset.setAttribute('aria-pressed', String(value === undefined));
			reset.onclick = () => change(null);
			wrap.append(reset);
		}
		const b = document.createElement('button');
		b.type = 'button';
		b.title = key;
		b.setAttribute('aria-label', key);
		b.setAttribute('aria-pressed', String(!!value));
		b.innerHTML = choiceGlyph(key, key);
		b.onclick = () => change(!value);
		wrap.append(b);
		return wrap;
	}
	function titlePositionPicker(options, value, change) {
		const wrap = document.createElement('div');
		wrap.className = 'title-position';
		wrap.setAttribute('role', 'group');
		wrap.setAttribute('aria-label', 'Title position');
		const slots = [
			'above-left',
			'above-center',
			null,
			null,
			null,
			null,
			'inside-top-left',
			null,
			'inside-top-right',
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			'below-left',
			null,
			null,
			null,
			null,
		];
		const allowed = new Map(options);
		for (const v of slots) {
			const b = document.createElement('button');
			b.type = 'button';
			b.textContent = '·';
			b.disabled = !v || !allowed.has(v);
			b.title = v ? allowed.get(v) || v : 'Position unavailable';
			b.setAttribute('aria-label', b.title);
			b.setAttribute('aria-pressed', String(v === value));
			if (v) b.onclick = () => change(v);
			wrap.append(b);
		}
		if (allowed.has('legacy')) {
			const b = document.createElement('button');
			b.textContent = 'Original';
			b.className = 'legacy-position';
			b.title = 'Original placement';
			b.onclick = () => change('legacy');
			wrap.append(b);
		}
		return wrap;
	}
	function segmented(options, value, change) {
		const wrap = document.createElement('div');
		wrap.className = 'segments';
		wrap.value = value;
		wrap.setAttribute('role', 'group');
		if (value === '*') {
			const mixed = document.createElement('span');
			mixed.textContent = 'Mixed';
			mixed.className = 'mixed';
			wrap.append(mixed);
		}
		for (const [v, name, tip, text] of options) {
			if (v === '*') continue;
			const b = document.createElement('button');
			b.type = 'button';
			b.title = tip || name;
			b.setAttribute('aria-label', tip || name);
			b.setAttribute('aria-pressed', String(v === value));
			b.innerHTML = text !== undefined ? `<span>${text}</span>` : choiceGlyph(v, name);
			b.onclick = () => change(v);
			wrap.append(b);
		}
		return wrap;
	}

	function choiceGlyph(v, name) {
		const lineWeights = { Thin: 1, Medium: 2, Thick: 3.4 };
		if (lineWeights[name])
			return `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="${lineWeights[name]}" stroke-linecap="round" aria-hidden="true"><path d="M2 8h12"/></svg>`;
		const paths = {
			rectangle: 'M2 4h12v8H2z',
			pill: 'M6 4h4a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8z',
			ellipse: 'M8 4a6 4 0 1 1 0 8a6 4 0 1 1 0-8',
			circle: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12',
			diamond: 'M8 2l6 6-6 6-6-6z',
			cylinder: 'M2 5c0-4 12-4 12 0v6c0 4-12 4-12 0z M2 5c0 4 12 4 12 0',
			straight: 'M2 12L14 4',
			end: 'M2 8h12M10 4l4 4-4 4',
			both: 'M2 8h12M6 4L2 8l4 4M10 4l4 4-4 4',
			manhattan: 'M2 12h6V4h6',
			curved: 'M2 12C12 12 4 4 14 4',
			hatched: 'M3 13L13 3M3 8L8 3M8 13L13 8',
			crosshatch: 'M3 13L13 3M3 8L8 3M8 13L13 8M3 3L13 13M3 8L8 13M8 3L13 8',
			dots: 'M4 4h.1M8 4h.1M12 4h.1M4 8h.1M8 8h.1M12 8h.1M4 12h.1M8 12h.1M12 12h.1',
			horizontal: 'M2 4h12M2 8h12M2 12h12',
			vertical: 'M4 2v12M8 2v12M12 2v12',
			u: 'M2 4v8h12V4',
			auto: 'M2 12h6V4h6 M2 3h3 M3.5 1.5v3',
			none: 'M3 13L13 3',
			solid: 'M2 8h12',
			dashed: 'M2 8h3m3 0h3m2 0h1',
			dotted: 'M2 8h.1m3 0h.1m3 0h.1m3 0h.1',
			double: 'M2 6h12M2 10h12',
			Latex: 'M2 8h12M10 4l4 4-4 4',
			Stealth: 'M2 8h12M9 3l5 5-5 5 2-5z',
			triangle: 'M3 12L8 3l5 9z',
			barb: 'M2 8h12M10 4l4 4-4 4',
			bar: 'M2 8h10M12 3v10',
			bold: 'M5 2h4a3 3 0 0 1 0 6H5V2z M5 8h5a3 3 0 0 1 0 6H5V8z',
			italic: 'M7 2h6M3 14h6M10 2L6 14',
			'bold-italic': 'M5 2h4a3 3 0 0 1 0 6H5V2z M5 8h5a3 3 0 0 1 0 6H5V8z M14 3l-2 10',
			above: 'M2 11h12M5 7l3-4 3 4',
			below: 'M2 5h12M5 9l3 4 3-4',
			left: 'M11 2v12M7 5L3 8l4 3',
			right: 'M5 2v12M9 5l4 3-4 3',
		};
		const path = paths[v];
		if (path)
			return `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
		if (!v && /outline/i.test(name)) return choiceGlyph('solid', 'Solid');
		if (!v && name === 'Normal') return '<span>N</span>';
		if (!v && name === 'None') return choiceGlyph('none', 'None');
		if (!v)
			return '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="2" y="4" width="12" height="8" rx="2"/></svg>';
		return `<span>${String(name).replace(/[&<>"']/g, '')}</span>`;
	}
	// Outline width: thin / medium / thick, and a number only on demand.
	function weightControl(objects, change) {
		const first = objects[0].style || {},
			key = (o) => `${o.style?.weight || ''}|${o.style?.lineWidth ?? ''}`;
		const same = objects.every((o) => key(o) === key(objects[0])),
			custom = objects.some((o) => o.style?.lineWidth !== undefined);
		const wrap = document.createElement('div');
		wrap.className = 'width-control';
		wrap.append(
			segmented(
				[
					['', 'Thin'],
					['medium', 'Medium'],
					['thick', 'Thick'],
				],
				same ? (custom ? '#' : first.weight || '') : '*',
				(v) => change({ weight: v }),
			),
		);
		const number = numberControl(
			first.lineWidth ?? ({ medium: 0.8, thick: 1.2 }[first.weight] || 0.45),
			(v) => change({ lineWidth: v ?? 0.45 }),
			{ min: 0.05 },
		);
		number.hidden = !custom;
		number.setAttribute('aria-label', 'Line width (pt)');
		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'custom-toggle';
		toggle.textContent = 'custom';
		toggle.title = 'Enter a line width in pt';
		toggle.setAttribute('aria-pressed', String(custom));
		toggle.onclick = () => {
			number.hidden = !number.hidden;
			toggle.setAttribute('aria-pressed', String(!number.hidden));
			if (!number.hidden) number.focus();
		};
		wrap.append(toggle, number);
		return wrap;
	}
	function styleSelect(prop, values, objects, change) {
		if (values === null) {
			const mixed = objects.some((o) => o.style?.[prop] !== objects[0].style?.[prop]);
			const defaults = { lineWidth: 0.45, tipLength: 1.5, tipWidth: 1.2 };
			return numberControl(
				mixed
					? null
					: (objects[0].style?.[prop] ??
							(prop === 'lineWidth' ? { medium: 0.8, thick: 1.2 }[objects[0].style?.weight] || 0.45 : defaults[prop])),
				(v) => change({ [prop]: v ?? defaults[prop] }),
				{ min: 0.05, placeholder: mixed ? 'Mixed' : '' },
			);
		}
		const select = document.createElement('select');
		select.setAttribute('aria-label', prop);
		const get = (o) =>
			o.style?.[prop] ||
			(prop === 'start'
				? o.head === 'both'
					? 'Latex'
					: 'none'
				: prop === 'end'
					? o.head === 'none'
						? 'none'
						: 'Latex'
					: prop === 'border' && o.kind === 'arr-dashed'
						? 'dashed'
						: '');
		const value = objects.every((o) => get(o) === get(objects[0])) ? get(objects[0]) : '*';
		if (['fill', 'color', 'patternColor', 'markColor'].includes(prop)) {
			return styleColour(prop, value, change);
		}
		if (prop === 'text') {
			const wrap = document.createElement('div');
			wrap.className = 'segments';
			wrap.value = value;
			wrap.setAttribute('role', 'group');
			wrap.setAttribute('aria-label', 'Text emphasis');
			for (const key of ['bold', 'italic']) {
				const b = document.createElement('button');
				b.type = 'button';
				b.title = key;
				b.setAttribute('aria-label', key);
				b.setAttribute('aria-pressed', value === '*' ? 'mixed' : String(value.includes(key)));
				b.innerHTML = choiceGlyph(key, key);
				b.onclick = () => {
					const bold = key === 'bold' ? !value.includes('bold') : value.includes('bold'),
						italic = key === 'italic' ? !value.includes('italic') : value.includes('italic');
					change({ text: bold && italic ? 'bold-italic' : bold ? 'bold' : italic ? 'italic' : '' });
				};
				wrap.append(b);
			}
			return wrap;
		}
		if (prop === 'font')
			return sizeSegments(
				values.map((v) => [v, v || 'Figure font size']),
				value,
				(v) => change({ font: v }),
			);
		if (prop === 'markSize')
			return segmented(
				[
					['', 'Small (2.4 mm)', undefined, 'S'],
					['medium', 'Medium (5 mm)', undefined, 'M'],
				],
				value,
				(v) => change({ markSize: v }),
			);
		if (prop === 'weight') return weightControl(objects, change);
		if (['shape', 'border', 'text', 'start', 'end', 'side', 'position', 'mark', 'markCorner', 'pattern'].includes(prop))
			return segmented(
				values.map((v) => [
					v,
					{ nw: 'Top left', ne: 'Top right', sw: 'Bottom left', se: 'Bottom right' }[v] ||
						v ||
						{
							shape: 'Rounded rectangle',
							border: 'Default outline',
							text: 'Normal',
							position: 'Middle',
							side: 'On the line',
							mark: 'None',
							pattern: 'None',
						}[prop] ||
						'Default',
				]),
				value,
				(v) => change({ [prop]: v }),
			);
		for (const v of value === '*' ? ['*', ...values] : values) {
			select.add(
				new Option(
					v === '*'
						? '(mixed)'
						: {
								nw: 'top left',
								se: 'bottom right',
								sw: 'bottom left',
								medium: prop === 'markSize' ? 'medium (5 mm)' : 'medium',
							}[v] ||
								v ||
								{
									shape: 'rounded rectangle',
									fill: 'category',
									border: 'solid',
									color: 'grey',
									weight: 'thin',
									text: 'normal',
									font: 'figure',
									position: 'middle',
									side: 'on the line',
									pattern: 'none',
									mark: 'none',
									markCorner: 'top right',
									markSize: 'small (2.4 mm)',
								}[prop] ||
								'default',
					v,
				),
			);
		}
		select.value = value;
		select.onchange = () => {
			if (select.value !== '*') {
				if (prop === 'mark') {
					select.blur();
				}
				change({ [prop]: select.value });
			}
		};
		return select;
	}
	function styleColour(prop, value, change) {
		const wrap = document.createElement('div');
		wrap.className = 'style-colour';
		const defaults = {
			fill: 'style / white',
			color: 'grey',
			patternColor: 'black 25%',
			markColor: '#33333A',
			textColor: 'black',
		};
		const options = [
			{ value: '', label: defaults[prop] },
			...Object.keys(palette).map((k) => ({ value: k, label: k, color: styleColor(k, '#fff') })),
			...(prop === 'fill' ? [{ value: 'none', label: 'none' }] : []),
			...recentColors.map((k) => ({ value: k, label: k, color: k })),
		];
		if (value === '*') {
			options.unshift({ value: '*', label: '(mixed)' });
		} else if (value && !options.some((o) => o.value === value)) {
			options.push({ value, label: value, color: styleColor(value, '#fff') });
		}
		const apply = (v) => {
			if (v !== '*') {
				change({ [prop]: v });
			}
		};
		const picker = document.createElement('input');
		picker.type = 'color';
		picker.setAttribute('aria-label', `${prop} custom colour`);
		picker.value = /^#[0-9a-f]{6}$/i.test(value) ? value : prop === 'markColor' ? '#33333a' : '#000000';
		const hex = document.createElement('input');
		hex.type = 'text';
		hex.placeholder = '#RRGGBB';
		hex.setAttribute('aria-label', `${prop} hex colour`);
		hex.value = /^#[0-9a-f]{6}$/i.test(value) ? value : '';
		hex.maxLength = 7;
		const custom = (raw) => {
			const v = (raw.startsWith('#') ? raw : '#' + raw).toUpperCase();
			if (!/^#[0-9A-F]{6}$/.test(v)) {
				hex.setCustomValidity('Enter a six-digit hex colour');
				hex.reportValidity();
				return;
			}
			hex.setCustomValidity('');
			hex.value = v;
			picker.value = v;
			recentColors = [v, ...recentColors.filter((c) => c !== v)].slice(0, 8);
			saveState();
			apply(v);
		};
		picker.onchange = () => custom(picker.value);
		hex.oninput = () => hex.setCustomValidity('');
		hex.onchange = () => custom(hex.value);
		const swatches = document.createElement('div');
		swatches.className = 'colour-swatches';
		swatches.value = value;
		swatches.options = options;
		swatches.onSelect = apply;
		swatches.setAttribute('role', 'group');
		swatches.setAttribute('aria-label', prop + ' colours');
		for (const option of options) {
			if (option.value === '*') continue;
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'colour-swatch' + (option.value === 'none' ? ' no-colour' : '');
			b.title = option.label;
			b.setAttribute('aria-label', option.label);
			b.setAttribute('aria-pressed', String(option.value === value));
			b.style.setProperty(
				'--swatch',
				option.color ||
					(prop === 'fill' ? (typeof selN === 'undefined' ? '#ffffff' : fillOf(byId([...selN][0])?.cat)) : '#9e9e9e'),
			);
			b.onclick = () => apply(option.value);
			swatches.append(b);
		}
		const customButton = document.createElement('button');
		customButton.type = 'button';
		customButton.className = 'colour-swatch custom-colour';
		customButton.textContent = '+';
		customButton.title = 'Custom hex colour';
		customButton.setAttribute('aria-label', 'Custom hex colour');
		customButton.onclick = () => {
			hex.hidden = !hex.hidden;
			if (!hex.hidden) hex.focus();
		};
		swatches.append(customButton);
		if (value === '*') {
			const mixed = document.createElement('span');
			mixed.textContent = 'Mixed';
			mixed.className = 'mixed';
			swatches.append(mixed);
		}
		hex.hidden = true;
		picker.hidden = true;
		wrap.append(swatches, picker, hex);
		return wrap;
	}

	// ---- Named styles: a style acts on its objects; an object only keeps what differs from it ----
	const SIZE_LABEL = { tiny: '6', scriptsize: '8', footnotesize: '9', small: '10', normalsize: '11', large: '12' };
	// Font sizes as one row of buttons labelled with the point size.
	function sizeSegments(options, value, change) {
		return segmented(
			options.map(([v, label]) =>
				v === '*'
					? [v, label]
					: [v, label, v ? `${label} (${SIZE_LABEL[v] || '?'} pt)` : label, v ? SIZE_LABEL[v] || v : 'Auto'],
			),
			value,
			change,
		);
	}
	const KIND_NAMES = { box: 'Box', arrow: 'Arrow', frame: 'Frame', label: 'Label' };
	const STYLE_KEYS = ['fill', 'color', 'border', 'weight', 'lineWidth', 'shape', 'font', 'text', 'textColor'];
	const ROW_OF = { lineWidth: 'weight' };
	const styleDef = (key) => styles.find((s) => s.key === key);
	const nodeStyleKind = (n) => (n.kind === 'label' ? 'label' : n.kind ? '' : 'box');
	const styleUsers = (def) =>
		def.kind === 'arrow'
			? edges.filter((e) => e.styleKey === def.key).length
			: nodes.filter((n) => n.cat === def.key && nodeStyleKind(n) === def.kind).length;
	const styleSwatch = (def) =>
		def.kind === 'box'
			? styleColor(def.props.fill, '#ffffff')
			: def.kind === 'arrow'
				? styleColor(def.props.color, ARROW)
				: def.kind === 'label'
					? styleColor(def.props.textColor, '#444444')
					: styleColor(def.props.color, '#bbbbbb');
	const dismissedHints = () => new Set((vscode.getState() || {}).dismissedHints || []);
	function styleChoice(kind, value, onChange) {
		const options = [
			{ value: '', label: 'Plain', color: '#ffffff' },
			...styles
				.filter((s) => s.kind === kind)
				.map((s) => ({ value: s.key, label: show(s.name), color: styleSwatch(s), icon: s.icon })),
		];
		if (value === '*') {
			options.unshift({ value: '*', label: '(mixed)' });
		}
		const b = visualChoice(options, value, onChange);
		b.setAttribute('aria-label', 'Style');
		return b;
	}
	function nextStyleName(kind) {
		let i = styles.filter((s) => s.kind === kind).length + 1;
		while (styles.some((s) => s.name === `${KIND_NAMES[kind]} style ${i}`)) {
			i++;
		}
		return `${KIND_NAMES[kind]} style ${i}`;
	}
	// A new style takes its look from an object (or is empty), then opens in the Styles list for naming.
	function addStyle(kind, from, assign) {
		const name = nextStyleName(kind),
			props = {};
		if (!from) {
			if (kind === 'box') {
				props.fill = Object.keys(palette).filter((k) => k !== 'white' && !cats.some((c) => c.color === k))[0] || 'grey';
			}
			if (kind === 'frame') {
				props.frame = 'dashed';
				props.color = 'grey';
			}
		}
		const colour = from ? byId(from.id)?.style?.fill : props.fill;
		pendingStyleFocus = name;
		post({
			op: 'styleAdd',
			kind,
			name,
			props,
			from,
			assign,
			legend: kind === 'box' && !!colour && colour !== 'white' && colour !== 'none',
		});
	}
	function markOverride(r, ids, indices, props) {
		r.classList.add('overridden');
		const reset = document.createElement('button');
		reset.type = 'button';
		reset.className = 'reset-prop';
		reset.textContent = 'reset';
		reset.title = 'Back to the style';
		reset.onclick = () => post({ op: 'resetStyle', ...(ids ? { ids } : { indices }), keys: props });
		r.append(reset);
	}
	const isOverride = (o, prop) =>
		(o.overrides || []).includes(prop) || (prop === 'weight' && (o.overrides || []).includes('lineWidth'));
	function renderInspector() {
		if (tidyPreview) return;
		renderInspectorRaw();
	}
	function renderInspectorRaw() {
		if (floating && inspector.contains(floating.anchor)) {
			return;
		}
		if (inspector.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') {
			return;
		}
		inspector.replaceChildren();
		const makePane = (id) => {
			const p = document.createElement('div');
			p.id = id;
			p.className = 'tabpane';
			p.setAttribute('role', 'tabpanel');
			inspector.append(p);
			return p;
		};
		const selection = makePane('pane-selection'),
			figure = makePane('pane-figure');
		const sections = new Map();
		let figureMode = false,
			current = 'Text';
		const getSection = (title, parent = selection) => {
			const key = (parent === selection ? 'selection.' : 'figure.') + title;
			if (sections.has(key)) return sections.get(key);
			const d = document.createElement('details'),
				h = document.createElement('summary'),
				body = document.createElement('div');
			d.className = 'inspector-section';
			h.textContent = title;
			body.className = 'section-body';
			d.open = (vscode.getState()?.sections || {})[key] ?? !['Shape & decoration', 'Arrange'].includes(title);
			d.ontoggle = () => persist({ sections: { ...vscode.getState()?.sections, [key]: d.open } });
			d.append(h, body);
			parent.append(d);
			sections.set(key, body);
			return body;
		};
		for (const title of ['Style', 'Text', 'Fill', 'Outline', 'Route & tips', 'Shape & decoration', 'Arrange'])
			getSection(title);
		for (const title of ['Text', 'Arrows', 'Legend', 'Grid', 'Styles']) getSection(title, figure);
		const section = (title) => {
			if (title === 'Styles' || title === 'Figure') {
				figureMode = true;
				current = title === 'Figure' ? 'Text' : title;
				return;
			}
			current = ['Style', 'Fill', 'Outline'].includes(title) ? title : 'Text';
		};
		const row = (name, ...controls) => {
			const r = document.createElement('div');
			r.className = 'row';
			const label = document.createElement('span');
			label.textContent = name;
			r.append(label, ...controls);
			const suffix = / \((pt|mm|%)\)$/.exec(name);
			if (suffix) {
				label.textContent = name.slice(0, -suffix[0].length);
				r.append(unit(suffix[1]));
			}
			let target = current;
			if (figureMode) {
				target =
					current === 'Styles'
						? current
						: { 'Font size': 'Text', Arrows: 'Arrows', Legend: 'Legend', Grid: 'Grid' }[name] || current;
			} else {
				if (
					[
						'Code size',
						'Title',
						'Code',
						'Label',
						'Name',
						'Text',
						'Font size',
						'Title size',
						'Bold title',
						'bold',
						'italic',
						'Knock-out',
						'Text colour',
						'Title colour',
						'Title at',
						'Title position',
					].includes(name)
				)
					target = 'Text';
				else if (
					[
						'Icon',
						'Icons',
						'Style icon',
						'Pattern',
						'Pattern colour',
						'Corner mark',
						'Corner',
						'Mark size',
						'Mark colour',
						'Shape',
					].includes(name) ||
					(name === 'Position' && controls[0]?.className === 'segments')
				)
					target = 'Shape & decoration';
				else if (name === 'Style') target = 'Style';
				else if (name === 'Thin frame') target = 'Outline';
				else if (
					[
						'X',
						'Y',
						'Width',
						'Height',
						'Padding',
						'Strength',
						'Opacity',
						'Move to layer',
						'Attached to',
						'Parent anchor',
						'Own anchor',
						'Offset X',
						'Offset Y',
						'From',
						'To',
						'Start side',
						'End side',
						'Lane',
						'Step',
					].includes(name)
				)
					target = name === 'Strength' ? 'Fill' : 'Arrange';
				else if (['Route', 'Heads', 'Start', 'End'].includes(name)) target = 'Route & tips';
				else if (['Label at', 'Label side', 'Side'].includes(name)) target = 'Shape & decoration';
			}
			target = controls[0]?._inspectorSection || target;
			getSection(target, figureMode ? figure : selection).append(r);
			for (const c of controls) {
				if (c.tagName === 'INPUT' || c.tagName === 'SELECT')
					c.setAttribute('aria-label', c.getAttribute('aria-label') || name);
			}
			const num = controls.find((c) => c.type === 'number');
			if (num) {
				label.classList.add('scrub');
				label.title = 'Drag to adjust ' + name;
				label.onpointerdown = (ev) => {
					if (ev.button !== 0) return;
					ev.preventDefault();
					label.setPointerCapture(ev.pointerId);
					const x = ev.clientX,
						initial = +num.value || 0,
						step = +(num.step === 'any' ? 1 : num.step) || 1;
					const move = (e) => {
						const v = initial + Math.round((e.clientX - x) / 4) * step;
						num.value = String(
							Math.max(
								num.min === '' ? -Infinity : +num.min,
								Math.min(num.max === '' ? Infinity : +num.max, +v.toFixed(3)),
							),
						);
					};
					const end = () => {
						label.removeEventListener('pointermove', move);
						label.removeEventListener('pointerup', end);
						label.removeEventListener('pointercancel', end);
						num.dispatchEvent(new Event('change', { bubbles: true }));
					};
					label.addEventListener('pointermove', move);
					label.addEventListener('pointerup', end);
					label.addEventListener('pointercancel', end);
				};
			}
			return r;
		};
		const field = (value, onChange, opts = {}) => {
			const i = document.createElement('input');
			i.type = opts.type || 'text';
			i.value = value;
			if (opts.mono) {
				i.className = 'mono';
			}
			i.addEventListener('change', () => {
				if (i.type === 'number' && (i.value === '' || !Number.isFinite(+i.value))) return;
				onChange(i.value);
			});
			return i;
		};
		const choice = (options, value, onChange) => {
			if (options.some(([v]) => v === 'inside-top-left')) return titlePositionPicker(options, value, onChange);
			if (options.some(([v]) => SIZE_LABEL[v])) return sizeSegments(options, value, onChange);
			if (
				options.length <= 7 &&
				options.every(([v]) => !Object.keys(sizes).includes(v)) &&
				!options.some(([v]) => nodes.some((n) => n.id === v) || layers.some((l) => l.id === v))
			)
				return segmented(options, value, onChange);
			const select = document.createElement('select');
			for (const [v, label] of options) select.add(new Option(label, v));
			select.value = value;
			select.onchange = () => onChange(select.value);
			return select;
		};

		// Style picker on top, the "+N" of overrides, and the three exits from them.
		const styleHeader = (ids) => {
			const objs = ids.map(byId),
				kind = nodeStyleKind(objs[0]);
			const same = objs.every((o) => o.cat === objs[0].cat) ? objs[0].cat : '*';
			const keys = (o) => [...new Set((o.overrides || []).map((k) => ROW_OF[k] || k))];
			const nOver = same === '*' ? 0 : Math.max(...objs.map((o) => keys(o).length));
			const picker = styleChoice(kind, same, (v) => {
				if (v !== '*') {
					if (kind === 'box') {
						lastCat = v;
					}
					post({ op: 'batch', ops: ids.map((id) => ({ op: 'node', id, cat: v })) });
				}
			});
			const r = row('Style', picker);
			if (nOver) {
				const c = document.createElement('span');
				c.className = 'override-count';
				c.textContent = `+${nOver}`;
				c.title = `${nOver} propert${nOver === 1 ? 'y differs' : 'ies differ'} from the style`;
				r.append(c);
			}
			const plainProps =
				same === '' && objs.some((o) => STYLE_KEYS.some((k) => o.style?.[k] !== undefined && o.style[k] !== ''));
			const def = styleDef(same);
			if (nOver || plainProps) {
				const wrap = document.createElement('div');
				wrap.className = 'buttons style-actions';
				const button = (text, title, fn) => {
					const b = document.createElement('button');
					b.type = 'button';
					b.textContent = text;
					b.title = title;
					b.onclick = fn;
					wrap.append(b);
					return b;
				};
				if (nOver) {
					button('Reset to style', 'Remove the overrides of this object', () => post({ op: 'resetStyle', ids }));
				}
				if (nOver && ids.length === 1 && def) {
					const others = styleUsers(def) - 1;
					button(
						'Update style from this object',
						others > 0
							? `The style "${show(def.name)}" takes this look; ${others} other ${others === 1 ? 'object changes' : 'objects change'}`
							: 'The style takes this look',
						() => post({ op: 'styleUpdate', key: def.key, id: ids[0] }),
					);
					if (others > 0) {
						const note = document.createElement('p');
						note.className = 'style-note';
						note.textContent = `Changes ${others} other ${kind === 'label' ? 'label' : 'box'}${others === 1 ? '' : 'es'}.`;
						wrap.append(note);
					}
				}
				if (ids.length === 1) {
					button('New style from this object', 'Make a new style with this look', () => addStyle(kind, { id: ids[0] }));
				}
				getSection('Style').append(wrap);
			}
			const dismissed = dismissedHints();
			const hint =
				kind === 'box'
					? shared.find((g) => !dismissed.has(JSON.stringify([g.cat, g.props])) && ids.some((id) => g.ids.includes(id)))
					: null;
			if (hint) {
				const box = document.createElement('div');
				box.className = 'style-hint';
				const text = document.createElement('span');
				text.textContent = `${hint.ids.length} boxes share the same overrides: make a style?`;
				const actions = document.createElement('div');
				actions.className = 'buttons';
				const make = document.createElement('button');
				make.type = 'button';
				make.textContent = 'Make style';
				make.onclick = () => addStyle('box', { id: hint.ids[0] }, { ids: hint.ids });
				const no = document.createElement('button');
				no.type = 'button';
				no.textContent = 'Dismiss';
				no.onclick = () => {
					persist({ dismissedHints: [...dismissed, JSON.stringify([hint.cat, hint.props])] });
					renderInspectorRaw();
				};
				actions.append(make, no);
				box.append(text, actions);
				getSection('Style').append(box);
			}
		};
		if (selN.size >= 2) {
			sketchControls(getSection('Arrange'));
		}
		if (!selE.size || selN.size) tidyControl(getSection('Arrange'));
		const count = selN.size + selE.size;
		const n = count === 1 && selN.size ? byId([...selN][0]) : null;
		const ei = count === 1 && selE.size ? [...selE][0] : -1;
		const e = ei >= 0 ? edges[ei] : null;
		const group = groupById(selG);
		const layer = selectedLayers.size ? layers.find((l) => l.id === activeLayer) : null;
		const attached = selN.label ? labelTarget() : null;
		if (attached) {
			section(attached.g ? 'Frame title' : 'Arrow label');
			const st = attached.style;
			row(
				'Text',
				field(show(attached.text), (v) => post({ op: 'label', ...selN.label, text: tex(v) })),
			);
			row(
				'Font size',
				choice([['', 'Inherit'], ...Object.keys(sizes).map((v) => [v, v])], st.font || '', (font) =>
					labelChange({ font }),
				),
			);
			for (const key of ['bold', 'italic', 'background'])
				row(
					key === 'background' ? 'Knock-out' : key,
					emphasisToggle(key, st[key], (v) => labelChange({ [key]: v }), true),
				);
			row(
				'Colour',
				styleColour('textColor', st.color || '', (v) => labelChange({ color: v.textColor })),
			);
			if (attached.e) {
				row(
					'Position',
					numberControl(st.pos ?? 0.5, (pos) => labelChange({ pos: Math.max(0, Math.min(1, pos ?? 0.5)) }), {
						step: 0.05,
					}),
				);
				row(
					'Side',
					choice(
						['', 'above', 'below', 'left', 'right'].map((v) => [v, v || 'Inherit']),
						st.side || '',
						(side) => labelChange({ side }),
					),
				);
			} else
				row(
					'Title at',
					choice(
						['above-left', 'above-center', 'inside-top-left', 'inside-top-right', 'below-left'].map((v) => [v, v]),
						attached.g.titlePosition || 'above-left',
						(titlePosition) => post({ op: 'groupProps', id: attached.g.id, titlePosition }),
					),
				);
			for (const k of ['dx', 'dy'])
				row(
					k === 'dx' ? 'Offset X' : 'Offset Y',
					field(st[k] || 0, (v) => labelChange({ [k]: +v }), { type: 'number' }),
					unit('mm'),
				);
			const reset = document.createElement('button');
			reset.textContent = 'Reset position';
			reset.onclick = () => labelChange({ pos: 0.5, segment: null, dx: 0, dy: 0, side: '' });
			row('', reset);
			const detach = document.createElement('button');
			detach.textContent = 'Detach';
			detach.onclick = () => {
				const G = attached.g
						? frameTitleGeom(attached.g)
						: arrowLabelGeom(attached.e, st, attached.text, attached.step),
					x = G.p[0],
					y = G.p[1],
					w = attached.g ? textMm(show(attached.text), G.pt, 'Sakuga Sans') : G.w;
				post({
					op: 'detachLabel',
					...selN.label,
					id: newId(),
					x: x + (G.align === 'start' ? w / 2 : G.align === 'end' ? -w / 2 : 0),
					y,
					width: Math.max(1, attached.g ? w : w - 2 * PT),
				});
				delete selN.label;
			};
			row('', detach);
			const copy = document.createElement('button');
			copy.textContent = 'Copy style';
			copy.onclick = copyStyle;
			const paste = document.createElement('button');
			paste.textContent = 'Paste style';
			paste.onclick = pasteStyle;
			row('', copy, paste);
		} else if (layer) {
			section('Layer');
			row(
				'Name',
				field(layer.name, (name) => post({ op: 'layerProps', id: layer.id, name })),
			);
		} else if (group) {
			section('Group');
			row(
				'Name',
				field(group.name, (name) => post({ op: 'groupProps', id: group.id, name })),
			);
			const prop = (values) => post({ op: 'groupProps', id: group.id, ...values });
			row(
				'Padding',
				numberControl(
					group.padding || (group.frame === 'dashed' ? 2.8 : group.frame === 'dotted' ? 1.8 : 3),
					(v) => prop({ padding: v || 0 }),
					{ step: 0.5 },
				),
				unit('mm'),
			);
			section('Fill');
			row(
				'Fill',
				choice(
					[
						['none', 'None'],
						['tint', 'Tint'],
					],
					group.fill || (group.frame === 'region' ? 'tint' : 'none'),
					(fill) => prop({ fill }),
				),
			);
			row(
				'Colour',
				styleColour('color', group.color, (v) => prop({ color: v.color || 'grey' })),
			);
			row(
				'Strength',
				numberControl(group.fillStrength ?? 30, (v) => prop({ fillStrength: Math.min(100, v ?? 30) }), { step: 5 }),
				unit('%'),
			);
			section('Outline');
			row(
				'Line',
				choice(
					['none', 'solid', 'dashed', 'dotted'].map((v) => [v, v]),
					group.outline || (['region', 'none'].includes(group.frame) ? 'none' : group.frame),
					(outline) => prop({ outline, frame: group.frame === 'none' ? 'solid' : group.frame }),
				),
			);
			row(
				'Colour',
				styleColour('color', group.frameColor || '', (v) => prop({ frameColor: v.color })),
			);
			row(
				'Line width',
				numberControl(group.lineWidth || (group.frame === 'dotted' ? 1.5 : 0.7), (v) => prop({ lineWidth: v || 0 }), {
					min: 0.05,
				}),
				unit('pt'),
			);
			row(
				'Title at',
				choice(
					[
						['above-left', 'Above left'],
						['above-center', 'Above centre'],
						['inside-top-left', 'Inside top left'],
						['inside-top-right', 'Inside top right'],
						['below-left', 'Below left'],
						['legacy', 'Original placement'],
					],
					group.titlePosition || 'legacy',
					(titlePosition) => prop({ titlePosition }),
				),
			);
			row(
				'Bold title',
				emphasisToggle('bold', !!group.titleBold, (titleBold) => prop({ titleBold })),
			);
			row(
				'Title size',
				choice(
					Object.keys(sizes).map((v) => [v, v]),
					group.titleFont || 'scriptsize',
					(titleFont) => prop({ titleFont }),
				),
			);
			row(
				'Title colour',
				styleColour('textColor', group.titleColor || '', (v) => prop({ titleColor: v.textColor })),
			);
		} else if (n) {
			section(n.kind === 'icon' ? 'Free icon' : n.kind === 'label' ? 'Label' : 'Box');
			if (n.kind !== 'icon') {
				styleHeader([n.id]);
			}
			if (n.kind === 'icon') {
				row(
					'Font size',
					choice([['', 'Figure'], ...Object.keys(sizes).map((v) => [v, v])], n.style?.font || '', (font) =>
						post({ op: 'style', ids: [n.id], style: { font } }),
					),
				);
				row(
					'Text',
					styleSelect('text', ['', 'bold', 'italic', 'bold-italic'], [n], (style) =>
						post({ op: 'style', ids: [n.id], style }),
					),
				);
			}
			if (n.kind !== 'label') {
				row(
					'Icon',
					iconPicker(effectiveIcon(n), (icon) =>
						post({ op: 'node', id: n.id, icon: icon || (n.kind === 'icon' ? '' : 'none') }),
					),
				);
			}
			if (isBox(n)) {
				row(
					'Position',
					choice(
						[
							['left', 'Left of title'],
							['above', 'Above title'],
							['right', 'Right of title'],
							['nw', 'Top left'],
							['ne', 'Top right'],
							['sw', 'Bottom left'],
							['se', 'Bottom right'],
						],
						n.iconPosition || 'left',
						(iconPosition) => post({ op: 'node', id: n.id, iconPosition }),
					),
				);
				const inherit = document.createElement('input');
				inherit.type = 'checkbox';
				inherit.setAttribute('aria-label', 'Use style icon in this box');
				inherit.checked = n.icon === 'category' || (!n.icon && catOf(n.cat)?.boxes);
				inherit.onchange = () => post({ op: 'node', id: n.id, icon: inherit.checked ? 'category' : 'none' });
				row('Style icon', inherit);
			}
			row(
				n.kind === 'icon' ? 'Label' : 'Title',
				field(show(n.title.split('\\\\').join(' / ')), (v) =>
					post({ op: 'node', id: n.id, title: v.split(' / ').map(tex).join('\\\\') }),
				),
			);
			if (isBox(n)) {
				row(
					'Code',
					field(show(n.code), (v) => post({ op: 'node', id: n.id, code: tex(v) }), { mono: true }),
				);
			}

			if (isBox(n)) {
				row(
					'Title position',
					anchorPicker(n.titlePosition || 'center', (titlePosition) => post({ op: 'node', id: n.id, titlePosition })),
				);
			}
			const attach = (attachment) => post({ op: 'attach', id: n.id, attachment });
			row(
				'Attached to',
				choice(
					[
						['', 'None'],
						...nodes
							.filter((p) => isBox(p) && p.id !== n.id && !descendant(p.id, n.id))
							.map((p) => [p.id, show(p.title) || p.id]),
						...(n.kind === 'label'
							? [
									...edges.map((e, i) => ['arrow:' + i, 'Arrow ' + (i + 1)]),
									...groups.map((g) => ['frame:' + g.id, 'Frame ' + g.id]),
								]
							: []),
					],
					n.attachment?.parent || '',
					(id) =>
						id.startsWith('arrow:')
							? post({ op: 'attachLabel', id: n.id, index: +id.slice(6), style: projectLabel(edges[+id.slice(6)], n) })
							: id.startsWith('frame:')
								? post({ op: 'attachLabel', id: n.id, group: id.slice(6) })
								: attach(id ? attachmentFor(n, byId(id), 'center') : null),
				),
			);
			if (n.attachment) {
				const a = n.attachment;
				row(
					'Parent anchor',
					anchorPicker(a.anchor, (anchor) => attach({ ...a, anchor })),
				);
				row(
					'Own anchor',
					anchorPicker(a.ownAnchor, (ownAnchor) => attach({ ...a, ownAnchor })),
				);
				row(
					'Offset X',
					field(a.dx, (v) => attach({ ...a, dx: +v }), { type: 'number' }),
					unit('mm'),
				);
				row(
					'Offset Y',
					field(a.dy, (v) => attach({ ...a, dy: +v }), { type: 'number' }),
					unit('mm'),
				);
				const detach = document.createElement('button');
				detach.textContent = 'Detach';
				detach.onclick = () => attach(null);
				row('', detach);
			}
			if (n.kind === 'label') {
				const frame = document.createElement('input');
				frame.type = 'checkbox';
				frame.setAttribute('aria-label', 'Thin frame');
				frame.checked = !!n.style?.border && n.style.border !== 'none';
				frame.onchange = () =>
					post({ op: 'style', ids: [n.id], style: { border: frame.checked ? 'solid' : 'none', weight: 'thin' } });
				row('Thin frame', frame);
				if (n.attachment) {
					row(
						'Placement',
						choice(
							[
								['', 'Choose…'],
								...ANCHORS.map((a) => ['inside:' + a, 'Inside ' + a]),
								...ANCHORS.filter((a) => a !== 'center').map((a) => ['outside:' + a, 'Outside ' + a]),
							],
							'',
							(v) => {
								if (!v) {
									return;
								}
								const [mode, anchor] = v.split(':'),
									opposite = {
										'north west': 'south east',
										north: 'south',
										'north east': 'south west',
										west: 'east',
										center: 'center',
										east: 'west',
										'south west': 'north east',
										south: 'north',
										'south east': 'north west',
									};
								const sign = mode === 'inside' ? -1 : 1;
								attach({
									...n.attachment,
									anchor,
									ownAnchor: mode === 'inside' ? anchor : opposite[anchor],
									dx: anchor.includes('west') ? -sign * 1.5 : anchor.includes('east') ? sign * 1.5 : 0,
									dy: anchor.includes('north') ? sign * 1.5 : anchor.includes('south') ? -sign * 1.5 : 0,
								});
							},
						),
					);
				}
			}
			row(
				'Width',
				field(n.wantWidth ?? n.width, (v) => post({ op: 'node', id: n.id, width: +v }), { type: 'number' }),
				unit('mm'),
			);
			row(
				'Height',
				field(r1(layout(n).h), (v) => post({ op: 'node', id: n.id, minh: +v }), { type: 'number' }),
				unit('mm'),
			);
		} else if (e) {
			section('Arrow');
			const reset = document.createElement('button');
			reset.textContent = 'Reset to auto';
			reset.onclick = () => resetToAuto([ei]);
			row('', reset);
			if (typeof edgeGeom === 'function' && edgeGeom(e)?.blocked)
				row('', label('No route with at most 3 bends. Move a box or set a manual route.'));
			if (e.from === e.to) {
				row(
					'Loop side',
					choice(
						[
							['north', 'Above'],
							['east', 'Right'],
							['south', 'Below'],
							['west', 'Left'],
						],
						e.loopSide || 'north',
						(loopSide) =>
							post({
								op: 'arrow',
								index: ei,
								loopSide,
								loopOut:
									{ north: 90, east: 0, south: 270, west: 180 }[loopSide] +
									(/circle|ellipse/.test(byId(e.from)?.style?.shape) ? 22 : 0),
								loopIn:
									{ north: 90, east: 0, south: 270, west: 180 }[loopSide] -
									(/circle|ellipse/.test(byId(e.from)?.style?.shape) ? 22 : 0),
								fromAnchor: '',
								toAnchor: '',
							}),
					),
				);
				row(
					'Loop size',
					numberControl(e.loopSize ?? 8, (loopSize) => post({ op: 'arrow', index: ei, loopSize: loopSize ?? 8 }), {
						min: 1,
						step: 1,
					}),
					unit('mm'),
				);
			}
			row('From', label(e.from));
			row('To', label(e.to));
			for (const [name, prop] of [
				['Start side', 'fromAnchor'],
				['End side', 'toAnchor'],
			])
				row(
					name,
					choice([['', 'Automatic'], ...['north', 'east', 'south', 'west'].map((v) => [v, v])], e[prop] || '', (v) =>
						post({ op: 'arrow', index: ei, [prop]: v }),
					),
				);
			row(
				'Lane',
				numberControl(e.lane, (v) => post({ op: 'arrow', index: ei, lane: v }), {
					min: -100,
					step: 0.5,
					placeholder: 'Automatic',
				}),
				unit('mm'),
			);
			row(
				'Step',
				numberControl(e.style?.step, (v) => post({ op: 'style', indices: [ei], style: { step: v || 0 } }), {
					step: 1,
					min: 1,
					placeholder: String(nextStep()),
				}),
			);
			const badge = document.createElement('button');
			badge.textContent = 'Set next step';
			badge.onclick = () => post({ op: 'style', indices: [ei], style: { step: nextStep() } });
			row('', badge);
			const colour = document.createElement('button');
			colour.textContent = 'Colour from source';
			colour.onclick = () => sourceColour([ei]);
			row('', colour);

			row(
				'Route',
				choice(routeOpts(e), e.route, (v) => post({ op: 'arrow', index: ei, route: v, mid: null, bend: 0 })),
			);
			row(
				'Heads',
				choice(HEAD_OPTS, e.head, (v) => post({ op: 'arrow', index: ei, head: v })),
			);
			row(
				'Label',
				field(show(e.label), (v) => post({ op: 'arrow', index: ei, label: tex(v) })),
			);
		} else if (count > 1) {
			section(`${selN.size} boxes, ${selE.size} arrows`);
			if (selN.size) {
				const ids = [...selN];
				const selected = ids.map(byId);
				const titleSame = selected.every((n) => n.title === selected[0].title);
				const title = field(titleSame ? show(selected[0].title) : '', (v) =>
					post({ op: 'batch', ops: ids.map((id) => ({ op: 'node', id, title: tex(v) })) }),
				);
				title.placeholder = titleSame ? '' : 'Mixed';
				row('Title', title);
				for (const [name, key] of [
					['Width', 'width'],
					['Height', 'minh'],
				]) {
					const values = selected.map((n) => (key === 'minh' ? +r1(layout(n).h) : n.width)),
						same = values.every((v) => v === values[0]);
					const size = field(
						same ? values[0] : '',
						(v) => post({ op: 'batch', ops: ids.map((id) => ({ op: 'node', id, [key]: +v })) }),
						{ type: 'number' },
					);
					size.placeholder = same ? '' : 'Mixed';
					size.min = '0';
					size.step = '0.5';
					row(name, size, unit('mm'));
				}
				const commonIcon = ids.every((id) => effectiveIcon(byId(id)) === effectiveIcon(byId(ids[0])))
					? effectiveIcon(byId(ids[0]))
					: '';
				row(
					'Icon',
					iconPicker(commonIcon, (icon) =>
						post({
							op: 'batch',
							ops: ids.map((id) => ({ op: 'node', id, icon: icon || (byId(id).kind === 'icon' ? '' : 'none') })),
						}),
					),
				);
				const boxes = ids.filter((id) => byId(id).kind !== 'icon');
				if (boxes.length) {
					row(
						'Position',
						choice(
							[
								['left', 'Left of title'],
								['above', 'Above title'],
								['right', 'Right of title'],
								['nw', 'Top left'],
								['ne', 'Top right'],
								['sw', 'Bottom left'],
								['se', 'Bottom right'],
							],
							byId(boxes[0]).iconPosition || 'left',
							(iconPosition) => post({ op: 'batch', ops: boxes.map((id) => ({ op: 'node', id, iconPosition })) }),
						),
					);
					const inherit = document.createElement('button');
					inherit.textContent = 'Use style icons';
					inherit.onclick = () => post({ op: 'batch', ops: boxes.map((id) => ({ op: 'node', id, icon: 'category' })) });
					row('Icons', inherit);
				}
				const styled = ids.filter((id) => nodeStyleKind(byId(id)));
				if (styled.length && styled.every((id) => nodeStyleKind(byId(id)) === nodeStyleKind(byId(styled[0])))) {
					styleHeader(styled);
				}
			}
			if (selE.size) {
				const ix = [...selE];
				const reset = document.createElement('button');
				reset.textContent = 'Reset to auto';
				reset.onclick = () => resetToAuto(ix);
				row('', reset);
				for (const [name, prop, opts] of [
					['Route', 'route', ROUTE_OPTS],
					['Heads', 'head', HEAD_OPTS],
				]) {
					const same = ix.every((i) => edges[i][prop] === edges[ix[0]][prop]) ? edges[ix[0]][prop] : '*';
					row(
						name,
						choice(same === '*' ? [['*', '(mixed)'], ...opts] : opts, same, (v) => {
							if (v !== '*') {
								post({ op: 'batch', ops: ix.map((i) => ({ op: 'arrow', index: i, [prop]: v })) });
							}
						}),
					);
				}
			}
		}
		const opacityObjects = layer
			? layers.filter((l) => selectedLayers.has(l.id))
			: [...selN].map(byId).concat([...selE].map((i) => edges[i]));
		if (opacityObjects.length) {
			const values = opacityObjects.map((o) => (layer ? (o.opacity ?? 1) : (o.style?.opacity ?? 1))),
				mixed = values.some((v) => v !== values[0]);
			const slider = document.createElement('input'),
				number = document.createElement('input');
			slider.type = 'range';
			number.type = 'number';
			for (const control of [slider, number]) {
				control.min = '0';
				control.max = '100';
				control.step = '1';
				control.setAttribute('aria-label', 'Opacity (%)');
			}
			slider.value = Math.round(values[0] * 100);
			number.value = mixed ? '' : slider.value;
			number.placeholder = mixed ? 'Mixed' : '';
			slider.title = mixed ? 'Mixed opacity' : 'Opacity';
			const change = (control) => {
				if (control.value === '' || !Number.isFinite(+control.value)) {
					return;
				}
				const value = Math.max(0, Math.min(100, +control.value));
				slider.value = number.value = value;
				post(
					layer
						? { op: 'batch', ops: opacityObjects.map((l) => ({ op: 'layerProps', id: l.id, opacity: value / 100 })) }
						: { op: 'style', ids: [...selN], indices: [...selE], style: { opacity: value / 100 } },
				);
			};
			slider.oninput = () => {
				number.value = slider.value;
				const value = +slider.value / 100;
				for (const object of opacityObjects) {
					if (layer) {
						object.opacity = value;
					} else {
						object.style = { ...object.style, opacity: value };
					}
				}
				render();
			};
			slider.onchange = () => change(slider);
			number.onchange = () => change(number);
			row('Opacity', slider, number, unit('%')).classList.add('opacity-row');
		}
		if (selN.size) {
			const selected = [...selN].map(byId);
			for (const key of ['x', 'y']) {
				const same = selected.every((n) => n[key] === selected[0][key]);
				row(
					key.toUpperCase(),
					field(
						same ? selected[0][key] : '',
						(v) =>
							post({
								op: 'batch',
								ops: selected.map((n) => ({
									op: 'move',
									id: n.id,
									x: key === 'x' ? +v : n.x,
									y: key === 'y' ? +v : n.y,
								})),
							}),
						{ type: 'number' },
					),
					unit('mm'),
				);
			}
		}
		if (selN.size || selG) {
			row(
				'Move to layer',
				choice([['', 'Choose…'], ...layers.map((l) => [l.id, l.name])], '', (value) => {
					if (value) {
						moveToLayer(selectedRoots(), value);
					}
				}),
			);
		}
		for (const arrow of [false, true]) {
			const objects = arrow ? [...selE].map((i) => edges[i]) : [...selN].map(byId).filter((n) => n.kind !== 'icon');
			if (!objects.length) {
				continue;
			}
			section(arrow ? 'Arrow style' : 'Style');
			for (const [name, prop, values] of styleFields(arrow)) {
				current = ['text', 'font', 'textColor'].includes(prop)
					? 'Text'
					: prop === 'fill'
						? 'Fill'
						: ['border', 'color', 'weight', 'lineWidth'].includes(prop)
							? 'Outline'
							: ['start', 'end'].includes(prop)
								? 'Route & tips'
								: 'Shape & decoration';
				if (
					['markCorner', 'markSize', 'markColor'].includes(prop) &&
					!objects.some((o) => o.style?.mark && o.style.mark !== 'none')
				)
					continue;
				const control = styleSelect(prop, values, objects, (style) =>
					post({
						op: 'batch',
						ops: [{ op: 'style', ...(arrow ? { indices: [...selE] } : { ids: [...selN] }), style }],
					}),
				);
				control._inspectorSection = current;
				const styledRow = row(name, control);
				if (objects.some((o) => isOverride(o, prop)))
					markOverride(styledRow, arrow ? null : [...selN], arrow ? [...selE] : null, [prop]);
				if (!arrow && prop === 'font' && objects.every((n) => !n.kind)) {
					const same = objects.every((n) => (n.codeFont || '') === (objects[0].codeFont || ''));
					row(
						'Code size',
						choice(
							[
								...(same ? [] : [['*', 'Mixed']]),
								['', 'One step below title'],
								...['tiny', ...Object.keys(sizes)]
									.filter((v) => SakugaText.sizes[v] <= Math.min(...objects.map((n) => smallerPt(fontPt(n)))))
									.map((v) => [v, v]),
							],
							same ? objects[0].codeFont || '' : '*',
							(codeFont) => {
								if (codeFont !== '*')
									post({ op: 'batch', ops: objects.map((n) => ({ op: 'node', id: n.id, codeFont })) });
							},
						),
					);
					for (const n of objects)
						if (n.wantWidth !== undefined) {
							const hint = document.createElement('p');
							hint.className = 'empty';
							hint.textContent = 'box widened to fit `' + SakugaText.need(n, figureFont).content + '`';
							getSection('Text').append(hint);
						}
				}
			}
		}
		if (n) {
			current = 'Text';
			const colourRow = row(
				'Text colour',
				styleColour('textColor', n.style?.textColor || '', (style) => post({ op: 'style', ids: [n.id], style })),
			);
			if (isOverride(n, 'textColor')) markOverride(colourRow, [n.id], null, ['textColor']);
		}
		if (count > 0) {
			const b1 = document.createElement('button');
			b1.textContent = 'Copy style';
			b1.title = 'Ctrl+Alt+C';
			b1.addEventListener('click', copyStyle);
			const b2 = document.createElement('button');
			b2.textContent = 'Paste style';
			b2.title = 'Ctrl+Alt+V';
			b2.disabled = !styleClip;
			b2.addEventListener('click', pasteStyle);
			const r = document.createElement('div');
			r.className = 'buttons';
			r.append(b1, b2);
			getSection('Arrange').appendChild(r);
		} else if (!layer && !group && !attached) {
			section('Selection');
			const p = document.createElement('p');
			p.className = 'empty';
			p.textContent = 'Nothing selected';
			selection.appendChild(p);
		}

		section('Styles');
		const styleList = getSection('Styles', figure);
		const editStyle = (def, change) => post({ op: 'styleEdit', key: def.key, ...change });
		const styleEditor = (def) => {
			const panel = document.createElement('div');
			panel.className = 'category-edit style-edit';
			const fake = [{ style: def.props }];
			const line = (name, control) => {
				const r = document.createElement('div');
				r.className = 'row';
				const l = document.createElement('span');
				l.textContent = name;
				r.append(l, control);
				panel.append(r);
				return r;
			};
			const prop = (name, key, values) =>
				line(
					name,
					styleSelect(key, values, fake, (patch) => editStyle(def, { props: patch })),
				);
			const sizesList = ['', ...Object.keys(sizes)];
			if (def.kind === 'box') {
				prop('Colour', 'fill', ['', ...Object.keys(palette), 'none']);
				prop('Outline', 'border', ['', 'solid', 'dashed', 'dotted', 'none', 'double']);
				prop('Outline colour', 'color', ['', ...Object.keys(palette)]);
				prop('Width', 'weight', ['', 'medium', 'thick']);
				prop('Shape', 'shape', ['', 'rectangle', 'pill', 'ellipse', 'circle', 'diamond', 'cylinder']);
				prop('Text', 'text', ['', 'bold', 'italic', 'bold-italic']);
				prop('Font size', 'font', sizesList);
				line(
					'Text colour',
					styleColour('textColor', def.props.textColor || '', (patch) => editStyle(def, { props: patch })),
				);
				line(
					'Icon',
					iconPicker(def.icon, (icon) => editStyle(def, { icon })),
				);
				const boxes = document.createElement('input');
				boxes.type = 'checkbox';
				boxes.checked = !!def.boxes;
				boxes.setAttribute('aria-label', 'Use the icon in boxes');
				boxes.onchange = () => editStyle(def, { boxes: boxes.checked });
				line('Icon in boxes', boxes);
			} else if (def.kind === 'label') {
				prop('Text', 'text', ['', 'bold', 'italic', 'bold-italic']);
				prop('Font size', 'font', sizesList);
				line(
					'Text colour',
					styleColour('textColor', def.props.textColor || '', (patch) => editStyle(def, { props: patch })),
				);
				prop('Knock-out', 'fill', ['none', 'white']);
				prop('Outline', 'border', ['', 'solid', 'dashed', 'dotted', 'none']);
			} else if (def.kind === 'arrow') {
				prop('Line', 'border', ['', 'solid', 'dashed', 'dotted']);
				prop('Colour', 'color', ['', ...Object.keys(palette)]);
				prop('Line width (pt)', 'lineWidth', null);
				prop('Start', 'start', ['none', 'Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar']);
				prop('End', 'end', ['Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar', 'none']);
			} else {
				line(
					'Colour',
					styleColour('color', def.props.color || '', (patch) =>
						editStyle(def, { props: { color: patch.color || 'grey' } }),
					),
				);
				line(
					'Outline',
					choice(
						['none', 'solid', 'dashed', 'dotted', 'region'].map((v) => [v, v]),
						def.props.frame || 'dashed',
						(frame) => editStyle(def, { props: { frame } }),
					),
				);
			}
			if (def.kind === 'box' || def.kind === 'arrow') {
				const flag = document.createElement('input');
				flag.type = 'checkbox';
				flag.checked = !!def.legend;
				flag.setAttribute('aria-label', 'Show in legend');
				flag.onchange = () => editStyle(def, { legend: flag.checked });
				line('In legend', flag);
			}
			const users = styleUsers(def),
				remove = document.createElement('button');
			remove.type = 'button';
			remove.textContent = 'Delete style';
			const confirm = document.createElement('div');
			confirm.className = 'style-delete';
			confirm.hidden = true;
			const where = document.createElement('select');
			where.setAttribute('aria-label', 'Where the objects go');
			where.add(new Option('Keep their look, without a style', ''));
			for (const o of styles.filter((s) => s.kind === def.kind && s.key !== def.key))
				where.add(new Option('Move to ' + show(o.name), o.key));
			const ok = document.createElement('button');
			ok.type = 'button';
			ok.textContent = 'Delete';
			ok.onclick = () => post({ op: 'styleDelete', key: def.key, to: where.value });
			const cancel = document.createElement('button');
			cancel.type = 'button';
			cancel.textContent = 'Cancel';
			cancel.onclick = () => {
				confirm.hidden = true;
				remove.hidden = false;
			};
			const ask = document.createElement('span');
			ask.textContent = `${users} object${users === 1 ? '' : 's'} use${users === 1 ? 's' : ''} it. Where do they go?`;
			const row2 = document.createElement('div');
			row2.className = 'buttons';
			row2.append(ok, cancel);
			confirm.append(ask, where, row2);
			remove.onclick = () => {
				if (!users) {
					post({ op: 'styleDelete', key: def.key });
					return;
				}
				remove.hidden = true;
				confirm.hidden = false;
			};
			panel.append(remove, confirm);
			return panel;
		};
		for (const kind of ['box', 'arrow', 'frame', 'label']) {
			const defs = styles.filter((s) => s.kind === kind);
			const head = document.createElement('div');
			head.className = 'category-heading style-group';
			const title = document.createElement('span');
			title.textContent = KIND_NAMES[kind] + ' styles';
			const addButton = document.createElement('button');
			addButton.type = 'button';
			addButton.className = 'icon';
			addButton.textContent = '+';
			addButton.title = 'Add a ' + kind + ' style';
			addButton.setAttribute('aria-label', 'Add a ' + kind + ' style');
			addButton.onclick = () => addStyle(kind);
			const legendHeading = document.createElement('span');
			legendHeading.textContent = kind === 'box' ? 'Legend' : '';
			head.append(title, legendHeading, addButton);
			styleList.append(head);
			if (!defs.length) {
				const none = document.createElement('p');
				none.className = 'empty style-empty';
				none.textContent = 'None yet';
				styleList.append(none);
			}
			for (const def of defs) {
				const item = document.createElement('div');
				item.className = 'category-item style-item';
				const line = document.createElement('div');
				line.className = 'category-line style-line';
				const sw = document.createElement('button');
				sw.type = 'button';
				sw.className = 'category-swatch';
				sw.style.background = styleSwatch(def);
				sw.title = 'Edit ' + show(def.name);
				sw.setAttribute('aria-label', sw.title);
				const name = field(show(def.name), (v) => {
					const next = tex(v);
					if (openStyles.has(def.key)) {
						openStyles.delete(def.key);
						openStyles.add(slug(next, def.key));
					}
					editStyle(def, { name: next });
				});
				name.setAttribute('aria-label', 'Style name');
				name.dataset.styleName = def.key;
				const users = document.createElement('span');
				users.className = 'style-count';
				const count = styleUsers(def);
				users.textContent = String(count);
				users.title = count + (count === 1 ? ' object uses' : ' objects use') + ' this style';
				const inLegend = document.createElement('input');
				inLegend.type = 'checkbox';
				inLegend.disabled = kind !== 'box' && kind !== 'arrow';
				inLegend.hidden = kind !== 'box';
				inLegend.checked = !!def.legend;
				inLegend.title = 'Include in legend';
				inLegend.setAttribute('aria-label', 'Include ' + show(def.name) + ' in legend');
				inLegend.onchange = () => editStyle(def, { legend: inLegend.checked });
				const edit = styleEditor(def);
				edit.hidden = !openStyles.has(def.key);
				sw.setAttribute('aria-expanded', String(!edit.hidden));
				const toggle = () => {
					edit.hidden = !edit.hidden;
					if (edit.hidden) openStyles.delete(def.key);
					else openStyles.add(def.key);
					sw.setAttribute('aria-expanded', String(!edit.hidden));
				};
				sw.onclick = toggle;
				line.onclick = (ev) => {
					if (ev.target === line || ev.target === users) toggle();
				};
				line.append(sw, name, users, inLegend);
				item.append(line, edit);
				styleList.append(item);
			}
		}

		section('Figure');
		row(
			'Font size',
			choice(
				Object.keys(sizes).map((v) => [v, v]),
				figureFont,
				(size) => post({ op: 'font', size }),
			),
		);
		const lg = document.createElement('input');
		lg.type = 'checkbox';
		lg.checked = legend;
		lg.addEventListener('change', () => post({ op: 'legend', on: lg.checked }));
		row('Legend', lg);

		row(
			'Arrows',
			choice(STYLE_OPTS, arrowsStyle, (v) => post({ op: 'arrows', style: v })),
		);
		row(
			'Grid',
			field(
				grid,
				(v) => {
					grid = Math.max(0.5, +v || 1);
					saveState();
					render();
				},
				{ type: 'number' },
			),
			unit('mm'),
		);
		for (const [key, body] of sections) {
			body.parentElement.hidden = !body.children.length;
		}
		const signature = JSON.stringify([[...selN], [...selE], selG, selN.label, [...selectedLayers]]);
		const has = !!(selN.size || selE.size || selG || selN.label || selectedLayers.size);
		if (has && signature !== lastInspectorSelection) setTab('selection');
		lastInspectorSelection = signature;
		document.getElementById('tab-count').textContent = count > 1 ? String(count) : '';
	}
	const ROUTE_OPTS = [
		['auto', 'figure style'],
		['straight', 'straight'],
		['manhattan', 'manhattan'],
		['curved', 'curved'],
		['u', 'U route'],
	];
	const routeOpts = (e) =>
		['hvh', 'vhv', 'bend', 'fixed', 'loop'].includes(e.route) ? [...ROUTE_OPTS, [e.route, 'set by hand']] : ROUTE_OPTS;
	const HEAD_OPTS = [
		['end', 'at the end'],
		['both', 'at both ends'],
		['none', 'none'],
	];
	const STYLE_OPTS = [
		['straight', 'straight'],
		['manhattan', 'manhattan'],
		['curved', 'curved'],
	];
	const LINE_OPTS = [
		['arr', 'solid'],
		['arr-dashed', 'dashed'],
	];
	const SKETCH_CONTROLS = [
		['left', 'Align left', 'Alt+A', 'M2 2v12 M4 5h8v2H4z M4 10h5v2H4z'],
		['centerX', 'Align horizontal centre', 'Alt+C', 'M8 1v14 M3 4h10v3H3z M5 10h6v3H5z'],
		['right', 'Align right', 'Alt+D', 'M14 2v12 M4 5h8v2H4z M7 10h5v2H7z'],
		['top', 'Align top', 'Alt+W', 'M2 2h12 M4 4h3v8H4z M10 4h3v5h-3z'],
		['centerY', 'Align vertical centre', 'Alt+V', 'M1 8h14 M3 3h3v10H3z M10 5h3v6h-3z'],
		['bottom', 'Align bottom', 'Alt+S', 'M2 14h12 M4 4h3v8H4z M10 7h3v5h-3z'],
		['distributeX', 'Distribute horizontal gaps', 'Alt+X', 'M1 3v10 M15 3v10 M3 6h2v4H3z M7 4h2v8H7z M11 6h2v4h-2z'],
		['distributeY', 'Distribute vertical gaps', 'Alt+Y', 'M3 1h10 M3 15h10 M6 3h4v2H6z M4 7h8v2H4z M6 11h4v2H6z'],
		['sameW', 'Same width', 'Alt+U', 'M2 3h12v3H2z M2 10h12v3H2z M2 8h12'],
		['sameH', 'Same height', 'Alt+B', 'M3 2h3v12H3z M10 2h3v12h-3z M8 2v12'],
	];

	const SHORTCUTS = [
		['Double-click', 'new box, or edit title'],
		['Drag the dot', 'arrow, or new connected box'],
		['Drag on empty space', 'select with a rectangle'],
		['Ctrl+click / Shift+click', 'toggle / add to selection; set alignment reference'],
		['Ctrl+A', 'select all'],
		['Shift+drag', 'move horizontally or vertically only'],
		['Alt+drag', 'copy'],
		['Ctrl+D', 'duplicate'],
		['Ctrl+G', 'group selection'],
		['Ctrl+[, Ctrl+]', 'move selection down or up a layer'],
		['Ctrl+Shift+G', 'ungroup'],
		['Ctrl+C, Ctrl+X, Ctrl+V', 'copy, cut, paste (as TikZ)'],
		['Ctrl+Alt+C, Ctrl+Alt+V', 'copy and paste style'],
		['Arrow keys', 'nudge 1 mm, with Shift 5 mm'],
		['1–9', 'box style'],
		['D', 'dashed arrow on or off'],
		['R', 'next route of the arrow'],
		['Shift+drag a corner', 'scale the selection evenly'],
		['Ctrl after you start dragging', 'no grid, no guides'],
		['Enter / F2', 'edit existing title'],
		['Tab / Shift+Tab', 'next connected box / box below; type title'],
		['Esc in a new empty box', 'cancel box and arrow'],
		['Type a character', 'replace box/label title; D/R and existing shortcuts take priority'],
		['Alt+T', 'hold to preview Tidy up, release to apply; Esc cancels'],
		...SKETCH_CONTROLS.map(([, label, key]) => [key, label]),
		['Del', 'delete'],
		['Esc', 'clear selection'],
		['Space+drag, middle mouse', 'pan'],
		['Ctrl+wheel', 'zoom'],
		['Shift+1', 'fit to view'],
	];

	const keys = document.getElementById('keys');
	for (const [k, v] of SHORTCUTS) {
		const tr = document.createElement('tr');
		const a = document.createElement('td');
		const b = document.createElement('td');
		a.textContent = k;
		b.textContent = v;
		tr.append(a, b);
		keys.appendChild(tr);
	}

	// Style of a box: category, width and height; of an arrow: its line.
	function copyStyle() {
		if (selN.label) {
			styleClip = { labelStyle: { ...labelTarget().style } };
			render();
			return;
		}
		const ids = [...selN],
			ix = [...selE];
		const g = typeof groups !== 'undefined' && groups.find((g) => g.id === selG);
		if (g) {
			styleClip = {
				groupStyle: Object.fromEntries(
					[
						'frame',
						'fill',
						'fillStrength',
						'outline',
						'color',
						'frameColor',
						'padding',
						'lineWidth',
						'titlePosition',
						'titleBold',
						'titleFont',
						'titleColor',
					].map((k) => [k, g[k]]),
				),
				color: g.frameColor || g.color,
			};
			render();
			return;
		}
		styleClip = null;
		if (ids.length) {
			const n = byId(ids[0]);
			styleClip = {
				color:
					n.style?.color ||
					n.style?.textColor ||
					n.style?.fill ||
					(typeof catOf !== 'undefined' ? catOf(n.cat)?.color : ''),
				nodeStyle: { ...n.style },
				codeFont: n.codeFont || '',
				cat: n.cat,
				width: n.wantWidth ?? n.width,
				minh: n.minh,
				kind: styleClip && styleClip.kind,
			};
		}
		if (ix.length) {
			const e = edges[ix[0]];
			styleClip = {
				...(styleClip || {}),
				color: e.style?.color || '',
				edgeStyle: {
					...Object.fromEntries(Object.entries(e.style || {}).filter(([k]) => k !== 'step')),
					lineWidth: e.style?.lineWidth ?? ({ medium: 0.8, thick: 1.2 }[e.style?.weight] || 0.45),
				},
				lane: e.lane,
				kind: e.kind,
				route: e.route,
				head: e.head,
			};
		}
		render();
	}
	function pasteStyle() {
		if (!styleClip) {
			return;
		}
		if (selN.label) {
			const st = styleClip.labelStyle || {};
			labelChange(Object.fromEntries(['font', 'bold', 'italic', 'color', 'background'].map((k) => [k, st[k] ?? null])));
			return;
		}
		const ops = [];
		const g = typeof groups !== 'undefined' && groups.find((g) => g.id === selG);
		if (g) {
			post({
				op: 'groupProps',
				id: g.id,
				...(styleClip.groupStyle
					? Object.fromEntries(
							Object.entries(styleClip.groupStyle).map(([k, v]) => [
								k,
								v ??
									{
										frame: 'dashed',
										fill: '',
										fillStrength: 30,
										outline: '',
										color: 'grey',
										titlePosition: 'legacy',
										titleBold: false,
									}[k] ??
									(k === 'lineWidth' || k === 'padding' ? 0 : ''),
							]),
						)
					: { frameColor: styleClip.color || '' }),
			});
			return;
		}
		if (!styleClip.nodeStyle && selN.size)
			ops.push({
				op: 'style',
				ids: [...selN],
				style: { color: styleClip.color || '', textColor: styleClip.color || '' },
			});
		if (!styleClip.edgeStyle && selE.size)
			ops.push({ op: 'style', indices: [...selE], style: { color: styleClip.color || '' } });
		if (styleClip.width !== undefined) {
			for (const id of selN) {
				ops.push({
					op: 'node',
					id,
					cat: styleClip.cat,
					width: styleClip.width,
					minh: styleClip.minh,
					codeFont: styleClip.codeFont,
				});
			}
		}
		if (styleClip.kind) {
			for (const i of selE) {
				ops.push({
					op: 'arrow',
					index: i,
					kind: styleClip.kind,
					route: styleClip.route,
					head: styleClip.head,
					lane: styleClip.lane ?? null,
				});
			}
		}
		if (styleClip.nodeStyle) {
			ops.push({
				op: 'style',
				ids: [...selN],
				style: {
					opacity: styleClip.nodeStyle.opacity ?? 1,
					...Object.fromEntries(
						[
							'shape',
							'fill',
							'border',
							'color',
							'weight',
							'text',
							'font',
							'pattern',
							'patternColor',
							'mark',
							'markCorner',
							'markSize',
							'markColor',
							'textColor',
						].map((k) => [k, styleClip.nodeStyle[k] || '']),
					),
				},
			});
		}
		if (styleClip.edgeStyle) {
			ops.push({
				op: 'style',
				indices: [...selE],
				style: {
					opacity: styleClip.edgeStyle.opacity ?? 1,
					...Object.fromEntries(
						['border', 'color', 'weight', 'position', 'side', 'start', 'end', 'lineWidth', 'tipLength', 'tipWidth'].map(
							(k) => [k, styleClip.edgeStyle[k] ?? { lineWidth: 0.45, tipLength: 1.5, tipWidth: 1.2 }[k] ?? ''],
						),
					),
				},
			});
		}
		if (ops.length) {
			post({ op: 'batch', ops });
		}
	}

	// Copy also includes selected arrows and the endpoint boxes needed to paste them.
	function nodeLine(n) {
		if (n.kind === 'icon') {
			return `\\pic[pic text={${n.title}}] (${n.id}) at (${r1(n.x)},${r1(n.y)}) {sg object={${n.icon || ''}}{${r1(n.width)}}{${r1(n.minh || n.width)}}};`;
		}
		const o = [n.cat ? `sg style/${n.cat}` : n.kind === 'label' ? 'sg label' : 'sg box'];
		if (n.wantWidth !== undefined && n.wantWidth !== n.width) o.push(`sg want=${n.wantWidth}`);
		if (n.codeFont) o.push(`sg code font=${n.codeFont}`);
		if (n.width !== defaultWidth) {
			o.push(`text width=${n.width}mm`);
		}
		if (n.minh > 0) {
			o.push(`minimum height=${r1(n.minh)}mm`);
		}
		if (n.icon) {
			o.push(`sg icon=${n.icon}`);
		}
		if (n.iconPosition) {
			o.push(`sg icon position=${n.iconPosition}`);
		}
		const lbl = n.code ? `${n.title}\\\\[-1pt]\\sgcode{${n.code}}` : n.title;
		return `\\node[${[...o, ...(n.extra || [])].join(', ')}] (${n.id}) at (${r1(n.x)},${r1(n.y)}) {${lbl}};`;
	}

	function edgeLine(e) {
		const o = [e.styleKey ? `sg style/${e.styleKey}` : e.kind, ...(e.head !== 'end' ? [`head ${e.head}`] : [])];
		if (e.from === e.to) o.push('sg fixed');
		else if (['straight', 'manhattan', 'curved'].includes(e.route)) {
			o.push(`sg ${e.route}`);
		} else if (e.route !== 'auto') {
			o.push('sg fixed');
		}
		o.push(...(e.extra || []));
		const a = byId(e.from),
			b = byId(e.to),
			r = resolveRoute(e, a, b),
			A = e.from,
			B = e.to;
		const lbl = (pos) => (e.label ? ` node[sg elabel${pos}] {${e.label}}` : '');
		let path;
		const G = typeof SakugaRoutes !== 'undefined' && edgeGeom(e);
		if (G && (G.rule || G.fixed || G.loop)) {
			const aa = { ...a, ...layout(a) },
				bb = { ...b, ...layout(b) },
				sa = G.sa || e.fromAnchor || 'east',
				sb = G.sb || e.toAnchor || 'west';
			if (G.loop)
				path = `${SakugaRoutes.portText(aa, sa, G.pts[0])} to[out=${G.out},in=${G.inn},min distance=${e.loopSize ?? 8}mm]${lbl('')} ${SakugaRoutes.portText(bb, sb, G.pts.at(-1))}`;
			else {
				if (G.rule)
					o.push(
						`sg route=${e.route}`,
						...(!e.fromAnchor ? ['sg implicit from'] : []),
						...(!e.toAnchor ? ['sg implicit to'] : []),
					);
				path = SakugaRoutes.polyline(
					G.pts,
					SakugaRoutes.portText(aa, sa, G.pts[0]),
					SakugaRoutes.portText(bb, sb, G.pts.at(-1)),
					lbl(''),
				);
			}
		} else if (r.type === 'vert') {
			const s1 = b.y < a.y ? 'south' : 'north',
				s2 = b.y < a.y ? 'north' : 'south';
			path = r.at === 'b' ? `(${A}.${s1} -| ${B}) --${lbl('')} (${B})` : `(${A}) --${lbl('')} (${A} |- ${B}.${s2})`;
		} else if (r.type === 'horz') {
			const s1 = b.x > a.x ? 'east' : 'west',
				s2 = b.x > a.x ? 'west' : 'east';
			path = r.at === 'b' ? `(${A}.${s1} |- ${B}) --${lbl('')} (${B})` : `(${A}) --${lbl('')} (${A} -| ${B}.${s2})`;
		} else if (r.type === 'hvh' || r.type === 'vhv') {
			const op = r.type === 'hvh' ? '-|' : '|-';
			path =
				r.mid === null || r.mid === undefined
					? `(${A}) ${op}${lbl(', pos=0.25')} (${B})`
					: `(${A}) ${op}${lbl(', pos=0.75')} (${r.type === 'hvh' ? `${r1(r.mid)},${r1(b.y)}` : `${r1(b.x)},${r1(r.mid)}`}) -- (${B})`;
		} else if (r.type === 'bend') {
			const d = r.bend || 0;
			path = `(${A}) to[bend ${d >= 0 ? 'left' : 'right'}=${r1(Math.abs(d))}]${lbl('')} (${B})`;
		} else {
			path = `(${A}) --${lbl('')} (${B})`;
		}
		return `\\draw[${o.join(', ')}] ${path};`;
	}
	function clip() {
		const ids = new Set([...selN].filter((id) => byId(id) && !byId(id).locked && !byId(id).hidden));
		const selected = edges.filter((e, i) => selE.has(i) || (ids.has(e.from) && ids.has(e.to)));
		const copiedGroups = new Set();
		const includeGroup = (id) => {
			if (typeof groups === 'undefined') return;
			const g = groups.find((g) => g.id === id);
			if (!g || copiedGroups.has(id)) return;
			copiedGroups.add(id);
			for (const child of groups.filter((g) => g.parent === id)) includeGroup(child.id);
			for (const n of nodes.filter((n) => n.group === id && !n.hidden && !n.locked)) ids.add(n.id);
		};
		if (selG) includeGroup(selG);
		for (const e of selected) {
			includeGroup(e.from);
			includeGroup(e.to);
		}
		for (const e of selected) {
			if (byId(e.from)) ids.add(e.from);
			if (byId(e.to)) ids.add(e.to);
		}
		for (const id of ids) {
			const a = byId(id)?.attachment;
			if (a && byId(a.parent)) {
				ids.add(a.parent);
			}
		}
		if (!ids.size) {
			return '';
		}
		const used = new Set([...[...ids].map((id) => byId(id).cat), ...selected.map((e) => e.styleKey)].filter(Boolean));
		return [
			...styles.filter((s) => used.has(s.key)).map((s) => s.line),
			...(typeof groups === 'undefined'
				? []
				: groups
						.filter((g) => copiedGroups.has(g.id))
						.map(
							(g) =>
								src.value.split('\n').find((line) => line.startsWith('% sakuga group ' + g.id + ' ')) ||
								`% sakuga group ${g.id} {${g.name}} ${g.frame} ${g.color}${g.parent ? ' in=' + g.parent : ''}`,
						)),
			...nodes
				.filter((n) => ids.has(n.id))
				.map(
					(n) =>
						src.value
							.split('\n')
							.find((line) => new RegExp(String.raw`\\(?:node|pic)\[.*\]\s*\(${n.id}\)\s*at\s*\(`).test(line)) ||
						nodeLine(n),
				),
			...selected
				.filter((e) => (ids.has(e.from) || copiedGroups.has(e.from)) && (ids.has(e.to) || copiedGroups.has(e.to)))
				.map((e) => {
					const index = edges.indexOf(e);
					return (
						src.value
							.split('\n')
							.filter((line) => /^(?:% sakuga hidden )?\\draw\[/.test(line))
							.map((line) => line.replace(/^% sakuga hidden /, ''))[index] || edgeLine(e)
					);
				}),
		].join('\n');
	}
	function duplicate(ids, dx, dy) {
		let next = Math.max(0, ...nodes.map((n) => +(/^n(\d+)$/.exec(n.id) || [0, 0])[1])) + 1;
		const map = new Map(ids.map((id) => [id, `n${next++}`]));
		const ops = ids.map((id) => {
			const n = byId(id);
			return {
				op: 'addNode',
				wantWidth: n.wantWidth,
				codeFont: n.codeFont,
				titlePosition: n.titlePosition,
				id: map.get(id),
				x: n.x + dx,
				y: n.y + dy,
				title: n.title,
				icon: n.icon,
				iconPosition: n.iconPosition,
				kind: n.kind,
				code: n.code,
				cat: n.cat,
				width: n.width,
				minh: n.minh,
				style: n.style,
				extra: n.extra,
			};
		});
		for (const id of ids) {
			const n = byId(id),
				a = n.attachment;
			if (a) {
				ops.push({
					op: 'attach',
					id: map.get(id),
					attachment: {
						...a,
						parent: map.get(a.parent) || a.parent,
						dx: a.dx + (map.has(a.parent) ? 0 : dx),
						dy: a.dy + (map.has(a.parent) ? 0 : dy),
					},
				});
			}
		}
		for (const e of edges) {
			if (map.has(e.from) && map.has(e.to)) {
				ops.push({
					op: 'addEdge',
					styleKey: e.styleKey,
					fromAnchor: e.fromAnchor,
					toAnchor: e.toAnchor,
					fromOffset: e.fromOffset,
					toOffset: e.toOffset,
					loopSide: e.loopSide,
					loopSize: e.loopSize,
					loopOut: e.loopOut,
					loopIn: e.loopIn,
					looseness: e.looseness,
					loopMax: e.loopMax,
					...(e.route === 'fixed'
						? {
								waypoints: edgeGeom(e)
									.pts.slice(1, -1)
									.map((p) => [p[0] + dx, p[1] + dy]),
							}
						: {}),
					from: map.get(e.from),
					to: map.get(e.to),
					kind: e.kind,
					route: e.route,
					mid: e.mid,
					bend: e.bend,
					head: e.head,
					label: e.label,
					labelStyle: e.labelStyle,
					labels: e.labels,
					style: e.style,
					extra: e.extra,
				});
			}
		}
		pendingSelect = [...map.values()];
		post({ op: 'batch', ops });
	}
	function deleteSelection() {
		if (selN.label) {
			post({ op: 'label', ...selN.label, text: '' });
			delete selN.label;
			render();
			return;
		}
		const ids = [...selN].filter(byId),
			ix = [...selE].filter((k) => edges[k]);
		// arrows first, highest index first, so the indices stay valid; then the boxes
		const ops = [...ix].sort((a, b) => b - a).map((k) => ({ op: 'deleteEdge', index: k }));
		post({ op: 'batch', ops: [...ops, ...ids.map((id) => ({ op: 'deleteNode', id }))] });
		selN = new Set();
		selE = new Set();
	}
	function unit(s) {
		const u = document.createElement('span');
		u.className = 'unit';
		u.textContent = s;
		return u;
	}
	function label(s) {
		const u = document.createElement('code');
		u.textContent = s;
		return u;
	}

	function slug(name, except) {
		const base =
			show(name)
				.toLowerCase()
				.replace(/ä/g, 'ae')
				.replace(/ö/g, 'oe')
				.replace(/ü/g, 'ue')
				.replace(/ß/g, 'ss')
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '') || 'cat';
		let key = base;
		for (let i = 2; styles.some((s) => s.key === key && s.key !== except); i++) {
			key = `${base}-${i}`;
		}
		return key;
	}

	function newId() {
		const used = nodes.map((n) => +(/^n(\d+)$/.exec(n.id) || [0, 0])[1]);
		return 'n' + (Math.max(0, ...used) + 1);
	}

	let tidyPreview = null,
		tidyHeld = false;
	function tidyPlan() {
		return SakugaSketch.tidy(nodes, groups, edges, [...selN], layout);
	}
	function previewTidy() {
		if (!tidyPreview) {
			tidyPreview = tidyPlan();
			render();
		}
	}
	function cancelTidy() {
		tidyPreview = null;
		tidyHeld = false;
		render();
	}
	function applyTidy() {
		const batch = tidyPreview || tidyPlan();
		tidyPreview = null;
		tidyHeld = false;
		if (batch.ops.length) post(batch);
		render();
	}
	function tidyControl(parent) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = selN.size ? 'Tidy up' : 'Tidy up figure';
		b.title = 'Tidy up (Alt+T)';
		b.onmouseenter = previewTidy;
		b.onmouseleave = () => {
			if (!tidyHeld) cancelTidy();
		};
		b.onclick = () => {
			b.blur();
			applyTidy();
		};
		parent.append(b);
	}
	function drawTidyPreview() {
		if (!tidyPreview) return;
		const g = el('g', { 'pointer-events': 'none', opacity: 0.55 }, svg);
		const ns = nodes.map((n) => ({
				...n,
				...tidyPreview.ops.find((o) => o.op === 'node' && o.id === n.id),
				...tidyPreview.ops.find((o) => o.op === 'move' && o.id === n.id),
			})),
			es = edges.map((e, index) => ({ ...e, ...tidyPreview.ops.find((o) => o.op === 'arrow' && o.index === index) }));
		for (const group of groups) {
			const b = SakugaRoutes.bounds(
				group.id,
				ns.map((n) => ({ ...n, ...layout(n) })),
				groups,
				new Set(),
				es,
			);
			if (b && group.frame !== 'none')
				el(
					'rect',
					{
						x: px(b.x - b.w / 2),
						y: py(b.y + b.h / 2),
						width: b.w * view.s,
						height: b.h * view.s,
						fill: 'none',
						stroke: 'var(--sel)',
						'stroke-dasharray': '5 3',
					},
					g,
				);
		}

		for (const n of nodes) {
			const move = tidyPreview.ops.find((o) => o.op === 'move' && o.id === n.id),
				props = tidyPreview.ops.find((o) => o.op === 'node' && o.id === n.id);
			if (!move && !props) continue;
			const q = { ...n, ...props, ...move },
				s = layout(q);
			el(
				'rect',
				{
					x: px(q.x - s.w / 2),
					y: py(q.y + s.h / 2),
					width: s.w * view.s,
					height: s.h * view.s,
					fill: 'var(--sel)',
					'fill-opacity': 0.12,
					stroke: 'var(--sel)',
					'stroke-dasharray': '5 3',
				},
				g,
			);
		}
	}
	window.addEventListener('blur', () => {
		if (tidyPreview) cancelTidy();
	});
	function sketchCommand(command) {
		if (command === 'tidy') {
			if (!floating && !editing && !isTyping()) {
				tidyHeld = true;
				previewTidy();
			}
			return;
		}
		if (floating || editing || isTyping()) {
			return;
		}
		const ids = [...selN].filter((id) => byId(id) && !byId(id).locked && !byId(id).hidden);
		if (ids.length < 2) {
			return;
		}
		const key = selN.has(keyObject)
			? keyObject
			: groupById(keyObject) && members(keyObject).every((id) => selN.has(id))
				? members(keyObject)[0]
				: null;
		const batch =
			command === 'sameW' || command === 'sameH'
				? SakugaSketch.sameSize(nodes, ids, key, command === 'sameW' ? 'w' : 'h', layout)
				: SakugaSketch.arrange(nodes, groups, ids, key, command, layout);
		if (batch.ops.length) {
			post(batch);
		}
	}
	function sketchControls(parent = inspector) {
		const bar = document.createElement('div');
		bar.className = 'sketch-controls';
		bar.setAttribute('role', 'group');
		bar.setAttribute('aria-label', 'Align, distribute and size');
		for (const [command, label, key, path] of SKETCH_CONTROLS) {
			const b = document.createElement('button');
			b.type = 'button';
			b.title = `${label} (${key})`;
			b.setAttribute('aria-label', b.title);
			b.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="${path}"/></svg>`;
			b.disabled = command.startsWith('distribute') && SakugaSketch.units(nodes, groups, [...selN], layout).length < 3;
			b.onclick = () => {
				b.blur();
				sketchCommand(command);
			};
			bar.appendChild(b);
		}
		parent.appendChild(bar);
		const hint = document.createElement('p');
		hint.className = 'empty';
		hint.textContent = selN.has(keyObject)
			? `Reference: ${show(byId(keyObject).title) || keyObject}`
			: 'Shift/Ctrl+click sets a reference';
		parent.appendChild(hint);
	}
	function nextConnectedBox(below) {
		const n = selN.size === 1 && !selE.size && byId([...selN][0]);
		if (!isBox(n) || n.locked || n.hidden) return false;
		activeLayer = n.layer || activeLayer;
		const draft = SakugaSketch.nextBox(nodes, edges, { ...n, style: withoutOverrides(n) }, newId(), below, layout);
		freshBox = draft;
		nodes.push(draft.node);
		edges.push(draft.edge);
		selG = null;
		keyObject = null;
		selN = new Set([draft.node.id]);
		selE.clear();
		startEdit(draft.node.id);
		return true;
	}

	// The style of a box without the properties that differ from it.
	function withoutOverrides(n) {
		const def = styles.find((s) => s.key === n.cat),
			st = { ...n.style };
		for (const k of n.overrides || []) {
			if (def && def.props[k] !== undefined) {
				st[k] = def.props[k];
			} else {
				delete st[k];
			}
		}
		return st;
	}
	function startEdit(id) {
		const n = byId(id);
		if (!n) {
			return;
		}
		editing = id;
		const { w, h } = layout(n);
		const r = svg.getBoundingClientRect();
		Object.assign(input.style, {
			display: 'block',
			left: `${r.left + px(n.x - w / 2)}px`,
			top: `${r.top + py(n.y + h / 2)}px`,
			width: `${w * view.s}px`,
			height: `${h * view.s}px`,
			fontSize: `${TITLE_PT * PT * view.s}px`,
		});
		if (n.kind === 'icon') {
			Object.assign(input.style, {
				left: `${r.left + px(n.x + w / 2 + 1)}px`,
				top: `${r.top + py(n.y + 3)}px`,
				width: `${Math.max(25, textMm(show(n.title), fontPt(n), 'Sakuga Sans') + 4) * view.s}px`,
				height: `${6 * view.s}px`,
			});
		}
		input.value = show(n.title.split('\\\\').join(' / '));
		render();
		input.focus();
		input.select();
	}
	function startEdgeEdit(i) {
		const G = edges[i] && edgeGeom(edges[i]);
		if (!G) {
			return;
		}
		editing = `edge:${i}`;
		const r = svg.getBoundingClientRect(),
			w = 40;
		Object.assign(input.style, {
			display: 'block',
			left: `${r.left + px(G.label[0]) - (w * view.s) / 2}px`,
			top: `${r.top + py(G.label[1]) - 3 * view.s}px`,
			width: `${w * view.s}px`,
			height: `${6 * view.s}px`,
			fontSize: `${CODE_PT * PT * view.s}px`,
		});
		input.value = show(edges[i].label);
		etools.style.display = 'none';
		input.focus();
		input.select();
	}
	function endEdit(commit) {
		if (!editing) {
			return;
		}
		const id = editing;
		editing = null;
		input.style.display = 'none';
		if (freshBox && freshBox.node.id === id) {
			const draft = freshBox;
			freshBox = null;
			nodes = nodes.filter((n) => n.id !== id);
			edges = edges.filter((e) => e !== draft.edge);
			if (commit || input.value.trim()) {
				draft.batch.ops[0].title = input.value.split(' / ').map(tex).join('\\\\');
				selN = new Set([draft.edge.from]);
				pendingSelect = [id];
				post(draft.batch);
			} else {
				selN = new Set([draft.edge.from]);
			}
		} else if (commit && id.startsWith('edge:')) {
			post({ op: 'arrow', index: +id.slice(5), label: tex(input.value) });
		} else if (commit) {
			post({ op: 'batch', ops: [{ op: 'node', id, title: input.value.split(' / ').map(tex).join('\\\\') }] });
		}
		render();
	}
	input.addEventListener('keydown', (ev) => {
		if (ev.key === 'Enter') {
			endEdit(true);
			ev.preventDefault();
		}
		if (ev.key === 'Escape') {
			endEdit(false);
			ev.preventDefault();
		}
		ev.stopPropagation();
	});
	input.addEventListener('blur', () => endEdit(true));

	function edgeInside(e, x0, x1, y0, y1) {
		const a = endpointObject(e.from),
			b = endpointObject(e.to);
		if (!a || !b || a.hidden || b.hidden || a.locked || b.locked) {
			return false;
		}
		if (selN.has(e.from) && selN.has(e.to)) {
			return true;
		}
		const G = edgeGeom(e);
		if (!G) {
			return false;
		}
		const inside = ([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
		const segment = (p, q) => {
			let lo = 0,
				hi = 1;
			for (const [k, min, max] of [
				[0, x0, x1],
				[1, y0, y1],
			]) {
				const d = q[k] - p[k];
				if (!d) {
					if (p[k] < min || p[k] > max) {
						return false;
					}
				} else {
					const t0 = (min - p[k]) / d,
						t1 = (max - p[k]) / d;
					lo = Math.max(lo, Math.min(t0, t1));
					hi = Math.min(hi, Math.max(t0, t1));
					if (lo > hi) {
						return false;
					}
				}
			}
			return true;
		};
		// Subdivide the actual cubic, rejecting disjoint control hulls. This also
		// catches tangencies and tight bends that fixed-distance sampling can miss.
		const curve = (pts, depth = 0) => {
			const xs = pts.map((p) => p[0]),
				ys = pts.map((p) => p[1]);
			if (Math.max(...xs) < x0 || Math.min(...xs) > x1 || Math.max(...ys) < y0 || Math.min(...ys) > y1) {
				return false;
			}
			if (inside(pts[0]) || inside(pts[3])) {
				return true;
			}
			// Remaining hulls at this depth are below canvas precision.
			if (depth === 24) {
				return true;
			}
			const a = half(pts[0], pts[1]),
				b = half(pts[1], pts[2]),
				c = half(pts[2], pts[3]);
			const d = half(a, b),
				e = half(b, c),
				m = half(d, e);
			return curve([pts[0], a, d, m], depth + 1) || curve([m, e, c, pts[3]], depth + 1);
		};
		return G.curve ? curve(G.curve) : G.pts.slice(1).some((p, i) => segment(G.pts[i], p));
	}
	function nodeInside(n, x0, x1, y0, y1) {
		const { w, h } = layout(n);
		return !n.hidden && !n.locked && n.x - w / 2 >= x0 && n.x + w / 2 <= x1 && n.y - h / 2 >= y0 && n.y + h / 2 <= y1;
	}

	// Smart guides: snap the moved boxes to the edges and centres of the other boxes, as PowerPoint does.
	function guides(orig, dx, dy, lockX, lockY) {
		const tol = 6 / view.s;
		const boxes = [...orig.keys()].map((id) => {
			const o = orig.get(id),
				{ w, h } = layout(byId(id));
			return { x0: o.x + dx - w / 2, x1: o.x + dx + w / 2, y0: o.y + dy - h / 2, y1: o.y + dy + h / 2 };
		});
		const m = {
			x0: Math.min(...boxes.map((b) => b.x0)),
			x1: Math.max(...boxes.map((b) => b.x1)),
			y0: Math.min(...boxes.map((b) => b.y0)),
			y1: Math.max(...boxes.map((b) => b.y1)),
		};
		const xs = [m.x0, (m.x0 + m.x1) / 2, m.x1],
			ys = [m.y0, (m.y0 + m.y1) / 2, m.y1];
		let bx = null,
			by = null;
		for (const n of nodes) {
			if (orig.has(n.id)) {
				continue;
			}
			const { w, h } = layout(n);
			const ox = [n.x - w / 2, n.x, n.x + w / 2],
				oy = [n.y - h / 2, n.y, n.y + h / 2];
			for (const a of lockX ? [] : xs) {
				for (const c of ox) {
					if (Math.abs(c - a) < tol && (!bx || Math.abs(c - a) < Math.abs(bx.d))) {
						bx = { d: c - a, x: c, n, w, h };
					}
				}
			}
			for (const a of lockY ? [] : ys) {
				for (const c of oy) {
					if (Math.abs(c - a) < tol && (!by || Math.abs(c - a) < Math.abs(by.d))) {
						by = { d: c - a, y: c, n, w, h };
					}
				}
			}
		}
		const lines = [];
		const gx = bx ? bx.d : 0,
			gy = by ? by.d : 0;
		if (bx) {
			const v = [m.y0 + gy, m.y1 + gy, bx.n.y - bx.h / 2, bx.n.y + bx.h / 2];
			lines.push({ x: bx.x, a: Math.min(...v), b: Math.max(...v) });
		}
		if (by) {
			const v = [m.x0 + gx, m.x1 + gx, by.n.x - by.w / 2, by.n.x + by.w / 2];
			lines.push({ y: by.y, a: Math.min(...v), b: Math.max(...v) });
		}
		return { dx: gx, dy: gy, lines };
	}

	function fixedUpdate(e, pts) {
		const objects = nodes.map((n) => ({ ...n, ...layout(n) }));
		const side = (n, p) => {
			const options = [
				['west', Math.abs(p[0] - n.x + n.w / 2)],
				['east', Math.abs(p[0] - n.x - n.w / 2)],
				['south', Math.abs(p[1] - n.y + n.h / 2)],
				['north', Math.abs(p[1] - n.y - n.h / 2)],
			];
			return options.sort((a, b) => a[1] - b[1])[0][0];
		};
		const a = objects.find((n) => n.id === e.from) || endpointObject(e.from),
			b = objects.find((n) => n.id === e.to) || endpointObject(e.to),
			sa = side(a, pts[0]),
			sb = side(b, pts.at(-1));
		return {
			route: 'fixed',
			chain: null,
			waypoints: pts.slice(1, -1),
			fromAnchor: sa,
			toAnchor: sb,
			fromOffset: pts[0][/north|south/.test(sa) ? 0 : 1] - a[/north|south/.test(sa) ? 'x' : 'y'],
			toOffset: pts.at(-1)[/north|south/.test(sb) ? 0 : 1] - b[/north|south/.test(sb) ? 'x' : 'y'],
		};
	}
	svg.addEventListener('pointerdown', (ev) => {
		if (editing) {
			endEdit(true);
		}
		const p = toMm(ev);
		const t = ev.target;
		const ctrl = ev.ctrlKey || ev.metaKey;
		const additive = ctrl || ev.shiftKey;
		if (!t.dataset.label) delete selN.label;
		if (!additive && !ev.target.dataset.resize && !ev.target.dataset.scale) {
			keyObject = null;
		}
		if (ev.button !== 1 && !space) {
			selectedLayers.clear();
		}
		if (ev.button === 1 || space) {
			drag = { pan: true, sx: ev.clientX, sy: ev.clientY, ox: view.ox, oy: view.oy };
		} else if (t.dataset.label) {
			const ref = JSON.parse(t.dataset.label);
			selN.clear();
			selE.clear();
			selG = null;
			selN.label = ref;
			const target = labelTarget(ref);
			const geom = target.g
				? frameTitleGeom(target.g)
				: arrowLabelGeom(target.e, target.style, target.text, target.step);
			drag = { label: ref, orig: { ...target.style }, start: p, point: geom.p };
		} else if (t.classList.contains('locked-node')) {
			return;
		} else if (t.dataset.segment !== undefined) {
			const [index, j] = t.dataset.segment.split(':').map(Number),
				e = edges[index],
				pts = edgeGeom(e).pts.map((p) => p.slice());
			drag = { segment: index, j, pts, start: p, alt: ev.altKey };
		} else if (t.dataset.endpoint) {
			const [index, end] = t.dataset.endpoint.split(':');
			drag = { endpoint: +index, end, x: p.x, y: p.y };
		} else if (t.dataset.mid !== undefined) {
			const i = +t.dataset.mid,
				e = edges[i];
			drag = { mid: i, orig: { route: e.route, mid: e.mid, bend: e.bend }, r: edgeGeom(e).r };
		} else if (t.dataset.group) {
			selectLayer(t.dataset.group, additive);
			selN = new Set([...selN].filter((id) => !byId(id).hidden && !byId(id).locked));
			const orig = new Map(
				[...selN]
					.filter((id) => !byId(id).hidden && !byId(id).locked)
					.map((id) => [
						id,
						{ x: byId(id).x, y: byId(id).y, attachment: byId(id).attachment && { ...byId(id).attachment } },
					]),
			);
			if (!ctrl && orig.size) {
				drag = { move: true, x: p.x, y: p.y, orig, dx: 0, dy: 0, copy: ev.altKey };
			}
		} else if (t.dataset.scale) {
			const ids = [...selN].filter((id) => byId(id) && !byId(id).locked && !byId(id).hidden);
			drag = {
				scale: t.dataset.scale,
				x: p.x,
				y: p.y,
				b: selBox(ids),
				orig: new Map(
					ids.map((id) => {
						const n = byId(id);
						return [id, { x: n.x, y: n.y, width: n.width, minh: n.minh }];
					}),
				),
			};
		} else if (t.dataset.resize) {
			const [id, dir] = t.dataset.resize.split(':');
			const n = byId(id);
			drag = { resize: dir, id, x: p.x, y: p.y, w0: n.width, h0: layout(n).h, x0: n.x, y0: n.y };
		} else if (t.dataset.handle) {
			drag = {
				connect: t.dataset.handle,
				x: p.x,
				y: p.y,
				startX: p.x,
				startY: p.y,
				startAnchor: (() => {
					const n = byId(t.dataset.handle),
						d = [p.x - n.x, p.y - n.y];
					return Math.abs(d[0]) > Math.abs(d[1]) ? (d[0] > 0 ? 'east' : 'west') : d[1] > 0 ? 'north' : 'south';
				})(),
			};
		} else if (t.dataset.node) {
			const id = t.dataset.node;
			selG = null;
			if (additive) {
				if (selN.has(id) && !ev.shiftKey) {
					selN.delete(id);
					keyObject = null;
				} else {
					selN.add(id);
					keyObject = id;
				}
			} else if (!selN.has(id)) {
				selN = new Set([id]);
				selE = new Set();
			}
			if (!ctrl) {
				lastCat = byId(id).cat;
				const orig = new Map(
					[...selN]
						.filter((id) => !byId(id).locked && !byId(id).hidden)
						.map((k) => [
							k,
							{ x: byId(k).x, y: byId(k).y, attachment: byId(k).attachment && { ...byId(k).attachment } },
						]),
				);
				drag = { move: true, x: p.x, y: p.y, orig, dx: 0, dy: 0, copy: ev.altKey };
			}
		} else if (t.dataset.edge !== undefined) {
			selG = null;
			const i = +t.dataset.edge;
			if (!ctrl) {
				const G = edgeGeom(edges[i]);
				if (G && !G.curve && G.pts.every((p, j) => !j || p[0] === G.pts[j - 1][0] || p[1] === G.pts[j - 1][1])) {
					let best = Infinity,
						j = 0;
					for (let k = 0; k < G.pts.length - 1; k++) {
						const a = G.pts[k],
							b = G.pts[k + 1],
							x = Math.max(Math.min(a[0], b[0]), Math.min(Math.max(a[0], b[0]), p.x)),
							y = Math.max(Math.min(a[1], b[1]), Math.min(Math.max(a[1], b[1]), p.y)),
							d = Math.hypot(p.x - x, p.y - y);
						if (d < best) {
							best = d;
							j = k;
						}
					}
					drag = { segment: i, j, pts: G.pts.map((p) => p.slice()), start: p, alt: ev.altKey };
				}
			}
			if (ctrl) {
				if (selE.has(i)) {
					selE.delete(i);
				} else {
					selE.add(i);
				}
			} else {
				selN = new Set();
				selE = new Set([i]);
			}
		} else {
			selG = null;
			if (!ctrl) {
				selN = new Set();
				selE = new Set();
			}
			drag = { band: true, x0: p.x, y0: p.y, x1: p.x, y1: p.y, baseN: new Set(selN), baseE: new Set(selE) };
		}
		if (drag) {
			svg.setPointerCapture(ev.pointerId);
		}
		render();
	});
	svg.addEventListener('pointermove', (ev) => {
		const p = toMm(ev);
		if (!drag) {
			const h = nodeAt(p, 6);
			const id = h ? h.id : null;
			if (id !== hover) {
				hover = id;
				render();
			}
			return;
		}
		if (drag.pan) {
			moved = true;
			view.ox = drag.ox + ev.clientX - drag.sx;
			view.oy = drag.oy + ev.clientY - drag.sy;
		} else if (drag.label) {
			const target = labelTarget(drag.label),
				p2 = { x: drag.point[0] + p.x - drag.start.x, y: drag.point[1] + p.y - drag.start.y };
			let st;
			if (target.g) {
				const base = frameTitleGeom({ ...target.g, labelStyle: {} });
				st = { ...drag.orig, dx: fine(p2.x - base.p[0]), dy: fine(p2.y - base.p[1]) };
				for (const pos of ['above-left', 'above-center', 'inside-top-left', 'inside-top-right', 'below-left']) {
					const q = frameTitleGeom({ ...target.g, titlePosition: pos, labelStyle: {} });
					if (Math.hypot(p2.x - q.p[0], p2.y - q.p[1]) < 2) {
						target.g.titlePosition = pos;
						st.dx = 0;
						st.dy = 0;
						break;
					}
				}
			} else st = { ...drag.orig, ...projectLabel(target.e, p2, target.text, target.step) };
			if (target.g || drag.label.slot === undefined) (target.g || target.e).labelStyle = st;
			else target.e.labels[drag.label.slot].style = st;
			drag.changed = true;
		} else if (drag.move) {
			const free = ev.ctrlKey || ev.metaKey;
			let dx = free ? fine(p.x - drag.x) : snap(p.x - drag.x),
				dy = free ? fine(p.y - drag.y) : snap(p.y - drag.y);
			let lockX = false,
				lockY = false;
			if (ev.shiftKey) {
				if (Math.abs(dx) > Math.abs(dy)) {
					dy = 0;
					lockY = true;
				} else {
					dx = 0;
					lockX = true;
				}
			}
			drag.guides = [];
			if (!free) {
				const g = guides(drag.orig, dx, dy, lockX, lockY);
				dx += g.dx;
				dy += g.dy;
				drag.guides = g.lines;
			}
			drag.dx = dx;
			drag.dy = dy;
			drag.target = ev.altKey || drag.copy ? null : dropAnchor(p, [...drag.orig.keys()]);
			for (const [id, o] of drag.orig) {
				const n = byId(id);
				if (n) {
					n.x = drag.copy ? o.x : o.x + dx;
					n.y = drag.copy ? o.y : o.y + dy;
					if (o.attachment && !drag.copy) {
						const parentSelected = [...drag.orig.keys()].some((id) => descendant(n.id, id));
						n.attachment = {
							...o.attachment,
							dx: o.attachment.dx + (parentSelected ? 0 : dx),
							dy: o.attachment.dy + (parentSelected ? 0 : dy),
						};
					}
				}
			}
			resolveAttached();
		} else if (drag.segment !== undefined) {
			if (!drag.changed && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 0.4) return;
			const e = edges[drag.segment],
				j = drag.j;
			let pts = drag.pts.map((p) => p.slice());
			const last = pts.length - 2,
				h = Math.abs(pts[j][1] - pts[j + 1][1]) < 0.001;
			if (drag.alt) {
				const a = pts[j],
					b = pts[j + 1],
					axis = h ? 0 : 1,
					other = 1 - axis,
					c = a.map((v, k) => v + (b[k] - v) / 3),
					d = a.map((v, k) => v + (2 * (b[k] - v)) / 3),
					cc = c.slice(),
					dd = d.slice();
				cc[other] = dd[other] = h ? p.y : p.x;
				pts.splice(j + 1, 0, c, cc, dd, d);
			} else if (j === 0 || j === last) {
				const end = j === 0 ? 'from' : 'to',
					n = endpointObject(e[end]),
					box = { ...n, ...(n.frame ? {} : layout(n)) },
					side =
						e[end + 'Anchor'] ||
						(h
							? j === 0
								? pts[1][0] > pts[0][0]
									? 'east'
									: 'west'
								: pts.at(-2)[0] > pts.at(-1)[0]
									? 'east'
									: 'west'
							: j === 0
								? pts[1][1] > pts[0][1]
									? 'north'
									: 'south'
								: pts.at(-2)[1] > pts.at(-1)[1]
									? 'north'
									: 'south'),
					off = SakugaRoutes.snapPort(box, side, p, ev.altKey).offset,
					point = SakugaRoutes.port(box, side, off),
					axis = h ? 1 : 0;
				if (pts.length === 2) {
					const end = pts[1],
						mid = h ? (point[0] + end[0]) / 2 : (point[1] + end[1]) / 2;
					pts = h ? [point, [mid, point[1]], [mid, end[1]], end] : [point, [point[0], mid], [end[0], mid], end];
				} else {
					pts[j === 0 ? 0 : pts.length - 1] = point;
					pts[j === 0 ? 1 : pts.length - 2][axis] = point[axis];
				}
			} else {
				const axis = h ? 1 : 0;
				pts[j][axis] = pts[j + 1][axis] = fine(h ? p.y : p.x);
			}
			Object.assign(e, fixedUpdate(e, pts));
			drag.changed = true;
		} else if (drag.endpoint !== undefined) {
			drag.x = p.x;
			drag.y = p.y;
			drag.target = endpointTarget(p, ev.altKey);
		} else if (drag.mid !== undefined) {
			// dragging the middle of an arrow: move the middle segment, or bend the line
			const e = edges[drag.mid],
				a = endpointObject(e.from),
				b = endpointObject(e.to),
				t = drag.r.type;
			if (e.from === e.to) {
				const side = e.loopSide || 'north',
					h = /north|south/.test(side),
					sign = /north|east/.test(side) ? 1 : -1,
					n = { ...a, ...layout(a) },
					border = (h ? a.y : a.x) + (sign * (h ? n.h : n.w)) / 2;
				e.loopSize = Math.max(1, Math.abs((h ? p.y : p.x) - border) / 0.75);
				drag.changed = true;
				render();
				return;
			}
			if (t === 'hvh') {
				e.route = 'hvh';
				e.mid = snap(p.x);
			} else if (t === 'vhv') {
				e.route = 'vhv';
				e.mid = snap(p.y);
			} else {
				const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
				const nx = -(b.y - a.y) / len,
					ny = (b.x - a.x) / len;
				const off = (p.x - (a.x + b.x) / 2) * nx + (p.y - (a.y + b.y) / 2) * ny;
				const sn = Math.max(-0.95, Math.min(0.95, off / (0.294 * len)));
				e.route = 'bend';
				e.bend = Math.round((Math.asin(sn) * 180) / Math.PI);
			}
			drag.changed = true;
		} else if (drag.scale) {
			const d = drag.scale,
				b = drag.b,
				W = b.x1 - b.x0,
				H = b.y1 - b.y0;
			const dx = p.x - drag.x,
				dy = p.y - drag.y;
			let sx = 1,
				sy = 1,
				ax = b.x0,
				ay = b.y0;
			if (d.includes('e')) {
				sx = (W + dx) / W;
				ax = b.x0;
			}
			if (d.includes('w')) {
				sx = (W - dx) / W;
				ax = b.x1;
			}
			if (d.includes('n')) {
				sy = (H + dy) / H;
				ay = b.y0;
			}
			if (d.includes('s')) {
				sy = (H - dy) / H;
				ay = b.y1;
			}
			if (ev.shiftKey && d.length === 2) {
				sx = sy = Math.max(sx, sy);
			}
			sx = Math.max(0.1, sx);
			sy = Math.max(0.1, sy);
			for (const [id, o] of drag.orig) {
				const n = byId(id);
				n.x = ax + (o.x - ax) * sx;
				n.y = ay + (o.y - ay) * sy;
				n.width = Math.max(6, o.width * sx);
				if (o.minh) {
					n.minh = o.minh * sy;
				}
			}
			drag.changed = true;
		} else if (drag.resize) {
			const n = byId(drag.id);
			const dx = snap(p.x - drag.x),
				dy = snap(p.y - drag.y),
				d = drag.resize;
			let w = drag.w0,
				h = drag.h0,
				x = drag.x0,
				y = drag.y0;
			if (d.includes('e')) {
				w = Math.max(6, drag.w0 + dx);
				x = drag.x0 + (w - drag.w0) / 2;
			}
			if (d.includes('w')) {
				w = Math.max(6, drag.w0 - dx);
				x = drag.x0 - (w - drag.w0) / 2;
			}
			if (d.includes('n')) {
				h = Math.max(4, drag.h0 + dy);
				y = drag.y0 + (h - drag.h0) / 2;
			}
			if (d.includes('s')) {
				h = Math.max(4, drag.h0 - dy);
				y = drag.y0 - (h - drag.h0) / 2;
			}
			n.width = w;
			n.x = x;
			n.y = y;
			if (d.includes('n') || d.includes('s')) {
				n.minh = h;
			}
			drag.changed = true;
		} else if (drag.band) {
			drag.x1 = p.x;
			drag.y1 = p.y;
			const x0 = Math.min(drag.x0, drag.x1),
				x1 = Math.max(drag.x0, drag.x1);
			const y0 = Math.min(drag.y0, drag.y1),
				y1 = Math.max(drag.y0, drag.y1);
			selN = new Set([...drag.baseN, ...nodes.filter((n) => nodeInside(n, x0, x1, y0, y1)).map((n) => n.id)]);
			selE = new Set([
				...drag.baseE,
				...edges.map((e, i) => (edgeInside(e, x0, x1, y0, y1) ? i : -1)).filter((i) => i >= 0),
			]);
		} else if (drag.connect) {
			drag.x = p.x;
			drag.y = p.y;
		}
		render();
	});
	svg.addEventListener('pointerup', (ev) => {
		const d = drag;
		drag = null;
		if (d?.segment !== undefined && d.changed) {
			post({ op: 'arrow', index: d.segment, ...fixedUpdate(edges[d.segment], edgeGeom(edges[d.segment]).pts) });
		} else if (d?.label && d.changed) {
			const target = labelTarget(d.label);
			post(
				target.g
					? {
							op: 'batch',
							ops: [
								{ op: 'label', ...d.label, style: target.style },
								{ op: 'groupProps', id: target.g.id, titlePosition: target.g.titlePosition },
							],
						}
					: { op: 'label', ...d.label, style: target.style },
			);
		} else if (d && d.endpoint !== undefined) {
			const target = endpointTarget(toMm(ev), ev.altKey);
			if (target)
				post({
					op: 'arrow',
					index: d.endpoint,
					[d.end]: target.id,
					[d.end + 'Anchor']: target.anchor,
					[d.end + 'Offset']: target.offset ?? 0,
				});
		} else if (d && d.move && (d.dx || d.dy)) {
			if (d.copy) {
				duplicate([...d.orig.keys()], d.dx, d.dy);
			} else {
				const ops = [...d.orig.keys()].map((id) => ({ op: 'move', id, x: byId(id).x, y: byId(id).y }));
				if (!ev.altKey && d.orig.size === 1) {
					const id = [...d.orig.keys()][0],
						n = byId(id),
						drop = labelDrop(toMm(ev), n);
					if (drop) {
						ops.push({ op: 'attachLabel', id, ...drop });
						d.target = null;
					}
				}
				if (d.target && !ev.altKey) {
					for (const id of d.orig.keys()) {
						if (
							byId(id).attachment?.parent === d.target.parent.id ||
							[...d.orig.keys()].some((parent) => descendant(id, parent))
						) {
							continue;
						}
						ops.push({ op: 'attach', id, attachment: attachmentFor(byId(id), d.target.parent, d.target.anchor) });
					}
				}
				post({ op: 'batch', ops });
			}
		} else if (d && d.mid !== undefined && d.changed) {
			const e = edges[d.mid];
			post({
				op: 'arrow',
				index: d.mid,
				route: e.route,
				mid: e.mid,
				bend: e.bend,
				...(e.from === e.to ? { loopSize: e.loopSize } : {}),
			});
		} else if (d && d.scale && d.changed) {
			const ops = [];
			for (const id of d.orig.keys()) {
				const n = byId(id);
				ops.push(
					{ op: 'node', id, width: fine(n.width), ...(n.minh ? { minh: fine(n.minh) } : {}) },
					{ op: 'move', id, x: fine(n.x), y: fine(n.y) },
				);
			}
			post({ op: 'batch', ops });
		} else if (d && d.resize && d.changed) {
			const n = byId(d.id);
			const ops = [
				{ op: 'node', id: n.id, width: n.width, ...(/[ns]/.test(d.resize) ? { minh: n.minh } : {}) },
				{ op: 'move', id: n.id, x: n.x, y: n.y },
			];
			post({ op: 'batch', ops });
		} else if (d && d.connect) {
			const from = byId(d.connect);
			const endpoint = endpointTarget(toMm(ev));
			if (endpoint && endpoint.id === from.id) {
				post({ op: 'addEdge', from: from.id, to: from.id, route: 'loop', loopSide: endpoint.anchor });
				render();
				return;
			}
			if (endpoint && endpoint.id !== from.id) {
				const start = endpointTarget({ x: d.startX ?? from.x, y: d.startY ?? from.y });
				post({
					op: 'addEdge',
					from: from.id,
					to: endpoint.id,
					fromAnchor: d.startAnchor || start?.anchor,
					toAnchor: endpoint.anchor,
					fromOffset: start?.offset ?? 0,
					toOffset: endpoint.offset ?? 0,
				});
				render();
				return;
			}
			const target = nodeAt(toMm(ev));
			if (target && target.kind !== 'icon' && target.id !== from.id) {
				post({ op: 'addEdge', from: from.id, to: target.id });
			} else if (!target) {
				const id = newId();
				pendingEdit = id;
				post({
					op: 'addNode',
					id,
					x: snap(d.x),
					y: snap(d.y),
					title: 'Box',
					cat: from.cat,
					width: from.width,
					from: from.id,
				});
			}
		}
		render();
	});
	svg.addEventListener('dblclick', (ev) => {
		const p = toMm(ev);
		const t = ev.target;
		if (t.dataset.corner !== undefined) {
			const [index, j] = t.dataset.corner.split(':').map(Number),
				e = edges[index],
				pts = SakugaRoutes.removeCorner(edgeGeom(e).pts, j);
			post({ op: 'arrow', index, ...fixedUpdate(e, pts) });
			return;
		}
		if (t.dataset.label) {
			selN.label = JSON.parse(t.dataset.label);
			render();
			return;
		}
		if (t.dataset.group || t.classList.contains('locked-node')) {
			return;
		}
		if (t.dataset.edge !== undefined || t.dataset.mid !== undefined) {
			startEdgeEdit(+(t.dataset.edge ?? t.dataset.mid));
			return;
		}
		const n = t.dataset.node ? byId(t.dataset.node) : nodeAt(p);
		if (n) {
			startEdit(n.id);
		} else {
			const id = newId();
			pendingEdit = id;
			post({ op: 'addNode', id, x: snap(p.x), y: snap(p.y), title: 'Box', cat: catOf(lastCat) ? lastCat : '' });
		}
	});
	svg.addEventListener(
		'wheel',
		(ev) => {
			ev.preventDefault();
			moved = true;
			if (ev.ctrlKey) {
				const r = svg.getBoundingClientRect();
				const mx = ev.clientX - r.left,
					my = ev.clientY - r.top;
				const s = Math.min(30, Math.max(1, view.s * Math.exp(-ev.deltaY * 0.002)));
				view.ox = mx - ((mx - view.ox) * s) / view.s;
				view.oy = my - ((my - view.oy) * s) / view.s;
				view.s = s;
			} else {
				view.ox -= ev.deltaX;
				view.oy -= ev.deltaY;
			}
			render();
		},
		{ passive: false },
	);

	document.addEventListener('keydown', (ev) => {
		if (floating || editing || isTyping()) {
			return;
		}
		if (ev.key === ' ') {
			space = true;
			svg.classList.add('panning');
			ev.preventDefault();
			return;
		}
		if (ev.isComposing || ev.key === 'Dead' || ev.key === 'Process') {
			return;
		}
		const ctrl = ev.ctrlKey || ev.metaKey;
		const k = ev.key.toLowerCase();
		const ids = [...selN].filter(byId),
			ix = [...selE].filter((i) => edges[i]);
		const one = ids.length === 1 && ix.length === 0 ? byId(ids[0]) : null;
		if (ev.altKey && !ctrl && !ev.shiftKey && k === 't') {
			ev.preventDefault();
			tidyHeld = true;
			previewTidy();
			return;
		}
		if (ev.key === 'Escape' && tidyPreview) {
			ev.preventDefault();
			cancelTidy();
			return;
		}
		const alignment =
			ev.altKey && !ctrl && !ev.shiftKey && SKETCH_CONTROLS.find((c) => c[2].toLowerCase() === `alt+${k}`);
		if (alignment) {
			sketchCommand(alignment[0]);
		} else if (
			ctrl &&
			!ev.altKey &&
			(ev.code === 'BracketRight' || ev.code === 'BracketLeft') &&
			(ids.length || selG)
		) {
			const current = layers.findIndex((l) => l.id === (one?.layer || activeLayer)),
				target = layers[current + (ev.code === 'BracketRight' ? 1 : -1)];
			if (target) {
				moveToLayer(selectedRoots(), target.id);
			}
		} else if (ctrl && ev.altKey && ev.code === 'KeyC') {
			copyStyle();
		} else if (ctrl && ev.altKey && ev.code === 'KeyV') {
			pasteStyle();
		} else if (ctrl && !ev.altKey && k === 'g') {
			if (ev.shiftKey) {
				ungroupSelection();
			} else {
				groupSelection();
			}
		} else if (ctrl && !ev.altKey && k === 'a') {
			keyObject = null;
			selG = null;
			selN = new Set(nodes.filter((n) => !n.hidden && !n.locked).map((n) => n.id));
			selE = new Set(edges.map((_, i) => i));
			render();
		} else if (ctrl && !ev.altKey && k === 'd') {
			if (ids.length) {
				duplicate(ids, 5, -5);
			}
		} else if (ctrl || ev.altKey) {
			return;
		} else if (ev.shiftKey && ev.code === 'Digit1') {
			fit();
			render();
		} else if (one && ev.key === 'Tab' && nextConnectedBox(ev.shiftKey)) {
		} else if (one && !one.locked && (ev.key === 'Enter' || ev.key === 'F2')) {
			startEdit(one.id);
		} else if (ids.length && !ev.shiftKey && /^Digit[1-9]$/.test(ev.code) && cats[+ev.code.slice(5) - 1]) {
			lastCat = cats[+ev.code.slice(5) - 1].key;
			post({ op: 'batch', ops: ids.map((id) => ({ op: 'node', id, cat: lastCat })) });
		} else if (ids.length && ev.key.startsWith('Arrow')) {
			const step = ev.shiftKey ? 5 : 1;
			const dx = { ArrowLeft: -step, ArrowRight: step }[ev.key] || 0;
			const dy = { ArrowDown: -step, ArrowUp: step }[ev.key] || 0;
			post({
				op: 'batch',
				ops: ids
					.filter((id) => !byId(id).locked)
					.map((id) => ({ op: 'move', id, x: byId(id).x + dx, y: byId(id).y + dy })),
			});
		} else if (ix.length && k === 'r') {
			const order = ROUTE_OPTS.map((o) => o[0]);
			const route = order[(order.indexOf(edges[ix[0]].route) + 1) % order.length];
			post({ op: 'batch', ops: ix.map((i) => ({ op: 'arrow', index: i, route, mid: null, bend: 0 })) });
		} else if (ix.length && k === 'd') {
			const kind = ix.every((i) => edges[i].kind === 'arr-dashed') ? 'arr' : 'arr-dashed';
			post({ op: 'batch', ops: ix.map((i) => ({ op: 'arrow', index: i, kind })) });
		} else if ((ids.length || ix.length || selN.label) && (ev.key === 'Delete' || ev.key === 'Backspace')) {
			deleteSelection();
		} else if (ev.key === 'Escape') {
			delete selN.label;
			keyObject = null;
			selectedLayers.clear();
			selG = null;
			selN = new Set();
			selE = new Set();
			render();
		} else if (
			one &&
			!one.locked &&
			!one.hidden &&
			(isBox(one) || one.kind === 'label') &&
			Array.from(ev.key).length === 1 &&
			!'dr'.includes(k)
		) {
			startEdit(one.id);
			input.value = ev.key;
			input.setSelectionRange(input.value.length, input.value.length);
		} else {
			return;
		}
		ev.preventDefault();
	});
	document.addEventListener('keyup', (ev) => {
		if (tidyHeld && (ev.key.toLowerCase() === 't' || ev.key === 'Alt')) {
			ev.preventDefault();
			applyTidy();
			return;
		}
		if (ev.key === ' ') {
			space = false;
			svg.classList.remove('panning');
		}
	});
	// Ctrl+C, Ctrl+X and Ctrl+V reach the page as clipboard events; the clipboard holds TikZ lines.
	document.addEventListener('copy', (ev) => {
		if (editing || isTyping()) {
			return;
		}
		const t = clip();
		if (!t) {
			return;
		}
		ev.clipboardData.setData('text/plain', t);
		ev.preventDefault();
	});
	document.addEventListener('cut', (ev) => {
		if (editing || isTyping()) {
			return;
		}
		const t = clip();
		if (!t) {
			return;
		}
		ev.clipboardData.setData('text/plain', t);
		ev.preventDefault();
		deleteSelection();
	});
	document.addEventListener('paste', (ev) => {
		if (editing || isTyping()) {
			return;
		}
		const t = ev.clipboardData.getData('text/plain');
		if (!t || !/\\(node|draw|pic)\[/.test(t)) {
			return;
		}
		ev.preventDefault();
		pasteCount = t === lastPaste ? pasteCount + 1 : 1;
		lastPaste = t;
		vscode.postMessage({ type: 'paste', layer: activeLayer, text: t, dx: 5 * pasteCount, dy: -5 * pasteCount });
	});

	// Fit the content (boxes, arrows, frames, legend) into the canvas.
	function fit() {
		const r = svg.getBoundingClientRect(),
			C = contentBox(),
			pad = 40;
		const w = Math.max(1, C.x1 - C.x0),
			h = Math.max(1, C.y1 - C.y0);
		view.s = Math.max(1, Math.min(14, (r.width - 2 * pad) / w, (r.height - 2 * pad) / h));
		view.ox = r.width / 2 - ((C.x0 + C.x1) / 2) * view.s;
		view.oy = r.height / 2 + ((C.y0 + C.y1) / 2) * view.s;
	}

	window.addEventListener('message', (ev) => {
		const m = ev.data;
		if (m.type === 'sketch') {
			if (m.command === 'tidy' && !m.preview) {
				if (!floating && !editing && !isTyping()) applyTidy();
			} else sketchCommand(m.command);
			return;
		}
		if (m.type === 'icons') {
			icons = m.icons;
			buildIconPanel();
			render();
			return;
		}
		if (m.type === 'select') {
			pendingSelect = m.ids;
		}
		if (m.type !== 'state') {
			if (pendingSelect && pendingSelect.every(byId)) {
				selG = null;
				selN = new Set(pendingSelect.filter((id) => byId(id) && !byId(id).hidden && !byId(id).locked));
				selE = new Set();
				pendingSelect = null;
				render();
			}
			return;
		}
		tidyPreview = null;
		tidyHeld = false;

		figureFont = m.font || 'small';
		showText(m.text);
		for (const id of selectedLayers) {
			if (!(m.layers || []).some((l) => l.id === id)) {
				selectedLayers.delete(id);
			}
		}
		layers = m.layers || [{ id: 'layer1', name: 'Layer 1', hidden: false, locked: false }];
		if (!layers.some((l) => l.id === activeLayer)) {
			activeLayer = layers[0].id;
		}
		nodes = m.nodes;
		groups = m.groups || [];
		if (selN.label?.group && !groups.some((g) => g.id === selN.label.group)) delete selN.label;
		if (!groupById(selG) || members(selG).every((id) => byId(id).locked || byId(id).hidden)) {
			selG = null;
		}
		edges = m.edges;
		if (freshBox) {
			nodes.push(freshBox.node);
			edges.push(freshBox.edge);
		}
		cats = m.categories;
		styles = m.styles || [];
		shared = m.shared || [];
		if (pendingStyleFocus) {
			const made = styles.find((s) => s.name === pendingStyleFocus);
			if (made) {
				openStyles.add(made.key);
				setTab('figure');
				setTimeout(() => document.querySelector(`[data-style-name="${made.key}"]`)?.select(), 0);
				pendingStyleFocus = null;
			}
		}
		legend = m.legend;
		arrowsStyle = m.arrows || 'manhattan';
		palette = m.palette;
		defaultWidth = m.defaultWidth;
		if (!fitted) {
			fit();
			fitted = true;
		}
		const selectedAttached = selN.label;
		selN = new Set([...selN].filter((id) => byId(id) && !byId(id).locked && !byId(id).hidden));
		if (selectedAttached) selN.label = selectedAttached;
		if (selN.label && !labelTarget()) delete selN.label;
		selE = new Set([...selE].filter((k) => edges[k]));
		if (pendingSelect && pendingSelect.every(byId)) {
			selG = null;
			selN = new Set(pendingSelect.filter((id) => byId(id) && !byId(id).hidden && !byId(id).locked));
			selE = new Set();
			pendingSelect = null;
		}
		render();
		if (pendingEdit && byId(pendingEdit) && !byId(pendingEdit).hidden && !byId(pendingEdit).locked) {
			selN = new Set([pendingEdit]);
			selE = new Set();
			startEdit(pendingEdit);
			pendingEdit = null;
		}
	});
	new ResizeObserver(() => {
		if (!fitted) {
			return;
		}
		if (!moved) {
			fit();
		}
		render();
	}).observe(document.getElementById('desk'));
	document.getElementById('fitw').addEventListener('click', () => {
		moved = false;
		fit();
		render();
	});
	document.getElementById('addLabel').addEventListener('click', () => {
		const r = svg.getBoundingClientRect(),
			id = newId();
		pendingEdit = id;
		post({
			op: 'addNode',
			kind: 'label',
			id,
			title: 'Label',
			cat: '',
			width: 18,
			x: snap((r.width / 2 - view.ox) / view.s),
			y: snap((view.oy - r.height / 2) / view.s),
		});
	});

	document.getElementById('addIcon').append(
		iconPicker('', (icon) => {
			if (!icon) {
				return;
			}
			const r = svg.getBoundingClientRect(),
				id = newId();
			pendingSelect = [id];
			post({
				op: 'addNode',
				kind: 'icon',
				id,
				icon,
				x: snap((r.width / 2 - view.ox) / view.s),
				y: snap((view.oy - r.height / 2) / view.s),
				width: 8,
				minh: 8,
				title: '',
				cat: '',
				layer: activeLayer,
			});
		}),
	);
	document.getElementById('copySrc').addEventListener('click', () => vscode.postMessage({ type: 'copy' }));
	document.getElementById('exportSvg').addEventListener('click', () => vscode.postMessage({ type: 'exportSvg' }));
	document
		.getElementById('copyPre')
		.addEventListener('click', () =>
			vscode.postMessage({ type: 'copyText', text: document.getElementById('pre').textContent }),
		);

	// The TikZ text: what you see here is what gets copied; typing or pasting redraws the canvas.
	let sent = null,
		timer = null;
	src.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			sent = src.value;
			vscode.postMessage({ type: 'text', text: src.value });
		}, 200);
	});
	function showText(t) {
		if (src.value === t) {
			return;
		}
		if (document.activeElement === src && sent !== null && src.value !== sent) {
			return;
		}
		const a = src.selectionStart,
			b = src.selectionEnd,
			top = src.scrollTop;
		src.value = t;
		src.setSelectionRange(Math.min(a, t.length), Math.min(b, t.length));
		src.scrollTop = top;
	}

	// ---- layout v2: tabs, drawer, splitter ----
	const $ = (id) => document.getElementById(id);
	const persist = (o) => vscode.setState({ ...vscode.getState(), ...o });
	let lastInspectorSelection = '',
		tab = (vscode.getState() || {}).tab || 'figure';
	function setTab(t, save = true) {
		tab = t;
		$('sidebar').dataset.tab = t;
		for (const b of document.querySelectorAll('#tabs [role=tab]')) {
			b.setAttribute('aria-selected', String(b.dataset.tab === t));
			b.tabIndex = b.dataset.tab === t ? 0 : -1;
		}
		if (save) {
			persist({ tab: t });
		}
	}
	for (const b of document.querySelectorAll('#tabs [role=tab]')) {
		b.addEventListener('click', () => setTab(b.dataset.tab));
		b.addEventListener('keydown', (ev) => {
			if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
			ev.preventDefault();
			const next =
				ev.key === 'Home' ? 'figure' : ev.key === 'End' ? 'selection' : tab === 'figure' ? 'selection' : 'figure';
			setTab(next);
			document.querySelector('#tabs [data-tab=' + next + ']').focus();
		});
	}
	setTab(tab, false);
	function setDrawer(open, save = true) {
		$('drawer').classList.toggle('open', open);
		$('drawerToggle').setAttribute('aria-pressed', String(open));
		$('drawerToggle').setAttribute('aria-expanded', String(open));
		$('drawer').inert = !open;
		if (save) {
			persist({ drawer: open });
		}
	}
	$('drawerToggle').addEventListener('click', () => setDrawer(!$('drawer').classList.contains('open')));
	setDrawer(!!(vscode.getState() || {}).drawer, false);
	$('addBox').addEventListener('click', () => document.querySelector('.lc-obj')?.click());
	const split = $('splitter');
	if (split) {
		const lay = $('layers');
		const h0 = (vscode.getState() || {}).layersH;
		if (h0) {
			lay.style.height = h0 + 'px';
		}
		split.addEventListener('pointerdown', (ev) => {
			split.setPointerCapture(ev.pointerId);
			const y0 = ev.clientY,
				hh = lay.offsetHeight,
				max = $('sidebar').clientHeight - 34 - 160;
			const mv = (e) => {
				lay.style.height = Math.max(96, Math.min(max, hh + y0 - e.clientY)) + 'px';
			};
			const up = () => {
				split.removeEventListener('pointermove', mv);
				split.removeEventListener('pointerup', up);
				split.removeEventListener('pointercancel', up);
				persist({ layersH: lay.offsetHeight });
			};
			split.addEventListener('pointermove', mv);
			split.addEventListener('pointerup', up);
			split.addEventListener('pointercancel', up);
		});
		split.addEventListener('keydown', (ev) => {
			if (!['ArrowUp', 'ArrowDown', 'Home'].includes(ev.key)) return;
			ev.preventDefault();
			lay.style.height =
				ev.key === 'Home'
					? ''
					: Math.max(
							96,
							Math.min($('sidebar').clientHeight - 194, lay.offsetHeight + (ev.key === 'ArrowUp' ? 16 : -16)),
						) + 'px';
			persist({ layersH: ev.key === 'Home' ? 0 : lay.offsetHeight });
		});
		split.addEventListener('dblclick', () => {
			lay.style.height = '';
			persist({ layersH: 0 });
		});
	}

	// Test hook (S0): inert unless a test sets window.__sakugaTestHook = true before this script loads.
	if (window.__sakugaTestHook === true) {
		window.__sakugaTest = {
			layout,
			boxHalf,
			resolveRoute,
			baseEdgeGeom,
			edgeGeom,
			arrowLabelGeom,
			frameRect,
			frameTitleGeom,
			contentBox,
			state: () => ({ nodes, edges, groups, figureFont, arrowsStyle }),
			setView: (v) => {
				Object.assign(view, v);
				moved = true;
			},
			render,
			// Read-only accessors for the interaction tests (S2).
			selection: () => ({ nodes: [...selN], edges: [...selE], group: selG, label: selN.label ?? null, key: keyObject }),
			drag: () => drag,
			editing: () => editing,
			tidyPreview: () => tidyPreview,
			view: () => view,
		};
	}

	Promise.all([document.fonts.load(`12px 'Sakuga Sans'`), document.fonts.load(`12px 'Sakuga Mono'`)]).finally(() =>
		vscode.postMessage({ type: 'ready' }),
	);
})();
