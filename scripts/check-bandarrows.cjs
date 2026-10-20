// Canvas selection and clipboard regression checks; run after npm run compile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tikz = require('../out/tikz.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../media/editor.js'), 'utf8');
const handlers = {}, messages = [];
const context = vm.createContext({
 console, Set, Map, Math,
 svg: { addEventListener: (name, fn) => { handlers[name] = fn; }, setPointerCapture() {} },
 document: { createElement: () => ({ style:{setProperty(){}}, options: [], children:[], append(...els) { this.children.push(...els); }, add(o) { this.options.push(o); }, setAttribute() {} }) },
 palette:{}, recentColors:[], styleColor:()=> '#000000',
 visualChoice:(options,value,onSelect)=>({options,value,onSelect}),
 Option: function(text, value) { this.text = text; this.value = value; },
 vscode: { postMessage: m => messages.push(m) },
 post: op => messages.push({ type: 'op', op }),
 render() {}, toMm: ev => ({x: ev.x, y: ev.y}), endEdit() {},
 layout: n => ({w: n.width, h: n.minh || 6}),
 guides: () => ({dx: 0, dy: 0, lines: []}),
});
const run = code => vm.runInContext(code, context);
const load = (start, end) => run(source.slice(source.indexOf(start), source.indexOf(end)));
run(`
 const selectedLayers=new Set();
 let nodes = [], edges = [], cats = [], selN = new Set(), selE = new Set();
 let drag = null, editing = null, space = false, selG = null, hover = null;
 let styleClip = null, pendingSelect = null, defaultWidth = 26, arrowsStyle = 'manhattan';
 const src = {value: ''};
 const byId = id => nodes.find(n => n.id === id);
 const snap = v => v, fine = v => v, r1 = v => String(Math.round(v * 10) / 10);
`);
load(' const ANCHORS', '\n\tfunction toMm');
load('\t// Point on the border', '\tfunction bbox()');
load('\tfunction boxHalf', '\tfunction tip(');
load('\tfunction edgeInside', '\t// Smart guides');
load('\tfunction copyStyle', '\tfunction unit(');
load(' // Small visual choices', '\tfunction renderInspector');
load("\tsvg.addEventListener('pointerdown'", "\tsvg.addEventListener('dblclick'");
run(`
 nodes = [
  {id:'a', x:0, y:0, width:10, minh:6, title:'A', code:'', cat:'', extra:[]},
  {id:'b', x:100, y:0, width:10, minh:6, title:'B', code:'', cat:'', extra:[]},
  {id:'c', x:200, y:0, width:10, minh:6, title:'C', code:'', cat:'', extra:[]}
 ];
 edges = [{from:'a', to:'b', route:'straight', head:'end', kind:'arr', label:'', extra:[], style:{color:'blue'}},
          {from:'b', to:'c', route:'straight', head:'both', kind:'arr-dashed', label:'', extra:[], style:{color:'red'}}];
`);
assert(run('edgeInside(edges[0], 49, 51, -1, 1)'), 'Crossing line with both endpoints outside');
assert(!run('edgeInside(edges[0], 49, 51, 1, 2)'), 'Disjoint line');
assert(run('edgeInside(edges[0], 5, 95, 0, 0)'), 'Boundary contact and zero-height band');
run("edges[0].route='hvh'; edges[0].mid=50; nodes[1].y=40;");
assert(run('edgeInside(edges[0], 49, 51, 19, 21)'), 'Orthogonal middle segment');
assert(run('edgeInside(edges[0], 20, 21, -1, 1)'), 'Orthogonal first segment');
assert(run('edgeInside(edges[0], 70, 71, 39, 41)'), 'Orthogonal last segment');
assert(!run('edgeInside(edges[0], 20, 21, 19, 21)'), 'Orthogonal bounding box is insufficient');
run("edges[0].route='bend'; edges[0].bend=60; nodes[1].y=0;");
run('const midpoint = edgeGeom(edges[0]).label;');
assert(run('edgeInside(edges[0], midpoint[0]-.00001, midpoint[0]+.00001, midpoint[1]-.00001, midpoint[1]+.00001)'), 'Tiny band crossing actual cubic');
assert(run('edgeInside(edges[0], 49, 51, midpoint[1], midpoint[1]+1)'), 'Cubic tangent at band boundary');
assert(!run('edgeInside(edges[0], 49, 51, midpoint[1]+1, midpoint[1]+2)'), 'Disjoint cubic control hull overlap');
run("selN=new Set(['a','b']);");
assert(run('edgeInside(edges[0], 0, 1, 100, 101)'), 'Both selected boxes include their bent arrow');
run("nodes[0].locked=true;");
assert(!run('edgeInside(edges[0], -100, 200, -100, 200)'), 'Locked endpoint excluded');
run("nodes[0].locked=false; nodes[0].hidden=true;");
assert(!run('edgeInside(edges[0], -100, 200, -100, 200)'), 'Hidden endpoint excluded');
run("nodes[0].hidden=false; edges[0].route='straight'; selN.clear();");

const event = (x, y, ctrlKey = false, dataset = {}) => ({
 x, y, ctrlKey, button: 0, pointerId: 1,
 target: { dataset, classList: { contains: () => false } },
});
handlers.pointerdown(event(49, -1));
handlers.pointermove(event(51, 1));
assert.equal(run('[...selE].join()'), '0');
assert.equal(run('selN.size'), 0);
handlers.pointerup(event(51, 1));
run("selN.add('c');");
handlers.pointerdown(event(149, -1, true));
handlers.pointermove(event(151, 1, true));
assert.equal(run('[...selE].join()'), '0,1', 'Ctrl band adds arrows');
assert.equal(run('[...selN].join()'), 'c', 'Ctrl band preserves boxes');
handlers.pointermove(event(148, -2, true));
assert.equal(run('[...selE].join()'), '0', 'Shrinking band removes only new arrows');
handlers.pointerup(event(148, -2, true));
handlers.pointerdown(event(-6, -4));
handlers.pointermove(event(106, 4));
assert.equal(run('[...selN].join()'), 'a,b');
assert.equal(run('[...selE].join()'), '0,1', 'Band also catches the start of the outgoing arrow');
handlers.pointerup(event(106, 4));
handlers.pointerdown(event(0, 0, false, {node: 'a'}));
handlers.pointermove(event(10, 5));
assert.equal(run('byId("a").x'), 10);
assert.equal(run('byId("b").x'), 110);
assert.equal(run('[...selE].join()'), '0,1', 'Moving boxes preserves arrow selection');
assert.equal(run('edgeGeom(edges[0]).pts[0][0]'), 15, 'Arrow follows moved boxes');
handlers.pointerup(event(10, 5));

run('selN.clear(); selE = new Set([0,1]);');
assert.equal(run("styleSelect('color', ['','blue','red'], [...selE].map(i=>edges[i]), () => {}).children[0].value"), '*', 'Mixed arrow style');
assert.equal(run("styleSelect('border', ['','dashed','dotted'], [...selE].map(i=>edges[i]), () => {}).value"), '*', 'Mixed solid/dashed arrow kinds');
run("const control = styleSelect('color', ['','blue','red'], [...selE].map(i=>edges[i]), style => post({op:'style',indices:[...selE],style})); control.children[0].onSelect('blue');");
assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1).op)), {op:'style', indices:[0,1], style:{color:'blue'}});
run('selE = new Set([0]); copyStyle(); selE = new Set([1]); pasteStyle();');
assert(messages.at(-1).op.ops.some(op => op.op === 'style' && op.indices[0] === 1 && op.style.color === 'blue'));

run('selE = new Set([0]);');
const clipboard = run('clip()');
assert.equal((clipboard.match(/\\node\[/g) || []).length, 2, 'Arrow-only copy includes endpoint boxes');
assert.equal((clipboard.match(/\\draw\[/g) || []).length, 1, 'Only the selected arrow is copied');
const fig = tikz.parse(tikz.TEMPLATE);
const pasted = tikz.pasteOps(fig, clipboard, 5, -5);
tikz.apply(fig, {op:'batch', ops:pasted.ops});
assert.equal(tikz.edges(fig).length, 1, 'Copied arrow pastes with valid endpoints');
assert.equal(tikz.nodes(fig).length, 2);
run('selN = new Set(["a"]); selE = new Set([1]);');
assert.equal((run('clip()').match(/\\draw\[/g) || []).length, 1, 'Including endpoint boxes does not copy additional edges');
run('selN.clear(); selE = new Set([0,1]); deleteSelection();');
assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1).op.ops)), [{op:'deleteEdge',index:1}, {op:'deleteEdge',index:0}]);
assert.equal(run('selE.size'), 0);
console.log('Rectangle path intersection, Ctrl selection, movement, mixed styles, style copy/paste, clipboard paste and deletion passed.');
