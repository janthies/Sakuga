// Run after npm run compile. Named styles: dialect, migration, overrides, reset/update/new, legend, round trips.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const t = require('../out/tikz.js');
t.setIcons(JSON.parse(fs.readFileSync(path.join(__dirname, '../icons/icons.json'), 'utf8')));
const base = '\\begin{tikzpicture}[x=1mm, y=1mm, font=\\sffamily\\small]\n\\end{tikzpicture}\n';
const add = (fig, id, cat, extra = {}) => t.apply(fig, { op: 'addNode', id, x: 0, y: 0, title: id, cat, ...extra });
const text = (fig) => t.serialize(fig);

// 1. Old category lines become box styles and are rewritten as style lines; TikZ names follow.
const old =
	'% Sakuga figure\n% sakuga category tee {TEE} green icon=chip boxes\n% sakuga category riot {RIOT} grey no-legend\n% sakuga legend on\n' +
	base.replace(
		'\\end{tikzpicture}',
		'\\node[cat-tee, fill=sgPeach] (a) at (0,0) {A};\n\\node[cat-riot] (b) at (0,-12) {B};\n\\end{tikzpicture}',
	);
let fig = t.parse(old);
assert.deepEqual(
	t.styleDefs(fig).map((s) => [s.kind, s.key, s.legend]),
	[
		['box', 'tee', true],
		['box', 'riot', false],
	],
);
let saved = text(fig);
assert(saved.includes('% sakuga style box tee {TEE} green icon=chip boxes legend'));
assert(saved.includes('% sakuga style box riot {RIOT} grey\n'));
assert(!saved.includes('sakuga category') && !saved.includes('cat-'));
assert(saved.includes('sg style/tee/.style={sg box, fill=sgGreen!85}'));
assert(
	/\\node\[sg style\/tee, sg icon height=6, fill=sgPeach\] \(a\)/.test(saved),
	'object line = style name + overrides only',
);
assert(saved.includes('\\node[sg style/riot] (b)'));
assert.equal(text(t.parse(saved)), saved, 'migration is stable');

// 2. Override detection: a property equal to the style is no override, a different one is.
fig = t.parse(saved);
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[0]), ['fill']);
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[1]), []);
t.apply(fig, { op: 'style', ids: ['b'], style: { fill: 'grey' } });
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[1]), [], 'same as the style is not an override');
t.apply(fig, { op: 'style', ids: ['b'], style: { border: 'dashed', weight: 'thick' } });
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[1]).sort(), ['border', 'lineWidth', 'weight']);
assert(text(fig).includes('\\node[sg style/riot, dashed, line width=1.2pt] (b)'));
// an empty value on a styled object goes back to the style
t.apply(fig, { op: 'style', ids: ['a'], style: { fill: '' } });
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[0]), []);
assert.equal(t.nodes(fig)[0].style.fill, 'green');

// 3. Reset, update, new.
fig = t.parse(base.replace('\\end{tikzpicture}', '\\end{tikzpicture}'));
t.apply(fig, { op: 'styleAdd', kind: 'box', name: 'Core', props: { fill: 'blue' }, legend: true });
const core = t.styleDefs(fig)[0].key;
for (const id of ['x', 'y', 'z']) {
	add(fig, id, core);
}
t.apply(fig, { op: 'style', ids: ['x'], style: { fill: 'red', border: 'dashed' } });
t.apply(fig, { op: 'style', ids: ['y'], style: { weight: 'thick' } });
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[0]).sort(), ['border', 'fill']);
t.apply(fig, { op: 'resetStyle', ids: ['x'] });
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[0]), []);
assert.equal(t.nodes(fig)[0].style.fill, 'blue');
t.apply(fig, { op: 'style', ids: ['x'], style: { fill: 'red', border: 'dashed' } });
t.apply(fig, { op: 'resetStyle', ids: ['x'], keys: ['fill'] });
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[0]), ['border']);
// update changes all users and keeps their other overrides
t.apply(fig, { op: 'styleUpdate', key: core, id: 'x' });
assert.equal(t.styleDefs(fig)[0].props.border, 'dashed');
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[0]), [], 'source object has no overrides after update');
assert.equal(t.nodes(fig)[2].style.border, 'dashed', 'z follows the style');
assert.deepEqual(t.overrideKeys(fig, t.nodes(fig)[1]), ['weight', 'lineWidth'], 'y keeps its own override');
// style definition edit: every user follows, overrides stay
t.apply(fig, { op: 'styleEdit', key: core, props: { fill: 'green' } });
assert(t.nodes(fig).every((n) => n.style.fill === 'green'));
t.apply(fig, { op: 'style', ids: ['z'], style: { fill: 'red' } });
t.apply(fig, { op: 'styleEdit', key: core, props: { fill: 'yellow' } });
assert.equal(t.nodes(fig)[0].style.fill, 'yellow');
assert.equal(t.nodes(fig)[2].style.fill, 'red');
// rename moves the key in the objects
t.apply(fig, { op: 'styleEdit', key: core, name: 'Kernel' });
assert(t.nodes(fig).every((n) => n.cat === 'kernel'));
assert(text(fig).includes('% sakuga style box kernel {Kernel}'));
// new style from an object: takes its look, the object keeps no overrides
add(fig, 'w', '', { style: { fill: 'peach', shape: 'pill', weight: 'medium' } });
t.apply(fig, { op: 'styleAdd', kind: 'box', name: 'Soft', from: { id: 'w' } });
const soft = t.styleDefs(fig).find((s) => s.name === 'Soft');
assert.deepEqual(soft.props, { fill: 'peach', weight: 'medium', shape: 'pill' });
assert.equal(t.nodes(fig).find((n) => n.id === 'w').cat, soft.key);
assert.deepEqual(
	t.overrideKeys(
		fig,
		t.nodes(fig).find((n) => n.id === 'w'),
	),
	[],
);
// picking another style adopts it and drops the old overrides
t.apply(fig, { op: 'node', id: 'z', cat: soft.key });
assert.deepEqual(
	t.overrideKeys(
		fig,
		t.nodes(fig).find((n) => n.id === 'z'),
	),
	[],
);
assert.equal(t.nodes(fig).find((n) => n.id === 'z').style.fill, 'peach');
// delete: keep the look, or move to another style
t.apply(fig, { op: 'styleDelete', key: soft.key, to: 'kernel' });
assert.equal(t.nodes(fig).find((n) => n.id === 'w').cat, 'kernel');
t.apply(fig, { op: 'styleDelete', key: 'kernel' });
assert(t.nodes(fig).every((n) => n.cat === ''));
assert.equal(t.nodes(fig).find((n) => n.id === 'x').style.fill, 'yellow', 'look is kept as plain overrides');
saved = text(fig);
assert.equal(text(t.parse(saved)), saved);

// weight / font groups: thin and normal text against a thick, bold style
fig = t.parse(base);
t.apply(fig, {
	op: 'styleAdd',
	kind: 'box',
	name: 'Loud',
	props: { fill: 'red', weight: 'thick', text: 'bold', font: 'large' },
});
add(fig, 'p', 'loud');
t.apply(fig, { op: 'style', ids: ['p'], style: { weight: '' } });
assert(text(fig).includes('line width=0.45pt'), 'thin against a thick style is explicit');
t.apply(fig, { op: 'style', ids: ['p'], style: { text: '' } });
assert(
	/font=\\sffamily\\large(?!\\bfseries)/.test(
		text(fig)
			.split('\n')
			.find((l) => l.includes('(p)')),
	),
);
saved = text(fig);
const again = t.parse(saved);
assert.equal(again.lines.length, t.parse(saved).lines.length);
assert.deepEqual(t.overrideKeys(again, t.nodes(again)[0]).sort(), ['font', 'lineWidth', 'text', 'weight']);
assert.equal(text(again), saved);

// 4. Legend comes from the flags, only for used styles.
fig = t.parse(base);
t.apply(fig, { op: 'styleAdd', kind: 'box', name: 'In', props: { fill: 'blue' }, legend: true });
t.apply(fig, { op: 'styleAdd', kind: 'box', name: 'Out', props: { fill: 'red' }, legend: false });
t.apply(fig, { op: 'styleAdd', kind: 'box', name: 'Unused', props: { fill: 'grey' }, legend: true });
add(fig, 'i', 'in');
add(fig, 'o', 'out');
let legend = text(fig).split('% sakuga legend begin')[1] || '';
assert(legend.includes('In') && !legend.includes('Out') && !legend.includes('Unused'));
t.apply(fig, { op: 'styleEdit', key: 'out', legend: true });
assert((text(fig).split('% sakuga legend begin')[1] || '').includes('Out'));

// 5. Arrow, frame and label styles parse and serialize.
const kinds =
	'% sakuga style arrow optional {Optional} dashed grey lineWidth=0.8\n% sakuga style frame world {World} region green fillStrength=40\n% sakuga style label note {Note} #336699 font=footnotesize text=italic\n';
fig = t.parse(
	'% Sakuga figure\n' +
		kinds +
		base.replace(
			'\\end{tikzpicture}',
			'\\node[sg style/note] (n1) at (0,0) {Hello};\n\\node[sg box] (a) at (0,-12) {A};\n\\node[sg box] (b) at (0,-24) {B};\n\\draw[sg style/optional, draw=sgRed] (a) -- (b);\n\\end{tikzpicture}',
		),
);
assert.deepEqual(
	t.styleDefs(fig).map((s) => s.kind),
	['arrow', 'frame', 'label'],
);
assert.equal(t.nodes(fig)[0].kind, 'label');
assert.equal(t.nodes(fig)[0].cat, 'note');
assert.equal(t.edges(fig)[0].styleKey, 'optional');
assert.deepEqual(t.overrideKeys(fig, t.edges(fig)[0]), ['color']);
saved = text(fig);
for (const line of kinds.trim().split('\n')) {
	assert(saved.includes(line), line);
}
assert(saved.includes('sg style/optional/.style={arr, draw=sgGrey!70, dashed, line width=0.8pt'));
assert(/\\draw\[sg style\/optional[^\]]*draw=sgRed\]/.test(saved));
assert.equal(text(t.parse(saved)), saved);

// 6. Shared overrides hint.
fig = t.parse(base);
t.apply(fig, { op: 'styleAdd', kind: 'box', name: 'S', props: { fill: 'blue' } });
for (const id of ['a', 'b', 'c']) {
	add(fig, id, 's', { style: { border: 'dashed' } });
}
add(fig, 'd', 's');
const shared = t.sharedOverrides(fig);
assert.equal(shared.length, 1);
assert.deepEqual(shared[0].ids, ['a', 'b', 'c']);

// 7. Copy and paste carry the styles the boxes use.
const src = text(fig),
	target = t.parse(base);
t.apply(target, { op: 'batch', ops: t.pasteOps(target, src, 5, -5).ops });
assert.equal(t.styleDefs(target)[0].name, 'S');
assert.equal(t.nodes(target).length, 4);
assert.equal(t.nodes(target)[0].style.border, 'dashed');

// 8. Examples: one migration save, then identical.
const dir = path.join(__dirname, '../examples');
for (const f of fs.readdirSync(dir)) {
	const once = text(t.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
	assert(!once.includes('sakuga category'), f);
	assert.equal(text(t.parse(once)), once, `${f}: round trip after migration`);
}
// 9. The generated TikZ of all four kinds, with overrides back to the house look, compiles with LuaLaTeX.
{
	const os = require('node:os'),
		{ execFileSync } = require('node:child_process');
	const f = t.parse(base);
	t.apply(f, {
		op: 'styleAdd',
		kind: 'box',
		name: 'Loud',
		props: { fill: 'red', weight: 'thick', text: 'bold', font: 'large', border: 'dashed', shape: 'pill' },
	});
	t.apply(f, { op: 'styleAdd', kind: 'box', name: 'Ghost', props: { fill: 'blue', border: 'none' } });
	t.apply(f, {
		op: 'styleAdd',
		kind: 'arrow',
		name: 'Optional',
		props: { border: 'dashed', color: 'grey', lineWidth: 0.8, end: 'Stealth' },
	});
	t.apply(f, {
		op: 'styleAdd',
		kind: 'label',
		name: 'Note',
		props: { font: 'footnotesize', text: 'italic', textColor: '#336699', border: 'solid' },
	});
	t.apply(f, { op: 'styleAdd', kind: 'frame', name: 'World', props: { frame: 'region', color: 'green' } });
	add(f, 'a', 'loud', { x: 0, y: 0 });
	add(f, 'b', 'loud', { x: 40, y: 0 });
	add(f, 'c', 'ghost', { x: 80, y: 0 });
	add(f, 'n', 'note', { kind: 'label', x: 40, y: -20, width: 18 });
	t.apply(f, { op: 'style', ids: ['b'], style: { weight: '', text: '', border: '', shape: '', font: '' } });
	t.apply(f, { op: 'style', ids: ['c'], style: { border: '' } });
	t.apply(f, { op: 'addEdge', from: 'a', to: 'b', styleKey: 'optional' });
	const out = text(f);
	assert.equal(text(t.parse(out)), out);
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakuga-styles-'));
	fs.writeFileSync(
		path.join(dir, 'figure.tex'),
		'\\documentclass[11pt,border=2mm]{standalone}\n\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta, fit, backgrounds, svg.path, shapes.geometric, patterns}\n\\begin{document}\n' +
			out +
			'\n\\end{document}\n',
	);
	const cache = path.join(dir, 'tex-cache');
	fs.mkdirSync(cache);
	try {
		execFileSync('nice', ['-n', '19', 'lualatex', '-interaction=batchmode', '-halt-on-error', 'figure.tex'], {
			cwd: dir,
			env: { ...process.env, TEXMFVAR: cache, TEXMFCACHE: cache },
			timeout: 120000,
			stdio: 'ignore',
		});
	} catch (e) {
		console.error(fs.readFileSync(path.join(dir, 'figure.log'), 'utf8').slice(-4000));
		throw e;
	}
}
console.log(
	'Style dialect, migration, overrides, reset/update/new/delete, legend flags, other kinds, shared hint, paste, example round trips and a LuaLaTeX compile passed.',
);
