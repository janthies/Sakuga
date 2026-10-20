// Focused interaction/rendering checks without adding a browser dependency.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
 constructor(tag) { this.tagName=tag;this.children=[];this.attributes={};this.style={setProperty(){}};this.value=''; }
 append(...children) { this.children.push(...children); }
 appendChild(child) { this.append(child);return child; }
 setAttribute(k,v) { this.attributes[k]=String(v); }
 removeAttribute(k) { delete this.attributes[k]; }
 cloneNode() { const copy=new Element(this.tagName);copy.attributes={...this.attributes};return copy; }
 add(option) { this.children.push(option); }
 setCustomValidity(v) { this.validity=v; }
 reportValidity() {}
 focus() {this.focused=true;}
}
const source=fs.readFileSync(require('node:path').join(__dirname,'../media/editor.js'),'utf8');
const context=vm.createContext({document:{createElement:tag=>new Element(tag)},Option:class {constructor(label,value){this.label=label;this.value=value;}},palette:{blue:{hex:'BBCCEE',mix:85},black:{hex:'000000',mix:100}},sizes:{small:10},view:{s:4},PT:25.4/72.27,px:x=>x*4,py:y=>-y*4,visualChoice:(options,value,onSelect)=>Object.assign(new Element('choice'),{options,value,onSelect}),el:(tag,attrs,parent)=>{const e=new Element(tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent?.appendChild(e);return e;}});
const run=s=>vm.runInContext(s,context);
run(`let recentColors=[];let state={grid:2,other:'preserved'};const vscode={getState:()=>state,setState:s=>state=s};let grid=2;const saveState=()=>vscode.setState({...vscode.getState(),grid,recentColors});`);
run(source.slice(source.indexOf('\tconst styleColor'),source.indexOf(' function textMm')));
run(source.slice(source.indexOf(' const styleFields'),source.indexOf('\n\tfunction renderInspector')));
run(source.slice(source.indexOf(' function drawDecorations'),source.indexOf('\n\tfunction contentBox()')));
run("const changes=[];const control=styleSelect('fill',['','blue'],[{style:{fill:'blue'}},{style:{fill:'#112233'}}],s=>changes.push(s));");
assert.equal(run('control.children[0].value'),'*');
run("control.children[1].value='#abcdef';control.children[1].onchange();");
assert.equal(run('changes[0].fill'),'#ABCDEF');
assert.equal(run('state.recentColors[0]'),'#ABCDEF');
assert.equal(run('state.grid'),2);assert.equal(run('state.other'),'preserved');
run("control.children[2].value='bad';control.children[2].onchange();");
assert.equal(run('changes.length'),1,'Invalid hex must not change the style');
run("control.children[2].value='2468ac';control.children[2].onchange();");
assert.equal(run('changes[1].fill'),'#2468AC');
run("const reopened=styleSelect('color',[],[{style:{color:'#2468AC'}}],s=>changes.push(s));");
assert(run("reopened.children[0].options.some(o=>o.value==='#ABCDEF')"));
run("reopened.children[0].onSelect('blue')");assert.equal(run('changes[2].color'),'blue');
assert.equal(run("styleColor('blue','')"),'rgb(197,212,241)');
run("const borderControl=styleSelect('border',['','double'],[{style:{}},{style:{border:'double'}}],s=>changes.push(s));");
assert.equal(run('borderControl.value'),'*');
// Canvas uses clipped SVG patterns, the requested mark geometry and double strokes.
run("const drawn=new (document.createElement('g').constructor)('g');const box=document.createElement('rect');box.setAttribute('fill','#fff');drawDecorations({id:'test',x:0,y:0,style:{pattern:'crosshatch',mark:'triangle',markCorner:'sw',markSize:'medium',border:'double'}},30,10,box,drawn);");
assert.equal(run('drawn.children[0].children[1].attributes.width'),String(3*25.4/72.27*4));
assert.equal(run('drawn.children[3].attributes["clip-path"]'),'url(#sg-clip-test)');
assert.equal(run('drawn.children[3].children[0].tagName'),'path');
assert.equal(run('drawn.children[3].children[1].tagName'),'rect','Pattern overlays the mark, as in TikZ');
// Exercise the actual copy/paste handlers, including clearing old decorations.
run(`let styleClip=null;const selN=new Set(['source']);const selE=new Set();let nodes=[{id:'source',width:26,minh:0,cat:'',style:{pattern:'dots',patternColor:'#112233',mark:'circle',markCorner:'sw',markSize:'medium',markColor:'#ABCDEF',border:'double'}},{id:'target',style:{}}];const byId=id=>nodes.find(n=>n.id===id);const edges=[];const render=()=>{};const posted=[];const post=op=>posted.push(op);`);
run(source.slice(source.indexOf('\tfunction copyStyle()'),source.indexOf('\n\t// Copy also')));
run("copyStyle();selN.clear();selN.add('target');pasteStyle();");
for (const key of ['pattern','patternColor','mark','markCorner','markSize','markColor','border']) {
 assert.equal(run(`posted[0].ops.find(o=>o.op==='style').style.${key}`),run(`nodes[0].style.${key}`));
}
run("nodes[0].style={};selN.clear();selN.add('source');copyStyle();selN.clear();selN.add('target');pasteStyle();");
assert.equal(run("posted[1].ops.find(o=>o.op==='style').style.mark"),'');
console.log('Mixed values, custom hex validation, recent colours/state, swatches, SVG patterns/marks/double borders and style copy/paste passed.');
// New visual buttons keep the same operations and allow independent emphasis toggles.
run("const shape=styleSelect('shape',['','rectangle','ellipse'],[{style:{shape:'ellipse'}}],s=>changes.push(s));shape.children[1].onclick();");
assert.equal(run('changes.at(-1).shape'),'rectangle');
assert.equal(run('shape.children[2].attributes["aria-pressed"]'),'true');
run("const emphasis=styleSelect('text',['','bold','italic','bold-italic'],[{style:{text:'bold'}}],s=>changes.push(s));emphasis.children[1].onclick();");
assert.equal(run('changes.at(-1).text'),'bold-italic');
assert.equal(run('control.children[2].hidden'),true,'Custom hex field starts collapsed');
run("control.children[0].children.find(b=>b.attributes['aria-label']==='Custom hex colour').onclick();");
assert.equal(run('control.children[2].hidden'),false);
assert.equal(run('control.children[2].focused'),true);
console.log('Segmented shape choices and independent bold/italic operations passed.');
