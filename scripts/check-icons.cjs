// Run after npm run compile. Exercises icon persistence and compiles a representative PDF.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const t = require('../out/tikz.js');
const root = path.resolve(__dirname, '..');
t.setIcons(JSON.parse(fs.readFileSync(path.join(root, 'icons/icons.json'), 'utf8')));
const f = t.parse(t.TEMPLATE);
t.apply(f, { op: 'category', key: 'work', icon: 'board' });
for (const [i, iconPosition] of ['left', 'above', 'right', 'nw', 'ne', 'sw', 'se'].entries()) {
	t.apply(f, {
		op: 'addNode',
		id: `position${i}`,
		x: (i % 3) * 40,
		y: -Math.floor(i / 3) * 22,
		title: 'Title',
		cat: 'work',
		icon: 'board',
		iconPosition,
	});
}
t.apply(f, {
	op: 'addNode',
	id: 'inherited',
	x: 40,
	y: -44,
	title: 'Category',
	cat: 'work',
	icon: 'category',
	iconPosition: 'above',
});
t.apply(f, {
	op: 'addNode',
	id: 'free',
	kind: 'icon',
	icon: 'board',
	x: 80,
	y: -44,
	width: 8,
	minh: 10,
	title: 'Free icon',
	cat: '',
});
t.apply(f, { op: 'addGroup', id: 'iconGroup', name: '', frame: 'dashed', color: 'grey', parent: '' });
t.apply(f, { op: 'setGroup', ids: ['free'], group: 'iconGroup' });
const serialized = t.serialize(f),
	parsed = t.parse(serialized);
assert.equal(t.serialize(parsed), serialized);
assert.equal(t.nodes(parsed).length, 9);
for (let i = 0; i < 7; i++) {
	const n = t.nodes(parsed).find((n) => n.id === `position${i}`);
	assert.equal(n.iconPosition, ['left', 'above', 'right', 'nw', 'ne', 'sw', 'se'][i]);
	assert.equal(n.icon, 'board');
	assert.equal(n.title, 'Title');
}
assert.equal(t.nodes(parsed).find((n) => n.id === 'free').kind, 'icon');
assert.equal(t.nodes(parsed).find((n) => n.id === 'free').title, 'Free icon');
assert.match(serialized, /\\pic\[pic text=\{Free icon\}/);
assert.match(serialized, /sg icon\/board/);
// Paste and layer duplication preserve all object fields.
const target = t.parse(t.TEMPLATE),
	pasted = t.pasteOps(target, serialized, 5, -5);
t.apply(target, { op: 'batch', ops: pasted.ops });
assert.equal(t.nodes(target).filter((n) => n.kind === 'icon').length, 1);
assert.equal(t.nodes(target).find((n) => n.iconPosition === 'ne').icon, 'board');
t.apply(target, { op: 'duplicateLayer', id: 'layer1', newId: 'copy' });
assert.equal(t.nodes(target).filter((n) => n.kind === 'icon').length, 2);
const freeCopy = t.nodes(target).find((n) => n.kind === 'icon' && n.layer === 'copy');
t.apply(target, { op: 'move', id: freeCopy.id, x: 31, y: 17 });
t.apply(target, { op: 'node', id: freeCopy.id, width: 12, minh: 6, title: 'Renamed' });
t.apply(target, { op: 'layerProps', id: 'copy', hidden: true, locked: true });
const hiddenText = t.serialize(target);
assert.equal(t.serialize(t.parse(hiddenText)), hiddenText);
const restored = t.nodes(t.parse(hiddenText)).find((n) => n.id === freeCopy.id);
assert.equal(restored.width, 12);
assert.equal(restored.minh, 6);
assert.equal(restored.title, 'Renamed');
// Read legacy inline icons, then save with the current metadata and positioning.
const legacy = t.parse(String.raw`\begin{tikzpicture}
\node[sg box] (legacy) at (0,0) {\sgicon{board}\ Old};
\end{tikzpicture}`);
assert.equal(t.nodes(legacy)[0].title, 'Old');
assert.equal(t.nodes(legacy)[0].icon, 'board');
assert.equal(t.serialize(t.parse(t.serialize(legacy))), t.serialize(legacy));
// Category defaults apply to future boxes, with explicit per-box opt-out.
const defaults = t.parse(t.TEMPLATE);
t.apply(defaults, { op: 'category', key: 'work', icon: 'board', boxes: true });
t.apply(defaults, { op: 'addNode', id: 'auto', x: 0, y: 0, title: 'Auto', cat: 'work', iconPosition: 'above' });
t.apply(defaults, {
	op: 'addNode',
	id: 'optout',
	x: 40,
	y: 0,
	title: 'Plain',
	cat: 'work',
	icon: 'none',
	iconPosition: 'above',
});
const defaultsText = t.serialize(defaults);
assert.match(defaultsText, /icon=board boxes/);
assert.match(defaultsText, /\]auto\.north/);
assert(!defaultsText.includes(']optout.north'));
assert.equal(t.serialize(t.parse(defaultsText)), defaultsText);
assert.equal(t.categories(t.parse(defaultsText))[0].boxes, true);
const blank = t.parse(serialized);
t.apply(blank, { op: 'node', id: 'free', icon: '', title: String.raw`A, \textbf{B,C} [test]` });
const blankText = t.serialize(blank);
assert.equal(t.nodes(t.parse(blankText)).find((n) => n.id === 'free').title, String.raw`A, \textbf{B,C} [test]`);
assert.equal(t.serialize(t.parse(blankText)), blankText);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakuga-icons-check-'));
fs.writeFileSync(path.join(dir, 'figure.tikz'), serialized);
const preamble = String.raw`\documentclass[11pt,border=1mm]{standalone}
\usepackage{fontspec}
\setsansfont{OpenSans-Regular.ttf}[Path=${root}/media/]
\setmonofont{texgyrecursor-regular.otf}[Path=${root}/media/]
\usepackage{tikz}
\usetikzlibrary{arrows.meta, fit, backgrounds, svg.path, shapes.geometric}
\begin{document}
`;
const probes = Array.from(
	{ length: 7 },
	(_, i) =>
		String.raw`\pgfextracty{\dimen0}{\pgfpointanchor{position${i}}{north}}\pgfextracty{\dimen2}{\pgfpointanchor{position${i}}{south}}\advance\dimen0 by -\dimen2\typeout{ICON-${i}=\the\dimen0}`,
).join('\n');
fs.writeFileSync(
	path.join(dir, 'figure.tex'),
	preamble + serialized.replace('\\end{tikzpicture}', probes + '\n\\end{tikzpicture}') + '\n\\end{document}',
);
fs.mkdirSync(path.join(dir, 'cache'));
try {
	execFileSync('nice', ['-n', '19', 'lualatex', '-interaction=batchmode', '-halt-on-error', 'figure.tex'], {
		cwd: dir,
		env: { ...process.env, TEXMFVAR: path.join(dir, 'cache'), TEXMFCACHE: path.join(dir, 'cache') },
		timeout: 120000,
		stdio: 'inherit',
	});
} catch (e) {
	console.error(fs.readFileSync(path.join(dir, 'figure.log'), 'utf8').slice(-5000));
	throw e;
}
const log = fs.readFileSync(path.join(dir, 'figure.log'), 'utf8');
for (let i = 0; i < 7; i++) {
	const actual = (+new RegExp(`ICON-${i}=([0-9.]+)pt`).exec(log)[1] * 25.4) / 72.27;
	const expected = t.boxHalf(t.nodes(f).find((n) => n.id === `position${i}`))[1] * 2;
	console.log(`${i}: PDF ${actual.toFixed(3)} mm, canvas ${expected.toFixed(3)} mm`);
	assert(Math.abs(actual - expected) < 0.1, `Position ${i}: PDF and canvas height differ`);
}
console.log(
	`Icon positions, category inheritance, free icons, paste, layers, round trip and LuaLaTeX passed.\nArtifacts: ${dir}`,
);
