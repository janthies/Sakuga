// Model, real pointer handlers, inheritance, compatibility, and measured TikZ label positions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const t=require('../out/tikz'),routes=require('../media/routes');
const root=path.resolve(__dirname,'..'),work=path.join(root,'work/attached-labels');fs.mkdirSync(work,{recursive:true});
const source=fs.readFileSync(path.join(root,'media/editor.js'),'utf8');
const handlers={},messages=[];
const c=vm.createContext({Set,Map,Math,SakugaRoutes:routes,svg:{addEventListener:(k,v)=>handlers[k]=v,setPointerCapture(){}},document:{createElement:()=>({})},post:o=>messages.push(o),render(){},endEdit(){},toMm:e=>({x:e.x,y:e.y}),layout:n=>{const [w,h]=t.boxHalf(n);return {w:w*2,h:h*2};},textMm:s=>s.length*1.4,show:s=>s,paintOrder:()=>[],vscode:{postMessage(){}}});
const run=s=>vm.runInContext(s,c),load=(a,b)=>run(source.slice(source.indexOf(a),source.indexOf(b)));
run(`let nodes=[],edges=[],groups=[],cats=[],styles=[],shared=[],palette={},selN=new Set(),selE=new Set(),selG=null,styleClip=null,drag=null,hover=null,editing=null,space=false,lastCat='',openStyles=new Set(),pendingStyleFocus=null,pendingSelect=null;const selectedLayers=new Set(),src={value:''},arrowsStyle='manhattan',figureFont='small',sizes={scriptsize:8,footnotesize:9,small:10,normalsize:10.95,large:12},CODE_PT=8,PT=25.4/72.27;const byId=id=>nodes.find(n=>n.id===id),catOf=id=>cats.find(c=>c.key===id),snap=x=>x,fine=x=>Math.round(x*10)/10,r1=String;`);
load(' const ANCHORS','\n\tfunction toMm');load('\tfunction border(', '\tfunction boxHalf');load('\tfunction boxHalf','\tfunction tip(');load('\tfunction copyStyle','\tfunction unit(');load("\tsvg.addEventListener('pointerdown'","\tsvg.addEventListener('wheel'");
const fig=t.parse(t.TEMPLATE),apply=o=>t.apply(fig,o);
for(const [id,x,y] of [['a',0,0],['b',60,0],['c',0,-40]])apply({op:'addNode',id,x,y,title:id,cat:'work'});
apply({op:'addGroup',id:'world',name:'World',color:'blue'});apply({op:'setGroup',ids:['c'],group:'world'});
apply({op:'addEdge',from:'a',to:'b',route:'straight',label:'Two\\\\lines',style:{step:2,color:'blue'}});
const sync=()=>{c.state=JSON.parse(JSON.stringify({nodes:t.nodes(fig),edges:t.edges(fig),groups:t.groups(fig),cats:t.categories(fig),palette:t.PALETTE}));run('nodes=state.nodes;edges=state.edges;groups=state.groups;cats=state.cats;palette=state.palette;selN=new Set();selE.clear();selG=null;');};
const canonical=()=>{const s=t.serialize(fig);assert.equal(t.serialize(t.parse(s)),s);return s;};
const event=(x,y,dataset={})=>({x,y,button:0,pointerId:1,target:{dataset,classList:{contains:()=>false}}});
sync();
// Clicking text selects only the label; moving uses the real handler and snaps to quarter position.
const G=run('arrowLabelGeom(edges[0])'),A=run('baseEdgeGeom({...edges[0],labelStyle:{}})'),q=A.pts[0].map((v,k)=>v+(A.pts[1][k]-v)*.25);
handlers.pointerdown(event(...G.p,{label:JSON.stringify({index:0})}));assert.equal(run('selE.size'),0);assert.equal(run('selN.label.index'),0);
handlers.pointermove(event(q[0],q[1]+8));handlers.pointerup(event(q[0],q[1]+8));
const move=messages.pop();assert.equal(move.op,'label');assert.equal(move.style.pos,.25);assert.equal(move.style.side,'above');assert(move.style.dy);apply(move);assert.match(canonical(),/pos=0.25/);assert.match(canonical(),/shift=\{/);
// Own colour wins; resetting to inherit follows the changed parent.
apply({op:'label',index:0,style:{color:'#123456',bold:true,italic:true,background:false}});canonical();
apply({op:'style',indices:[0],style:{color:'red'}});assert.match(canonical().split('\n').find(l=>l.startsWith('\\draw')),/text=sgc123456/);
apply({op:'label',index:0,style:{color:null}});assert(!t.edges(fig)[0].labelStyle.color);assert.match(canonical().split('\n').find(l=>l.startsWith('\\draw')),/text=sgRed/);
// Detach keeps badge, colour, combined emphasis, font, and coordinates; reattach is one operation.
apply({op:'detachLabel',index:0,id:'detached',x:21.5,y:8,width:24});
let n=t.nodes(fig).find(n=>n.id==='detached');assert.equal(n.style.step,2);assert.equal(n.style.text,'bold-italic');assert.equal(n.style.textColor,'red');assert.equal(n.x,21.5);assert.equal(t.edges(fig)[0].label,'');
const detached=t.parse(canonical());assert.equal(t.nodes(detached).find(n=>n.id==='detached').title,'Two\\\\lines');
apply({op:'attachLabel',id:'detached',index:0,style:{pos:.75,side:'above',dy:2}});assert.equal(t.edges(fig)[0].style.step,2);assert(!t.nodes(fig).some(n=>n.id==='detached'));canonical();
// A second attachment adds another native path node. All slots round-trip independently.
apply({op:'addNode',id:'extra',kind:'label',x:20,y:10,title:'Extra {nested}',cat:'',style:{textColor:'green',font:'large'}});apply({op:'attachLabel',id:'extra',index:0,style:{pos:.25,side:'below',dx:1,dy:-3}});
assert.equal(t.edges(fig)[0].labels.length,1);assert.equal((canonical().split('\n').find(l=>l.startsWith('\\draw')).match(/node\[sg elabel/g)||[]).length,2);
apply({op:'label',index:0,slot:0,text:'Edited',style:{bold:true,background:true}});canonical();apply({op:'detachLabel',index:0,slot:0,id:'extra2',x:20,y:-10});canonical();assert.equal(t.edges(fig)[0].labels.length,0);
// Attach to a frame replaces its title; detaching clears it. Frame label style inherits on reset.
apply({op:'attachLabel',id:'extra2',group:'world',style:{dx:3,dy:2}});assert.equal(t.groups(fig)[0].name,'Edited');canonical();
apply({op:'label',group:'world',style:{color:null,font:null,bold:null}});apply({op:'groupProps',id:'world',color:'red'});canonical();
apply({op:'detachLabel',group:'world',id:'title-free',x:0,y:-25});canonical();assert.equal(t.groups(fig)[0].name,'');
apply({op:'attachLabel',id:'title-free',group:'world',style:{dx:1,dy:2}});canonical();
// Style clipboard uses label properties only and clears the destination's own values.
sync();run('selN.label={index:0};copyStyle();selN.label={group:"world"};pasteStyle()');const pasted=messages.pop();assert.equal(pasted.op,'label');assert.equal(pasted.group,'world');assert(!Object.hasOwn(pasted.style,'pos'));apply(pasted);canonical();
// Old frame presets keep fill, outline, colour, width, and corner preset.
for(const frame of t.FRAMES){const f=t.parse(`% sakuga group old {Old} ${frame} blue\n${t.TEMPLATE}`),g=t.groups(f)[0],look=t.frameAppearance(g);assert.equal(look.fill,frame==='region' ? 'tint' : 'none');assert.equal(look.outline,['region','none'].includes(frame) ? 'none' : frame);assert.equal(look.color,'#737373');assert.equal(t.serialize(t.parse(t.serialize(f))),t.serialize(f));}
// A former folder can acquire just a fill, without accidentally acquiring an outline.
const folder=t.parse(t.TEMPLATE);t.apply(folder,{op:'addGroup',id:'folder',name:'Folder',frame:'none'});t.apply(folder,{op:'groupProps',id:'folder',fill:'tint'});assert.equal(t.frameAppearance(t.groups(folder)[0]).outline,'none');
// Legacy placement survives an own side/position, and reset still inherits the old preset.
apply({op:'style',indices:[0],style:{side:'below',position:'start'}});apply({op:'label',index:0,style:{side:'above',pos:.75}});let saved=t.parse(canonical());assert.equal(t.edges(saved)[0].style.side,'below');assert.equal(t.edges(saved)[0].style.position,'start');
// Label edits retain unanchored routing geometry.
sync();run("edges[0].labelStyle=undefined;edges[0].style={};edges[0].route='auto';nodes[1].x=12;nodes[1].y=-30");const old=run('baseEdgeGeom(edges[0])');run('edges[0].labelStyle={dx:2}');const edited=run('baseEdgeGeom(edges[0])');assert.equal(JSON.stringify(edited.pts),JSON.stringify(old.pts));
// An inspector edit and its document echo retain label selection.
const stateHandlers={};c.window={addEventListener:(key,fn)=>stateHandlers[key]=fn};c.showText=()=>{};c.fit=()=>{};
run(`let SHEET=146;let layers=[],activeLayer='layer1',freshBox=null,fitted=true,pendingEdit=null,defaultWidth=26,legend=false;const groupById=id=>groups.find(g=>g.id===id),members=()=>[];`);
// Use a separate scope for mutable figure settings supplied by the extension.
const messageCode=source.slice(source.indexOf("\twindow.addEventListener('message'"),source.indexOf("\tnew ResizeObserver(",source.indexOf("\twindow.addEventListener('message'")));
run(`{let figureFont='small',arrowsStyle='manhattan';${messageCode}}`);
sync();run('selN.label={index:0}');stateHandlers.message({data:{type:'state',nodes:t.nodes(fig),edges:t.edges(fig),groups:t.groups(fig),categories:t.categories(fig),palette:t.PALETTE,layers:t.layers(fig),text:canonical()}});assert.equal(run('selN.label.index'),0);
// Every label property, including false values and routed-segment selection, is stable.
for(const style of [{pos:.25,dx:-2,dy:3,side:'left',font:'large',bold:false,italic:true,color:'#123456',background:false},{pos:.75,segment:0,side:'right',bold:true,italic:false,background:true},{pos:.5,dx:0,dy:0,font:'',color:'',side:''}]){apply({op:'label',index:0,style});canonical();}
apply({op:'label',index:0,style:{pos:.25,segment:0,side:'above',dx:2,dy:3,font:'small',bold:true,italic:false,background:true}});
apply({op:'label',group:'world',style:{dx:2,dy:3,font:'small'}});
sync();const expected=run('arrowLabelGeom(edges[0]).p'),frame=run('frameTitleGeom(groups[0])');
// Name generated native nodes only for probing; editor files retain their normal dialect.
let output=canonical().replace('node[sg elabel','node[name=probe, sg elabel').replace('node[sg glabel','node[name=frameprobe, sg glabel');
const probes=String.raw`\path (probe.center) \pgfextra{\pgfgetlastxy{\sgx}{\sgy}\typeout{LABEL=\sgx,\sgy}};
\path (frameprobe.south west) \pgfextra{\pgfgetlastxy{\sgx}{\sgy}\typeout{TITLE=\sgx,\sgy}};`;
output=output.replace('\\end{tikzpicture}',probes+'\n\\end{tikzpicture}');
fs.writeFileSync(path.join(work,'figure.tex'),String.raw`\documentclass[11pt,border=1mm]{standalone}
\usepackage{fontspec}
\setsansfont{OpenSans-Regular.ttf}[Path=${root}/media/,AutoFakeBold=2,AutoFakeSlant=0.2]
\usepackage{tikz}
\usetikzlibrary{arrows.meta,fit,backgrounds,svg.path,shapes.geometric,patterns}
\begin{document}
`+output+'\n\\end{document}\n');
const cache=path.join(root,'work/tex-cache');fs.mkdirSync(cache,{recursive:true});execFileSync('nice',['-n','19','lualatex','-interaction=batchmode','-halt-on-error','figure.tex'],{cwd:work,env:{...process.env,TEXMFVAR:cache,TEXMFCACHE:cache},stdio:'inherit',timeout:120000});
const log=fs.readFileSync(path.join(work,'figure.log'),'utf8');
for(const [key,point] of [['LABEL',expected],['TITLE',[frame.anchor[0]+2,frame.anchor[1]+3]]]){const m=new RegExp(`${key}=(-?[\\d.]+)pt,(-?[\\d.]+)pt`).exec(log);assert(m,key);for(let k=0;k<2;k++)assert(Math.abs(+m[k+1]*25.4/72.27-point[k])<.035,`${key} ${k}: ${+m[k+1]*25.4/72.27} != ${point[k]}`);}
console.log('Attached label drag, styles, inheritance, badge detach/attach, additional nodes, legacy frames, canonical saves and native TikZ positions passed.');
