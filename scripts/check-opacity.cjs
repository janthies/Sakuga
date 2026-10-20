// Run after npm run compile; retain the requested opacity PDF and TeX in /tmp.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {spawn} = require('node:child_process');
const t = require('../out/tikz.js');
t.setIcons(JSON.parse(fs.readFileSync(path.join(__dirname,'../icons/icons.json'),'utf8')));
let fig = t.parse(t.TEMPLATE);
const apply = op => t.apply(fig,op);
const roundTrip = () => {
 const text = t.serialize(fig);
 fig = t.parse(text);
 assert.equal(t.serialize(fig),text,'Exact opacity round trip');
 return text;
};
const add = (id,extra={}) => apply({op:'addNode',id,title:id,x:0,y:0,cat:'',...extra});
apply({op:'legend',on:false});
apply({op:'layerProps',id:'layer1',opacity:0.5});
add('outer',{width:72,minh:40,title:'',style:{fill:'blue'}});
add('inner',{width:18,minh:12,icon:'board',style:{opacity:0.3}});
add('target',{x:65,width:18});
add('label',{kind:'label',x:0,y:-30,title:'Label',style:{opacity:0.3}});
add('icon',{kind:'icon',icon:'board',x:35,y:-30,width:8,minh:8,style:{opacity:0.3}});
apply({op:'addEdge',from:'inner',to:'target',style:{opacity:0.3}});
apply({op:'addGroup',id:'region',name:'Region',frame:'region',color:'grey',parent:''});
apply({op:'setGroup',ids:['label','icon'],group:'region'});
let text = roundTrip();
assert.match(text,/% sakuga layer layer1 \{Layer 1\} opacity=0.5/);
for(const id of ['inner','label','icon']) {
 assert.equal(t.nodes(fig).find(n => n.id === id).style.opacity,0.3);
 assert.equal(t.nodeOpacity(fig,t.nodes(fig).find(n => n.id === id)),0.15);
 assert.match(text.split('\n').find(l => l.includes(`(${id}) at`)),/opacity=0.15, sg opacity=0.3/);
}
assert.equal(t.edges(fig)[0].style.opacity,0.3);
assert.match(text.split('\n').find(l=>l.startsWith('\\draw[arr')),/opacity=0.15, sg opacity=0.3/);
assert(text.indexOf('\\draw[arr') > text.indexOf('(target) at'));
assert.match(text,/\\pic\[opacity=0.15\] at .*inner\.west/,'Attached icon has the same opacity');
for(let i=0;i<4;i++) { roundTrip(); }
apply({op:'layerProps',id:'layer1',opacity:0});
roundTrip();
assert.equal(t.nodes(fig).find(n=>n.id==='inner').style.opacity,0.3,'Zero layer preserves own opacity');
apply({op:'layerProps',id:'layer1',hidden:true,locked:true,opacity:0.5});
roundTrip();
assert.equal(t.nodes(fig).find(n=>n.id==='icon').style.opacity,0.3,'Hidden icon retains opacity');
apply({op:'layerProps',id:'layer1',hidden:false,locked:false,opacity:1});
text=roundTrip();
assert(!text.includes('sg opacity='));
assert.match(text.split('\n').find(l=>l.includes('(inner) at')),/opacity=0.3/);
apply({op:'style',ids:['inner'],indices:[0],style:{opacity:1}});
text=roundTrip();
assert(!text.split('\n').find(l=>l.includes('(inner) at')).includes('opacity='),'100% is omitted');
assert(!text.split('\n').find(l=>l.startsWith('\\draw[arr')).includes('opacity='));
apply({op:'layerProps',id:'layer1',opacity:0.5});
apply({op:'style',ids:['inner'],indices:[0],style:{opacity:0.3}});
// Moving objects and duplicating layers retain the editable value.
apply({op:'addLayer',id:'opaque',name:'Opaque'});
apply({op:'setLayer',ids:['inner'],layer:'opaque'});
roundTrip();
assert.equal(t.nodeOpacity(fig,t.nodes(fig).find(n=>n.id==='inner')),0.3);
apply({op:'setLayer',ids:['inner'],layer:'layer1'});
apply({op:'duplicateLayer',id:'layer1',newId:'copy'});
roundTrip();
assert.equal(t.layers(fig).find(l=>l.id==='copy').opacity,0.5);
// Build only the original layer to keep the requested comparison figure compact.
fig.lines=fig.lines.filter(l=> !(l.t==='node' && l.n.layer==='copy') && !(l.t==='layer' && l.layer.id==='copy') && !(l.t==='edge' && l.e.from!=='inner') && !(l.t==='group' && l.g.id!=='region'));
text=roundTrip();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sakuga-opacity-'));
fs.writeFileSync(path.join(dir,'figure.tikz'),text);
fs.writeFileSync(path.join(dir,'check.tex'),'\\documentclass[11pt]{article}\n\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta,fit,backgrounds,svg.path}\n\\begin{document}\n'+text+'\n\\end{document}\n');
const cache=path.join(os.tmpdir(),'sakuga-tex-cache');fs.mkdirSync(cache,{recursive:true});
const child=spawn('lualatex',['-interaction=nonstopmode','-halt-on-error','check.tex'],{cwd:dir,env:{...process.env,TEXMFVAR:cache,TEXMFCACHE:cache},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('close',code=>{
 if(code!==0) { console.error(output);console.error(`Artifacts: ${dir}`);process.exitCode=1;return; }
 assert(fs.statSync(path.join(dir,'check.pdf')).size>0);
 console.log(`Opacity round trips, zero/100%, hidden objects, moves, duplication, icons, arrows and LuaLaTeX passed. Artifacts: ${dir}`);
});
