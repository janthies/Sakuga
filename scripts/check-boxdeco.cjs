// Run after npm run compile. Exercises editable TikZ decorations and a real PDF.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const t = require('../out/tikz.js');
const fig = t.parse('\\begin{tikzpicture}[x=1mm,y=1mm]\n% sakuga legend off\n\\end{tikzpicture}');
const fixtures = [];
for (const pattern of ['', 'hatched', 'crosshatch', 'dots', 'horizontal', 'vertical']) {
	fixtures.push({ pattern, fill: '#F1E4C2', patternColor: '#2468AC', border: 'double', color: '#654321' });
}
for (const mark of ['triangle', 'circle']) {
	for (const markCorner of ['', 'nw', 'se', 'sw']) {
		for (const markSize of ['', 'medium']) {
			fixtures.push({ mark, markCorner, markSize, markColor: '#E04080', fill: 'blue', border: 'dotted' });
		}
	}
}
fixtures.push({ mark: 'triangle', pattern: 'hatched', fill: 'none', border: 'none' });
fixtures.push({ mark: 'circle', pattern: 'dots', border: 'dashed', fill: 'green' });
for (const [i, style] of fixtures.entries()) {
	t.apply(fig, {
		op: 'addNode',
		id: `box${i}`,
		x: (i % 4) * 40,
		y: -Math.floor(i / 4) * 18,
		title: `Box ${i}`,
		cat: '',
	});
	t.apply(fig, { op: 'style', ids: [`box${i}`], style });
}
const output = t.serialize(fig),
	parsed = t.parse(output);
assert.equal(t.nodes(parsed).length, fixtures.length);
assert.equal(t.serialize(parsed), output, 'TikZ must round-trip byte for byte');
for (const [i, style] of fixtures.entries()) {
	const node = t.nodes(parsed)[i];
	assert.equal(node.cat, '');
	assert.deepEqual(node.extra, []);
	for (const [key, value] of Object.entries(style)) {
		if (value) assert.equal(node.style[key], value, `${i}: ${key}`);
	}
}
assert.equal((output.match(/\\definecolor\{sgc2468AC\}/g) || []).length, 1);
assert(!output.includes('sgcABCDEF'));
// Applying a style to multiple nodes and pasting a decorated figure preserves it.
t.apply(parsed, {
	op: 'style',
	ids: ['box0', 'box1'],
	style: { fill: '#ABCDEF', mark: 'circle', markCorner: 'sw', markSize: 'medium' },
});
assert(
	t
		.nodes(parsed)
		.slice(0, 2)
		.every((n) => n.style.fill === '#ABCDEF' && n.style.markCorner === 'sw'),
);
const target = t.parse('\\begin{tikzpicture}\n\\end{tikzpicture}');
t.apply(target, { op: 'batch', ops: t.pasteOps(target, output, 10, -10).ops });
assert.deepEqual(
	t.nodes(target).map((n) => n.style),
	t.nodes(t.parse(output)).map((n) => n.style),
);
const changed = t.serialize(parsed);
assert.equal(t.serialize(t.parse(changed)), changed);
// Custom definitions disappear when the final reference is removed.
const unused = t.parse('\\begin{tikzpicture}\n\\end{tikzpicture}');
t.apply(unused, { op: 'addNode', id: 'unused', x: 0, y: 0, title: 'Test', cat: '' });
t.apply(unused, { op: 'style', ids: ['unused'], style: { fill: '#AABBCC' } });
assert(t.serialize(unused).includes('\\definecolor{sgcAABBCC}'));
t.apply(unused, { op: 'style', ids: ['unused'], style: { fill: '' } });
assert(!t.serialize(unused).includes('sgcAABBCC'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakuga-boxdeco-'));
fs.writeFileSync(path.join(dir, 'figure.tikz'), output);
fs.writeFileSync(
	path.join(dir, 'figure.tex'),
	String.raw`\documentclass[11pt,border=2mm]{standalone}
\usepackage{tikz}
\usetikzlibrary{arrows.meta, fit, backgrounds, svg.path, shapes.geometric, patterns}
\begin{document}
` +
		output +
		'\n\\end{document}',
);
const cache = path.join(dir, 'tex-cache');
fs.mkdirSync(cache);
try {
	execFileSync('nice', ['-n', '19', 'lualatex', '-interaction=batchmode', '-halt-on-error', 'figure.tex'], {
		cwd: dir,
		env: { ...process.env, TEXMFVAR: cache, TEXMFCACHE: cache },
		timeout: 120000,
		stdio: 'inherit',
	});
} catch (e) {
	console.error(fs.readFileSync(path.join(dir, 'figure.log'), 'utf8').slice(-5000));
	throw e;
}
console.log(
	`All patterns, both marks in all corners and sizes, custom colours, batch edits, paste and identical round-trips passed. PDF: ${dir}/figure.pdf`,
);
