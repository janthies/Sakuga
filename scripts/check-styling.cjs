// Run after npm run compile. Builds a real figure, verifies model operations and compiles it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tikz = require('../out/tikz.js');
const root = path.resolve(__dirname, '..');
const fig = tikz.parse(tikz.TEMPLATE);
const apply = (op) => tikz.apply(fig, op);
const shapes = ['', 'rectangle', 'pill', 'ellipse', 'circle', 'diamond', 'cylinder'];
apply({ op: 'addLayer', id: 'top', name: 'Shapes' });
for (const [i, shape] of shapes.entries()) {
	const id = `shape${i}`;
	apply({
		op: 'addNode',
		id,
		layer: 'top',
		x: (i % 3) * 45,
		y: -Math.floor(i / 3) * 45,
		title: 'Typography',
		cat: 'work',
	});
	apply({
		op: 'style',
		ids: [id],
		style: { shape, font: tikz.FONT_SIZES[i % 5], text: i % 2 ? 'bold' : 'italic', color: 'accent', weight: 'medium' },
	});
}
apply({ op: 'addGroup', id: 'outer', name: 'Outer', frame: 'dashed', color: 'blue', parent: '' });
apply({ op: 'addGroup', id: 'inner', name: 'Inner', frame: 'none', color: 'blue', parent: 'outer' });
apply({ op: 'setGroup', ids: ['shape0', 'shape1'], group: 'inner' });
for (let i = 0; i < 2; i++) {
	apply({ op: 'addEdge', from: `shape${i}`, to: `shape${i + 3}`, label: 'Test' });
	apply({
		op: 'style',
		indices: [i],
		style: {
			start: 'circle',
			end: i ? 'triangle' : 'Stealth',
			border: i ? 'dotted' : 'dashed',
			color: 'accent',
			weight: 'thick',
			position: 'start',
			side: 'above',
		},
	});
}
apply({ op: 'batch', ops: [{ op: 'duplicateLayer', id: 'top', newId: 'copy' }] });
assert.equal(tikz.nodes(fig).length, shapes.length * 2);
assert.equal(tikz.edges(fig).length, 4);
assert.equal(tikz.groups(fig).length, 4);
assert.deepEqual(
	tikz.layers(fig).map((l) => l.id),
	['layer1', 'top', 'copy'],
);
assert.equal(tikz.layers(fig)[2].name, 'Shapes copy');
for (const n of tikz.nodes(fig).filter((n) => n.layer === 'top')) {
	const copy = tikz.nodes(fig).find((c) => c.id === `${n.id}-copy`);
	assert.equal(copy.x, n.x);
	assert.equal(copy.y, n.y);
	assert.deepEqual(copy.style, n.style);
	if (n.group) {
		assert.equal(copy.group, `${n.group}-copy`);
	}
	assert.notEqual(copy.style, n.style);
}
assert.equal(tikz.groups(fig).find((g) => g.id === 'inner-copy').parent, 'outer-copy');
apply({ op: 'batch', ops: [{ op: 'setLayer', ids: ['outer-copy'], layer: 'layer1' }] });
assert(
	tikz
		.nodes(fig)
		.filter((n) => n.group === 'inner-copy')
		.every((n) => n.layer === 'layer1'),
);
apply({ op: 'batch', ops: [{ op: 'mergeLayers', ids: ['top', 'copy'], target: 'top' }] });
assert.equal(tikz.layers(fig).length, 2);
assert(!tikz.nodes(fig).some((n) => n.layer === 'copy'));
apply({ op: 'font', size: 'large' });
// Dedicated plain boxes let LuaLaTeX report the actual height at each size.
for (const [i, font] of tikz.FONT_SIZES.entries()) {
	const id = `font${i}`;
	apply({
		op: 'addNode',
		id,
		layer: 'top',
		x: (i % 3) * 45,
		y: -140 - Math.floor(i / 3) * 20,
		title: 'Typography',
		cat: 'work',
	});
	apply({ op: 'style', ids: [id], style: { font } });
}
const cleanStyle = (style) => Object.fromEntries(Object.entries(style || {}).filter(([, v]) => v));
const serialized = tikz.serialize(fig);
const parsed = tikz.parse(serialized);
assert.equal(tikz.serialize(parsed), serialized);
for (const n of tikz.nodes(fig)) {
	assert.deepEqual(cleanStyle(tikz.nodes(parsed).find((p) => p.id === n.id).style), cleanStyle(n.style));
}
for (const [i, e] of tikz.edges(fig).entries()) {
	assert.deepEqual(tikz.edges(parsed)[i].style, e.style);
}
const pasted = tikz.pasteOps(tikz.parse(tikz.TEMPLATE), serialized, 5, -5);
const pasteFigure = tikz.parse(tikz.TEMPLATE);
tikz.apply(pasteFigure, { op: 'batch', ops: pasted.ops });
assert.deepEqual(tikz.nodes(pasteFigure)[0].style, tikz.nodes(parsed)[0].style);
assert.deepEqual(tikz.edges(pasteFigure)[0].style, tikz.edges(parsed)[0].style);
// Every available tip and every font size must parse into fields rather than unknown extras.
for (const end of ['Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar', 'none']) {
	const test = tikz.parse(serialized);
	tikz.apply(test, { op: 'style', indices: [0], style: { start: 'bar', end } });
	const output = tikz.serialize(test),
		roundTrip = tikz.parse(output);
	assert.equal(tikz.edges(roundTrip)[0].style.end, end);
	assert.equal(tikz.serialize(roundTrip), output);
}
for (const route of ['auto', 'straight', 'manhattan', 'curved', 'bend', 'hvh', 'vhv']) {
	const test = tikz.parse(serialized);
	tikz.apply(test, { op: 'arrow', index: 0, route, bend: 25, mid: 20 });
	const output = tikz.serialize(test),
		roundTrip = tikz.parse(output);
	assert.equal(tikz.edges(roundTrip).length, 4, route);
	assert.equal(tikz.edges(roundTrip)[0].route, route);
	assert.equal(tikz.serialize(roundTrip), output);
}
// Changing one tip preserves the independently styled other tip.
const tips = tikz.parse(serialized);
tikz.apply(tips, { op: 'style', indices: [0], style: { start: 'bar' } });
assert.equal(tikz.edges(tips)[0].style.end, 'Stealth');
const defaults = tikz.parse(tikz.TEMPLATE);
tikz.apply(defaults, { op: 'addNode', id: 'plain', x: 0, y: 0, title: 'Box', cat: 'work' });
assert.match(tikz.serialize(defaults), /\\node\[sg style\/work, sg layer=layer1\]/);
assert.match(tikz.serialize(tikz.parse('\\begin{tikzpicture}\n\\end{tikzpicture}')), /font=\\sffamily\\small/);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakuga-style-check-'));
fs.writeFileSync(path.join(dir, 'figure.tikz'), serialized);
const probes = tikz.FONT_SIZES.map(
	(font, i) =>
		String.raw`\pgfextracty{\dimen0}{\pgfpointanchor{font${i}}{north}}\pgfextracty{\dimen2}{\pgfpointanchor{font${i}}{south}}\advance\dimen0 by -\dimen2\typeout{SAKUGA-${font}=\the\dimen0}`,
).join('\n');
const preamble = String.raw`\documentclass[11pt,border=1mm]{standalone}
\usepackage{fontspec}
\setsansfont{OpenSans-Regular.ttf}[Path=${root}/media/,AutoFakeBold=2,AutoFakeSlant=0.2]
\setmonofont{texgyrecursor-regular.otf}[Path=${root}/media/]
\usepackage{tikz}
\usetikzlibrary{arrows.meta,fit,backgrounds,svg.path,shapes.geometric}
\begin{document}
`;
fs.writeFileSync(
	path.join(dir, 'figure.tex'),
	preamble + serialized.replace('\\end{tikzpicture}', probes + '\n\\end{tikzpicture}') + '\n\\end{document}',
);
const cache = path.join(dir, 'tex-cache');
fs.mkdirSync(cache);
execFileSync('nice', ['-n', '19', 'lualatex', '-interaction=batchmode', '-halt-on-error', 'figure.tex'], {
	cwd: dir,
	env: { ...process.env, TEXMFVAR: cache, TEXMFCACHE: cache },
	timeout: 120000,
	stdio: 'inherit',
});
const log = fs.readFileSync(path.join(dir, 'figure.log'), 'utf8');
for (const [i, font] of tikz.FONT_SIZES.entries()) {
	const match = new RegExp(`SAKUGA-${font}=([0-9.]+)pt`).exec(log);
	assert(match, `Missing height for ${font}`);
	const actual = (+match[1] * 25.4) / 72.27;
	const expected = tikz.boxHalf(tikz.nodes(fig).find((n) => n.id === `font${i}`))[1] * 2;
	assert(Math.abs(actual - expected) < 0.02, `${font}: ${actual} mm vs canvas ${expected} mm`);
	console.log(`${font}: ${actual.toFixed(3)} mm (canvas ${expected.toFixed(3)} mm)`);
}
console.log(`Layer, style, paste, round-trip, font-height and LuaLaTeX checks passed.\nArtifacts: ${dir}`);
