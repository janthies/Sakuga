// Exercise the real canvas pointer/clipboard handlers without a browser dependency.
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm');
const t=require('../out/tikz.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../media/editor.js'),'utf8');
const handlers={}, messages=[], edited=[];
const context=vm.createContext({
 Set,Map,Math,
 svg:{addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture(){}},
 document:{createElement:()=>({children:[],attributes:{},append(...els){this.children.push(...els);},setAttribute(k,v){this.attributes[k]=v;}})},
 post:op=>messages.push(op), vscode:{postMessage:m=>messages.push(m)},
 render(){}, endEdit(){}, startEdit:id=>edited.push(id),
 toMm:ev=>({x:ev.x,y:ev.y}),
 layout:n=>{const [w,h]=t.boxHalf(n);return {w:w*2,h:h*2,lines:[n.title]};},
 guides:()=>({dx:0,dy:0,lines:[]})
});
const run=code=>vm.runInContext(code,context);
const load=(start,end)=>run(source.slice(source.indexOf(start),source.indexOf(end)));
run(`let nodes=[],edges=[],cats=[],styles=[],shared=[],selN=new Set(),selE=new Set(),drag=null,selG=null,hover=null,editing=null,space=false,pendingSelect=null,lastCat='';
const byId=id=>nodes.find(n=>n.id===id);const snap=v=>v,fine=v=>Math.round(v*10)/10,r1=String;
const selectedLayers=new Set();const src={value:''};const defaultWidth=26;`);
load(' const ANCHORS','\n\tfunction toMm');
load('\tfunction nodeAt','\t// Point on the border');
load('\tfunction nodeLine','\n\tfunction label(');
load("\tsvg.addEventListener('pointerdown'","\tsvg.addEventListener('wheel'");
const fig=t.parse(t.TEMPLATE);
const add=(id,extra={})=>t.apply(fig,{op:'addNode',id,x:0,y:0,title:id,cat:'',...extra});
add('parent',{width:80,minh:60});
add('label',{kind:'label',width:12,x:90,y:80});
add('icon',{kind:'icon',icon:'board',width:8,minh:8,x:100,y:80});
add('box',{width:16,minh:10,x:120,y:80});
const sync=()=>{context.state=JSON.parse(JSON.stringify(t.nodes(fig)));context.tikz=t.serialize(fig);run('nodes=state;src.value=tikz;selN.clear();selE.clear();');};
const ev=(x,y,dataset={},extra={})=>({x,y,button:0,pointerId:1,target:{dataset,classList:{contains:()=>false}},...extra});
sync();
run("const picker=anchorPicker('north west',a=>post({anchor:a}));picker.children[8].onclick();");
assert.equal(run('picker.children.length'),9);
assert.equal(run('picker.children[0].attributes["aria-pressed"]'),'true');
assert.equal(messages.pop().anchor,'south east');
// All nine target cells; objects and descendants cannot become their own parents.
for(const [i,anchor] of t.ANCHORS.entries()) {
 const x=(i%3-1)*25,y=(1-Math.floor(i/3))*20;
 assert.equal(run(`dropAnchor({x:${x},y:${y}},['label']).anchor`),anchor);
}
assert.equal(run("dropAnchor({x:0,y:0},['parent'])"),null);
for(const id of ['label','icon','box']) {
 sync();const n=t.nodes(fig).find(n=>n.id===id);
 handlers.pointerdown(ev(n.x,n.y,{node:id}));
 handlers.pointermove(ev(-28,20));
 assert.equal(run('drag.target.anchor'),'north west');
 handlers.pointerup(ev(-28,20));
 const batch=messages.pop();assert.equal(batch.op,'batch');
 assert(batch.ops.some(o=>o.op==='attach'&&o.id===id&&o.attachment.parent==='parent'));
 t.apply(fig,batch);
}
sync();
handlers.dblclick(ev(0,0,{node:'label'}));assert.equal(edited.pop(),'label');
// Re-dragging within the parent changes offsets without replacing either anchor.
const label=t.nodes(fig).find(n=>n.id==='label'), before={...label.attachment}, start={x:label.x,y:label.y};
handlers.pointerdown(ev(start.x,start.y,{node:'label'}));
handlers.pointermove(ev(20,-15));
assert.equal(run("byId('label').attachment.anchor"),before.anchor);
handlers.pointerup(ev(20,-15));
const shifted=messages.pop();assert(!shifted.ops.some(o=>o.op==='attach'));
t.apply(fig,shifted);
assert.equal(label.attachment.anchor,before.anchor);
assert(Math.abs(label.attachment.dx-before.dx-(20-start.x))<0.11);
// Alt at drop disables attachment even if the grid was visible in the last move.
t.apply(fig,{op:'attach',id:'box',attachment:null});sync();
const box=t.nodes(fig).find(n=>n.id==='box');
handlers.pointerdown(ev(box.x,box.y,{node:'box'}));handlers.pointermove(ev(10,10));
handlers.pointerup(ev(10,10,{}, {altKey:true}));
assert(!messages.pop().ops.some(o=>o.op==='attach'));
// Moving the parent previews child movement and keeps the relation on release.
sync();const childX=run("byId('label').x");
handlers.pointerdown(ev(0,0,{node:'parent'}));handlers.pointermove(ev(7,4));
assert(Math.abs(run("byId('label').x")-childX-7)<0.01);
handlers.pointerup(ev(7,4));t.apply(fig,messages.pop());
// Canvas stacking follows the same parent-before-child order as TikZ, across layers.
run("nodes=[byId('label'),byId('parent')];");
assert.equal(run("paintOrder().map(n=>n.id).join(',')"),'parent,label');
// Clipboard and duplicate keep label kind, styling and attachments.
sync();run("selN=new Set(['label']);");
const copied=run('clip()');assert.equal(t.nodes(t.parse(copied)).find(n=>n.id==='label').kind,'label');
assert(t.nodes(t.parse(copied)).some(n=>n.id==='parent'));
run("duplicate(['parent','label'],5,-5);");
const duplicate=messages.pop(), additions=duplicate.ops.filter(o=>o.op==='addNode');
const labelCopy=additions.find(o=>o.kind==='label'), parentCopy=additions.find(o=>!o.kind);
assert(duplicate.ops.some(o=>o.op==='attach'&&o.id===labelCopy.id&&o.attachment.parent===parentCopy.id));
console.log('Anchor picker/grid, dropping labels/icons/boxes, Alt drop, offset dragging, double-click editing, parent previews, stacking, clipboard and duplicate passed.');
