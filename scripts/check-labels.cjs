// Run after npm run compile. Checks the label/constraint model against real TikZ coordinates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const t = require('../out/tikz.js');
const root = path.resolve(__dirname, '..');
t.setIcons(JSON.parse(fs.readFileSync(path.join(root,'icons/icons.json'),'utf8')));
const fig = t.parse(t.TEMPLATE);
t.apply(fig,{op:'legend',on:false});
const add = (id,extra={}) => t.apply(fig,{op:'addNode',id,x:0,y:0,title:id,cat:'',...extra});
const byId = id => t.nodes(fig).find(n=>n.id===id);
const attach = (id,parent,anchor,ownAnchor=anchor,dx=0,dy=0) => t.apply(fig,{op:'attach',id,attachment:{parent,anchor,ownAnchor,dx,dy}});
for (const [i,titlePosition] of t.ANCHORS.entries()) {
 add(`title${i}`,{x:i%3*40,y:-Math.floor(i/3)*28,width:30,minh:22,title:`Title ${i}`,code:'code',titlePosition});
}
add('labelParent',{x:35,y:-125,width:84,minh:74,title:''});
add('parent',{x:35,y:-205,width:84,minh:40,title:'Parent',titlePosition:'south east'});
add('outsideParent',{x:165,y:-125,width:70,minh:64,title:''});
add('freeLabel',{x:110,y:0,kind:'label',title:'Free label',width:24,style:{font:'large',textColor:'#2468AC',border:'solid'}});
const opposite = Object.fromEntries(t.ANCHORS.map((a,i)=>[a,t.ANCHORS[8-i]]));
for (const [i,a] of t.ANCHORS.entries()) {
 add(`inside${i}`,{kind:'label',title:`In ${i}`,width:12,style:{font:'scriptsize',textColor:'accent',...(i%2 ? {border:'solid'} : {})}});
 const dx=a.includes('west')?2:a.includes('east')?-2:0, dy=a.includes('north')?-2:a.includes('south')?2:0;
 attach(`inside${i}`,'labelParent',a,a,dx,dy);
 if(a!=='center') {
  add(`outside${i}`,{kind:'label',title:`Out ${i}`,width:12});
  attach(`outside${i}`,'outsideParent',a,opposite[a],-dx,-dy);
 }
 add(`icon${i}`,{kind:'icon',icon:'board',width:6,minh:8,title:''});
 attach(`icon${i}`,'outsideParent',a,a,dx*5,dy*5);
}
add('child',{width:20,minh:12,title:'Child'});
attach('child','parent','north west','north west',1.5,-1.5);
add('grandchild',{kind:'label',title:'Nested',width:12});
attach('grandchild','child','south','north',0,-1);
t.apply(fig,{op:'addLayer',id:'hidden',name:'Hidden'});
add('hiddenParent',{x:100,y:-200,width:42,minh:16,layer:'hidden'});
add('visibleChild',{kind:'label',title:'Visible',width:14});
attach('visibleChild','hiddenParent','north west','north west',2,-2);
t.apply(fig,{op:'layerProps',id:'hidden',hidden:true});
const output = t.serialize(fig);
assert.equal(t.serialize(t.parse(output)),output,'Byte-identical round trip');
assert.equal(t.nodes(t.parse(output)).length,t.nodes(fig).length);
assert.equal(t.nodes(t.parse(output)).find(n=>n.id==='freeLabel').style.border,'solid');
assert.match(output,/sg label, sg label height=[\d.]+, draw=black!38/);
assert.match(output,/anchor=north west.*\(child\) at \(\[shift=\{\(1.5mm,-1.5mm\)\}\]parent.north west\)/);
// Layer order yields to dependencies without changing layer membership.
t.apply(fig,{op:'addLayer',id:'back',name:'Back'});
t.apply(fig,{op:'setLayer',ids:['parent'],layer:'back'});
t.apply(fig,{op:'reorderLayers',order:['layer1','back']});
const layered=t.serialize(fig);
assert(layered.indexOf('(parent) at')<layered.indexOf('(child) at'));
assert.equal(byId('child').layer,'layer1');
assert.equal(t.serialize(t.parse(layered)),layered);
// Moving a parent carries descendants; moving a child changes just its offset.
const old={x:byId('child').x,y:byId('child').y,dx:byId('child').attachment.dx};
t.apply(fig,{op:'move',id:'parent',x:byId('parent').x+10,y:byId('parent').y-5});
assert(Math.abs(byId('child').x-old.x-10)<1e-8);assert(Math.abs(byId('child').y-old.y+5)<1e-8);
assert.equal(byId('child').attachment.dx,old.dx);
t.apply(fig,{op:'move',id:'child',x:byId('child').x+3,y:byId('child').y+2});
assert.equal(byId('child').attachment.dx,old.dx+3);
const before=t.nodes(fig).map(n=>({id:n.id,x:n.x,y:n.y}));
t.apply(fig,{op:'batch',ops:['grandchild','child','parent'].map(id=>({op:'move',id,x:byId(id).x+4,y:byId(id).y+6}))});
for(const id of ['parent','child','grandchild']) {
 const prev=before.find(n=>n.id===id);assert(Math.abs(byId(id).x-prev.x-4)<1e-8);assert(Math.abs(byId(id).y-prev.y-6)<1e-8);
}
// Cycles and non-box parents are rejected; detach and deletion preserve world position.
const relation={...byId('child').attachment};
attach('parent','child','center');assert.equal(byId('parent').attachment,undefined);
attach('child','freeLabel','center');assert.deepEqual(byId('child').attachment,relation);
const target=t.parse(t.TEMPLATE), pasted=t.pasteOps(target,output,11,-7);
t.apply(target,{op:'batch',ops:pasted.ops});
for(const [i,n] of t.nodes(t.parse(output)).entries()) {
 const copy=t.nodes(target).find(p=>p.id===pasted.ids[i]);
 assert(copy);assert(Math.abs(copy.x-n.x-11)<1e-8);assert(Math.abs(copy.y-n.y+7)<1e-8);
}
const attached=byId('grandchild'), saved={x:attached.x,y:attached.y};
t.apply(fig,{op:'attach',id:'grandchild',attachment:null});assert.equal(attached.x,saved.x);assert.equal(attached.y,saved.y);
t.apply(fig,{op:'deleteNode',id:'parent'});assert.equal(byId('child').attachment,undefined);
// Compile the representative figure and measure every object's centre and title box height.
const pdfFig=t.parse(output), dir=fs.mkdtempSync(path.join(os.tmpdir(),'sakuga-labels-'));
const probes=t.nodes(pdfFig).map(n=>{
 const id=n.kind==='icon'?n.id+'-center':n.id;
 return String.raw`\pgfextractx{\dimen0}{\pgfpointanchor{${id}}{center}}\pgfextracty{\dimen2}{\pgfpointanchor{${id}}{center}}\typeout{POS-${n.id}=\the\dimen0,\the\dimen2}`+
 String.raw`\pgfextracty{\dimen0}{\pgfpointanchor{${id}}{north}}\pgfextracty{\dimen2}{\pgfpointanchor{${id}}{south}}\advance\dimen0 by -\dimen2\typeout{HEIGHT-${n.id}=\the\dimen0}`;
}).join('\n');
fs.writeFileSync(path.join(dir,'figure.tikz'),output);
fs.writeFileSync(path.join(dir,'figure.tex'),String.raw`\documentclass[11pt,border=2mm]{standalone}
\usepackage{fontspec}
\setsansfont{OpenSans-Regular.ttf}[Path=${root}/media/]
\setmonofont{texgyrecursor-regular.otf}[Path=${root}/media/]
\usepackage{tikz}
\usetikzlibrary{arrows.meta, fit, backgrounds, svg.path, shapes.geometric, patterns}
\begin{document}
`+output.replace('\\end{tikzpicture}',probes+'\n\\end{tikzpicture}')+'\n\\end{document}');
const cache=path.join(os.tmpdir(),'sakuga-tex-cache');fs.mkdirSync(cache,{recursive:true});
try {execFileSync('nice',['-n','19','lualatex','-interaction=batchmode','-halt-on-error','figure.tex'],{cwd:dir,env:{...process.env,TEXMFVAR:cache,TEXMFCACHE:cache},timeout:120000,stdio:'inherit'});}
catch(e){console.error(fs.readFileSync(path.join(dir,'figure.log'),'utf8').slice(-5000));throw e;}
const log=fs.readFileSync(path.join(dir,'figure.log'),'utf8'), mm=25.4/72.27;
for(const n of t.nodes(pdfFig)) {
 const pos=new RegExp(`POS-${n.id}=(-?[\\d.]+)pt,(-?[\\d.]+)pt`).exec(log);assert(pos,n.id);
 assert(Math.abs(+pos[1]*mm-n.x)<0.16,`${n.id} X: PDF ${+pos[1]*mm}, model ${n.x}`);
 assert(Math.abs(+pos[2]*mm-n.y)<0.16,`${n.id} Y: PDF ${+pos[2]*mm}, model ${n.y}`);
 const h=+new RegExp(`HEIGHT-${n.id}=([\\d.]+)pt`).exec(log)[1]*mm;
 assert(Math.abs(h-t.boxHalf(n)[1]*2)<0.16,`${n.id} height: PDF ${h}, canvas ${t.boxHalf(n)[1]*2}`);
}
assert(fs.statSync(path.join(dir,'figure.pdf')).size>0);
console.log(`All title positions, inside/outside labels, frames, icon anchors, nested moves, batches, layers, paste, detach, cycles, byte-identical round trips and LuaLaTeX geometry passed.\nArtifacts: ${dir}`);
