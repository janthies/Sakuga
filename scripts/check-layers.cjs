// Run after npm run compile. Keeps the TeX source, log and PDF in a temporary directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const t = require('../out/tikz.js');
let fig = t.parse(t.TEMPLATE);
const apply = op => t.apply(fig, op);
const roundTrip = () => {
  const text = t.serialize(fig);
  const parsed = t.parse(text);
  assert.equal(t.serialize(parsed), text, 'serialization must be byte-identical after parsing');
  fig = parsed;
  return text;
};
assert.equal(t.layers(fig).length, 1);
assert.equal(t.layers(fig)[0].name, 'Layer 1');
assert(!t.serialize(fig).includes('% sakuga layer '), 'implicit layer stays implicit');
apply({ op: 'addNode', id: 'a', x: 0, y: 0, title: 'Bottom', cat: 'work' });
apply({ op: 'addLayer', id: 'upper', name: 'Upper layer' });
assert.equal(t.layers(fig).length, 2);
apply({ op: 'addNode', id: 'b', layer: 'upper', x: 45, y: 0, title: 'Upper', cat: 'work' });
apply({ op: 'addNode', id: 'c', layer: 'upper', x: 45, y: -20, title: 'Member', cat: 'work' });
apply({ op: 'addGroup', id: 'g1', name: 'Outer', frame: 'dashed', color: 'grey', parent: '' });
apply({ op: 'addGroup', id: 'g2', name: 'Inner', frame: 'dotted', color: 'grey', parent: 'g1' });
apply({ op: 'setGroup', ids: ['b'], group: 'g1' });
apply({ op: 'setGroup', ids: ['c'], group: 'g2' });
apply({ op: 'addEdge', from: 'a', to: 'b' });
apply({ op: 'addEdge', from: 'b', to: 'c' });
roundTrip();
apply({ op: 'layerProps', id: 'upper', hidden: true, locked: true });
let text = roundTrip();
assert.equal((text.match(/% sakuga hidden \\node/g) || []).length, 2);
assert.equal((text.match(/% sakuga hidden \\draw/g) || []).length, 2);
assert(!text.includes('fit=(b)') && !text.includes('fit=(c)'), 'hidden frames cannot reference absent nodes');
assert(t.nodes(fig).filter(n => n.layer === 'upper').every(n => t.isHidden(fig, n) && t.isLocked(fig, n)));
// Individual visibility survives hiding and showing the containing layer.
apply({ op: 'hide', ids: ['c'], hidden: true });
roundTrip();
apply({ op: 'layerProps', id: 'upper', hidden: false });
roundTrip();
assert(!t.nodes(fig).find(n => n.id === 'b').hidden);
assert(t.nodes(fig).find(n => n.id === 'c').hidden);
apply({ op: 'hide', ids: ['c'], hidden: false });
apply({ op: 'reorder', order: ['c', 'a', 'b'] });
text = roundTrip();
assert(text.indexOf('(a) at') < text.indexOf('(c) at'));
assert(text.indexOf('(c) at') < text.indexOf('(b) at'));
assert(text.lastIndexOf('\\node[sg style/') < text.indexOf('\\draw[arr'));
apply({ op: 'reorderLayers', order: ['upper', 'layer1'] });
text = roundTrip();
assert(text.indexOf('(b) at') < text.indexOf('(a) at'));
apply({ op: 'setLayer', ids: ['g1'], layer: 'layer1' });
roundTrip();
assert(t.nodes(fig).every(n => n.layer === 'layer1'));
assert.equal(t.groups(fig).find(g => g.id === 'g2').parent, 'g1');
apply({ op: 'setLayer', ids: ['c'], layer: 'upper' });
assert.equal(t.nodes(fig).find(n => n.id === 'c').group, '');
apply({ op: 'deleteLayer', id: 'layer1' });
assert.equal(t.layers(fig).length, 1);
assert(t.nodes(fig).every(n => n.layer === 'upper'));
apply({ op: 'deleteLayer', id: 'upper' });
assert.equal(t.layers(fig).length, 1);
// Final requested figure: two layers, nested frames, a hidden and locked layer.
apply({ op: 'setGroup', ids: ['c'], group: 'g2' });
apply({ op: 'groupProps', id: 'g2', frame: 'region' });
apply({ op: 'addLayer', id: 'hidden', name: 'Hidden layer' });
apply({ op: 'addNode', id: 'd', layer: 'hidden', x: 0, y: -30, title: 'Hidden', cat: 'work' });
apply({ op: 'addEdge', from: 'a', to: 'd' });
apply({ op: 'addGroup', id: 'g3', name: 'Hidden frame', frame: 'dotted', color: 'grey', parent: '' });
apply({ op: 'setGroup', ids: ['d'], group: 'g3' });
apply({ op: 'layerProps', id: 'hidden', hidden: true, locked: true });
text = roundTrip();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakuga-layers-'));
fs.writeFileSync(path.join(dir, 'figure.tikz'), text);
fs.writeFileSync(path.join(dir, 'check.tex'), String.raw`\documentclass{article}
\usepackage{tikz}
\usetikzlibrary{arrows.meta, fit, backgrounds, svg.path}
\begin{document}
` + text + '\n\\end{document}\n');
fs.mkdirSync(path.join(os.tmpdir(), 'sakuga-tex-cache'), { recursive: true });
const child = spawn('nice', ['-n', '19', 'lualatex', '-interaction=nonstopmode', '-halt-on-error', 'check.tex'], {
  cwd: dir, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, TEXMFVAR: path.join(os.tmpdir(), 'sakuga-tex-cache'), TEXMFCACHE: path.join(os.tmpdir(), 'sakuga-tex-cache') },
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('close', code => {
  if (code !== 0) { console.error(output); console.error(`Artifacts: ${dir}`); process.exitCode = 1; return; }
  assert(fs.statSync(path.join(dir, 'check.pdf')).size > 0);
  console.log(`Layer operations, exact round trips, and LuaLaTeX passed. Artifacts: ${dir}`);
});
