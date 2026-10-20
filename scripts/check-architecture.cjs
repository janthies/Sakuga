// Architecture dialect regression: shared geometry, compatibility, properties and real TeX anchors.
const assert=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {execFileSync}=require('node:child_process');
const t=require('../out/tikz'), routing=require('../media/routes');
const root=path.resolve(__dirname,'..');
const f=t.parse(t.TEMPLATE), apply=o=>t.apply(f,o);
for(const [id,x,y] of [['a',0,0],['b',50,0],['c',0,-35]]) apply({op:'addNode',id,x,y,title:id,cat:'work',minh:12});
apply({op:'addGroup',id:'inner',name:'Inner',frame:'region',color:'blue',parent:'outer',titlePosition:'inside-top-right',titleFont:'small'});
apply({op:'addGroup',id:'outer',name:'Outer',frame:'solid',color:'grey',parent:'',lineWidth:1.05,frameColor:'#123456'});
apply({op:'setGroup',ids:['a','c'],group:'inner'});
apply({op:'addEdge',from:'b',to:'outer',fromAnchor:'west',toAnchor:'east',route:'straight',label:'Request\\\\two lines',style:{step:1,color:'#123456',lineWidth:.8,tipLength:2.25,tipWidth:1.75,side:'above'}});
apply({op:'addEdge',from:'outer',to:'b',fromAnchor:'east',toAnchor:'west',route:'straight',label:'Reply',style:{step:2,side:'below'}});
apply({op:'addEdge',from:'a',to:'c',route:'u',fromAnchor:'west',toAnchor:'west',label:'Measured'});
const roundtrip=fig=>{const s=t.serialize(fig);assert.equal(t.serialize(t.parse(s)),s);return s;};
const s=roundtrip(f), parsed=t.parse(s);
assert.equal(t.edges(parsed)[0].style.lineWidth,.8);
assert.equal(t.edges(parsed)[0].style.step,1);
assert.equal(t.edges(parsed)[0].label,'Request\\\\two lines');
assert.equal(t.edges(parsed)[0].fromAnchor,'west');
assert.equal(t.edges(parsed)[2].toAnchor,'west');
assert.equal(t.groups(parsed)[0].titlePosition,'inside-top-right');
assert(s.indexOf('% sakuga groups end')<s.indexOf('\\draw['),'Frames must be defined before arrows');
const g0=t.specialGeometry(f,t.edges(f)[0]),g1=t.specialGeometry(f,t.edges(f)[1]);
assert.equal(g0.pts[0][1],3.5);assert.equal(g1.pts.at(-1)[1],-3.5);
assert.deepEqual(g0.pts[0].slice(1),g0.pts.at(-1).slice(1));
apply({op:'arrow',index:0,lane:0});roundtrip(f);assert.equal(t.specialGeometry(f,t.edges(f)[0]).pts[0][1],0);
apply({op:'arrow',index:0,lane:null});
// Every new option must survive a canonical save and a second save.
for(const frame of t.FRAMES) for(const pos of ['above-left','above-center','inside-top-left','inside-top-right','below-left','legacy']) {
 const test=t.parse(s);t.apply(test,{op:'groupProps',id:'inner',frame,titlePosition:pos,titleBold:false,titleFont:'large',titleColor:'#654321',padding:4});roundtrip(test);
}
for(const route of ['auto','straight','manhattan','curved','u','hvh','vhv','bend']) for(const side of ['above','below','left','right']) {
 const test=t.parse(s);t.apply(test,{op:'arrow',index:0,route,mid:-20,bend:25,lane:2});t.apply(test,{op:'style',indices:[0],style:{side,lineWidth:1.2}});roundtrip(test);
}
for(const head of ['end','none','both']) for(const end of ['Latex','Stealth','triangle','barb','circle','bar','none']) {
 const test=t.parse(s);t.apply(test,{op:'arrow',index:0,head});t.apply(test,{op:'style',indices:[0],style:{end,tipLength:2.5,tipWidth:2}});roundtrip(test);
}
for(const label of ['', 'No badge', 'Two\\\\lines']) {const test=t.parse(s);t.apply(test,{op:'arrow',index:0,label});t.apply(test,{op:'style',indices:[0],style:{side:'left',position:'end',step:label ? 0 : 8}});roundtrip(test);}
const fresh=t.parse(t.TEMPLATE);t.apply(fresh,{op:'addGroup',id:'outer',name:'Outer'});assert.equal(t.groups(fresh)[0].frame,'dashed');assert.equal(t.groups(fresh)[0].titleBold,true);t.apply(fresh,{op:'addGroup',id:'child',name:'Child'});t.apply(fresh,{op:'setGroup',ids:['child'],group:'outer'});assert.equal(t.groups(fresh)[0].frame,'solid');roundtrip(fresh);
const legacy=t.parse('% sakuga group old {Old} dashed grey\n\\begin{tikzpicture}\n\\end{tikzpicture}');
assert.equal(t.groups(t.parse(roundtrip(legacy)))[0].titlePosition,undefined,'Legacy frames retain title placement');
const empty=t.parse(t.TEMPLATE);t.apply(empty,{op:'addNode',id:'x',x:0,y:0,title:'x',cat:'work'});t.apply(empty,{op:'addNode',id:'y',x:40,y:0,title:'y',cat:'work'});t.apply(empty,{op:'addEdge',from:'x',to:'y',style:{lineWidth:.45,tipLength:1.5,tipWidth:1.2}});
assert(!roundtrip(empty).split('\n').find(l=>l.startsWith('\\draw')).includes('sg tip'));
const pasted=t.pasteOps(t.parse(t.TEMPLATE),s,5,-5);const target=t.parse(t.TEMPLATE);t.apply(target,{op:'batch',ops:pasted.ops});assert.equal(t.edges(target)[0].fromAnchor,'west');assert.equal(t.edges(target).length,3);assert.equal(t.groups(target).length,2);assert.equal(t.nodes(target).length,3);roundtrip(target);
// Measure endpoints against the actual generated fit-node anchors in LuaLaTeX.
const lines=s.split('\n').filter(l=>l.startsWith('\\draw['));
const expected=[];
const probes=lines.flatMap((line,i)=>{
 const G=t.specialGeometry(f,t.edges(f)[i]);const pts=G.curve || G.pts;
 const coords=line.match(/\(\[xshift=[^)]*\)/g);
 return coords.map((coord,j)=>{const key=`SGPROBE${i}${j}`;expected.push([key,pts[j===0 ? 0 : pts.length-1]]);return `\\path ${coord} \\pgfextra{\\pgfgetlastxy{\\sgx}{\\sgy}\\typeout{${key}=\\sgx,\\sgy}};`;});
}).join('\n');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sakuga-architecture-'));
fs.writeFileSync(path.join(dir,'figure.tex'),String.raw`\documentclass[11pt,border=1mm]{standalone}
\usepackage{fontspec}
\setsansfont{OpenSans-Regular.ttf}[Path=${root}/media/,AutoFakeBold=2,AutoFakeSlant=0.2]
\setmonofont{texgyrecursor-regular.otf}[Path=${root}/media/]
\usepackage{tikz}
\usetikzlibrary{arrows.meta,fit,backgrounds,svg.path,shapes.geometric,patterns}
\begin{document}
`+s.replace('\\end{tikzpicture}',probes+'\n\\end{tikzpicture}')+'\n\\end{document}');
const cache='/tmp/sakuga-tex-cache';fs.mkdirSync(cache,{recursive:true});
execFileSync('nice',['-n','19','lualatex','-interaction=batchmode','-halt-on-error','figure.tex'],{cwd:dir,env:{...process.env,TEXMFVAR:cache,TEXMFCACHE:cache},stdio:'inherit',timeout:120000});
const log=fs.readFileSync(path.join(dir,'figure.log'),'utf8');
for(const [key,point] of expected) {const m=new RegExp(`${key}=(-?[\\d.]+)pt,(-?[\\d.]+)pt`).exec(log);assert(m,key);for(let k=0;k<2;k++) assert(Math.abs(+m[k+1]*25.4/72.27-point[k])<.03,`${key}: TeX/canvas mismatch`);}
console.log(`Architecture properties, lanes, anchors, all frame titles, tips, defaults, round trips and TeX geometry passed. Artifacts: ${dir}`);
