// Focused DOM/geometry checks of the actual editor functions, without a browser dependency.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../media/editor.js'),'utf8');
class Element {
 constructor(tag) { this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.style={};this.events={};this.value='';this.offsetHeight=24;this.scrollTop=0;
  this.classList={contains:c=>this.className?.split(' ').includes(c),add:(...cs)=>{this.className=[...new Set([...(this.className||'').split(' '),...cs])].join(' ');},remove:(...cs)=>{this.className=(this.className||'').split(' ').filter(c=>!cs.includes(c)).join(' ');},toggle:(c,on)=>on?this.classList.add(c):this.classList.remove(c)};
 }
 append(...cs) { cs.forEach(c=>{c.parent=this;this.children.push(c);}); }
 get parentElement() {return this.parent;}
 getAttribute(k) {return this.attributes[k] ?? null;}
 prepend(...cs) {cs.forEach(c=>{c.parent=this;});this.children.unshift(...cs);}
 add(c) {this.append(c);}
 appendChild(c) { this.append(c);return c; }
 replaceChildren(...cs) { this.children=[];this.append(...cs); }
 after(c) { this.parent?.append(c); }
 setAttribute(k,v) { this.attributes[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5)]=v; }
 addEventListener(k,fn) { this.events[k]=fn; }
 contains(c) { return this===c || this.children.some(e=>e.contains(c)); }
 querySelector(s) { return this.querySelectorAll(s)[0]||null; }
 querySelectorAll(s) { const match=e=>s.startsWith('#')?e.id===s.slice(1):s.startsWith('.')?s.split(',').some(c=>e.classList.contains(c.slice(1))):e.tagName===s.toUpperCase();return this.children.flatMap(e=>[...(match(e)?[e]:[]),...e.querySelectorAll(s)]); }
 getBoundingClientRect() { return {top:0,bottom:200,width:800,height:600}; }
}
const body=new Element('body'), list=new Element('div'),inspector=new Element('div'),svg=new Element('svg');list.id='layer-list';body.append(list,inspector,svg);
for(const id of ['group','ungroup','layer-tools','tab-count','zoombar','zi-size','zi-zoom','zi-warn']) { const el=new Element('button');el.id=id;body.append(el); }
const document={activeElement:body,createElement:tag=>new Element(tag),getElementById:id=>body.querySelector('#'+id),querySelector:s=>s==='#layer-controls select'?body.querySelector('#layer-controls')?.querySelector('select'):body.querySelector(s),addEventListener(){}};
const messages=[],frames=new Map();let nextFrame=0;
const context=vm.createContext({document,inspector,svg,Element,Set,Map,Math,Option:class extends Element {constructor(label,value){super('option');this.textContent=label;this.value=value;}},requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),post:op=>messages.push(op),catOf:()=>null,descendant:()=>false,icon:()=>'',show:x=>x,tex:x=>x,fillOf:()=> '#fff',snap:x=>x,newId:()=> 'new-box',styleFields:()=>[],styleSelect:()=>new Element('select'),styleColour:()=>new Element('div'),iconPicker:()=>new Element('select'),anchorPicker:()=>new Element('div'),label:()=>new Element('code'),categoryChoice:()=>new Element('select'),effectiveIcon:()=>'',copyStyle(){},pasteStyle(){},sketchControls(){},emphasisToggle:()=>new Element('div'), segmented:()=>new Element('div'), titlePositionPicker:()=>new Element('div'), unit:x=>Object.assign(new Element('span'),{textContent:x})});
const run=code=>vm.runInContext(code,context);
const load=(a,b)=>run(source.slice(source.indexOf(a),source.indexOf(b)));
run(`let layers=[{id:'back',name:'Back',opacity:.5},{id:'front',name:'Front'}],activeLayer='back',nodes=[{id:'outer',layer:'back',title:'',x:0,y:0,width:80,minh:60,style:{}},{id:'inner',layer:'back',title:'Inner',x:0,y:0,width:18,minh:10,style:{opacity:.3}},{id:'target',layer:'front',title:'Target',x:70,y:0,width:18,minh:10,style:{}}],edges=[{from:'inner',to:'target',kind:'arr',route:'straight',head:'end',label:'',style:{opacity:.3}}],groups=[],cats=[],palette={},selN=new Set(),selE=new Set(),selG=null,layerDrag=null,layerAnchor=null,pendingEdit=null,pendingSelect=null,lastCat='',editing=null,hover=null,drag=null,grid=1,view={s:4,ox:100,oy:400};
let SHEET=146,sheetInfo={h:0,over:0},lastInspectorSelection='';const PX_PER_MM=96/25.4;const vscode={getState:()=>({}),setState(){}},persist=()=>{},setTab=()=>{};const selectedLayers=new Set(),expandedLayers=new Set(['back','front']),collapsed=new Set(),sizes={small:10},figureFont='small',legend=false,styleClip=null,floating=null;
const byId=id=>nodes.find(n=>n.id===id),groupById=id=>groups.find(g=>g.id===id),members=()=>[],hierarchy=ns=>ns.map(n=>({id:n.id,kind:'node',children:[]})),inGroup=()=>false,isBox=n=>!n.kind;
const layout=n=>({w:n.width+2.27,h:n.minh||6.16,lines:[n.title]}),fontPt=()=>10,r1=String;
function render(){if(selN.size||selE.size||selG)selectedLayers.clear();renderLayers();renderInspector();}
const arrowsStyle='straight',PT=25.4/72.27,ARROW='#808080',ARROW_DASHED='#aaa',LINE=.45*PT,CODE_PT=8,TEXT_WIDTH=146,STROKE='#999',CODE='#888';
const px=x=>view.ox+x*view.s,py=y=>view.oy-y*view.s,styleColor=(c,d)=>c||d,weight=()=>1,dash=()=>'',paintOrder=()=>nodes;
const el=(tag,attrs,parent)=>{const e=new Element(tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent?.append(e);return e;};
const text=(g,x,y,t)=>{const e=el('text',{},g);e.textContent=t;return e;};
const drawIcon=()=>{},drawDecorations=()=>{},renderLegend=()=>{},drawGroups=()=>{},bbox=()=>({x0:-40,x1:80,y0:-30,y1:30}),etools=new Element('div');`);
load('\tfunction selectLayer(', '\tfunction groupSelection('); // selection/hierarchy helpers
load(' let layerScrollFrame', '\n\tfunction drawGroups(');
load(' function darkerColor(', '\n\tfunction toMm');
load('\tfunction renderInspector()', '\n\tconst SHORTCUTS');
load('\tfunction deleteSelection()', '\n\tfunction unit(');
run('render()');
const controls=()=>body.querySelector('#layer-controls');
const button=label=>controls().children.find(e=>e.textContent===label);
assert(button('Delete objects').disabled,'No selection disables Delete');
list.children.find(e=>e.dataset.id==='back').onclick({});
assert(!button('Delete layer').disabled);
const opacityRow=()=>inspector.querySelector('.opacity-row');
assert.equal(opacityRow().children[2].value,50);
opacityRow().children[2].value='60';opacityRow().children[2].onchange();
assert.equal(messages.pop().ops[0].opacity,.6);
list.children.find(e=>e.dataset.id==='inner').onclick({});
assert(button('Delete object'));
assert.equal(opacityRow().children[2].value,30);
opacityRow().children[1].value='0';opacityRow().children[1].oninput();opacityRow().children[1].onchange();
assert.equal(messages.pop().style.opacity,0);
assert.equal(run('byId("inner").style.opacity'),0,'Slider previews opacity immediately');
button('Delete object').onclick();
assert.equal(messages.pop().ops[0].op,'deleteNode');
assert(button('Delete objects').disabled);
button('+ Object').onclick();
assert.equal(messages.at(-1).op,'addNode');
assert.equal(messages.at(-1).x,75);assert.equal(messages.at(-1).y,25);
assert.equal(run('pendingEdit'),'new-box');
// Real post() supplies activeLayer for every added box.
assert(source.includes("o.op === 'addNode' ? { ...o, layer: activeLayer }"));
run("selN.clear();selE.add(0);render()");
assert(button('Delete object'));
assert.equal(opacityRow().children[2].value,30);
button('Delete object').onclick();assert.equal(messages.pop().ops[0].op,'deleteEdge');
// Layer reorder uses insertion lines, object-to-layer drops use a row highlight.
const ev=y=>({clientY:y,preventDefault(){},stopPropagation(){}});
run("layerDrag={layer:'front'}");
list.children[0].ondragover(ev(2));assert(list.children[0].classList.contains('drop-above'));
list.children[0].ondragover(ev(22));assert(list.children[0].classList.contains('drop-below'));
run("layerDrag=['inner']");
list.children[0].ondragover(ev(12));assert(list.children[0].classList.contains('drop-group'));
list.events.dragover(ev(195));
const fn=frames.values().next().value;fn();assert(list.scrollTop>0,'Scroll continues near lower edge');
list.events.dragleave({relatedTarget:body});assert.equal(run('layerScrollFrame'),null);
// Render the real SVG code and verify stack order, opacity, hit paths and endpoints.
load('\tfunction border(', '\n\tfunction bbox(');
load('\tfunction boxHalf(', '\n\tfunction selBox(');
load(' function drawBox(', '\n function drawDecorations(');
const renderCanvas=source.slice(source.indexOf('    function sheetObjects()'),source.indexOf('\n\t// The same legend'));
run(renderCanvas.replace('function render()', 'function renderCanvas()'));
run('selN.clear();selE.clear();byId("inner").style.opacity=.3;renderCanvas()');
const [,framesGroup,nodeGroup,arrowGroup]=svg.children;
assert(svg.children.indexOf(framesGroup)<svg.children.indexOf(nodeGroup));
assert(svg.children.indexOf(arrowGroup)>svg.children.indexOf(nodeGroup),'Arrows paint above boxes');
assert.equal(nodeGroup.children[1].attributes['fill-opacity'],'0.15');
assert.equal(arrowGroup.children[0].attributes['fill-opacity'],'0.15');
assert(arrowGroup.querySelectorAll('path').some(e=>e.dataset.edge===0),'Arrow hit path survives');
const from=run('baseEdgeGeom(edges[0]).pts[0]');
assert(Math.abs(from[0]-run('layout(byId("inner")).w/2'))<1e-8,'Arrow starts at inner border');
assert(from[0]<run('layout(byId("outer")).w/2'));
assert(nodeGroup.children[0].children.some(e=>e.dataset.node==='outer'),'Box has draggable hit area');
console.log('Layer/object Delete, opacity controls, add-at-centre editing, drop feedback, autoscroll, canvas stacking, hit paths and inner endpoints passed.');
// Variant A builds both panes directly and preserves its section order for every inspector.
const pane=id=>inspector.querySelector('#'+id);
const sectionNames=id=>pane(id).children.filter(d=>d.className==='inspector-section').map(d=>d.children[0].textContent);
run("selN=new Set(['inner']);selE.clear();renderInspector()");
assert.deepEqual(sectionNames('pane-selection'),['Text','Fill','Outline','Shape & decoration','Arrange']);
assert.deepEqual(sectionNames('pane-figure'),['Sheet','Text','Arrows','Legend','Grid','Categories']);
assert(pane('pane-selection').querySelector('.row'),'Single node inspector builds controls');
run("selN=new Set(['inner','target']);renderInspector()");
const rows=pane('pane-selection').querySelectorAll('.row');
const widthRow=rows.find(r=>r.children[0].textContent==='Width');
widthRow.children[1].value='32';widthRow.children[1].events.change();
assert.equal(messages.pop().ops.map(o=>o.id).join(','),'inner,target');
run("selN.clear();selE.add(0);renderInspector()");
assert(pane('pane-selection').querySelectorAll('.row').some(r=>r.children[0].textContent==='Route'),'Arrow route remains editable');
run("selE.clear();groups=[{id:'frame',name:'Frame',frame:'dashed',color:'grey'}];selG='frame';renderInspector()");
assert(!pane('pane-selection').querySelector('.empty'),'A selected frame is not an empty selection');
assert(pane('pane-selection').querySelectorAll('.row').some(r=>r.children[0].textContent==='Title at'));
console.log('Variant A panes, ordered inspector sections, multi-selection size batches, arrow and frame inspectors passed.');
// Panning objects must never recenter the sheet. Overflow includes free-icon captions.
const sheetBefore=run('sheetBox()');
run("selG=null;groups=[];byId('inner').x=300;renderCanvas()");
assert.equal(run('sheetBox().x0'),sheetBefore.x0);
assert.equal(run('sheetBox().x1'),sheetBefore.x1);
assert(run('sheetInfo.over')>0);
assert(svg.querySelectorAll('rect').some(e=>e.attributes.class==='over-flag'));
load('\tfunction fit()',"\twindow.addEventListener('message'");run('fit()');
assert.equal(run('view.ox'),400,'Fit centres the fixed sheet, independent of object x');
assert(run('view.s')>0);
console.log('Fixed sheet origin, overflow flags and sheet-fit geometry passed.');
