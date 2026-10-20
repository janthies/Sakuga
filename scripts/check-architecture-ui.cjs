// Exercise frame drops, new fields and style transfer through the editor's real handlers.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const t=require('../out/tikz'),routes=require('../media/routes');
const source=fs.readFileSync(require('node:path').join(__dirname,'../media/editor.js'),'utf8');
class Element {
 constructor(){this.children=[];this.attributes={};this.events={};this.dataset={};this.style={};this.classList={contains:()=>false};this.value='';}
 append(...cs){this.children.push(...cs);} appendChild(c){this.append(c);return c;}
 setAttribute(k,v){this.attributes[k]=v;} addEventListener(k,v){this.events[k]=v;}
}
const handlers={},messages=[];
const c=vm.createContext({Set,Map,Math,SakugaRoutes:routes,svg:{addEventListener:(k,v)=>handlers[k]=v,setPointerCapture(){}},document:{createElement:()=>new Element()},post:o=>messages.push(o),render(){},toMm:e=>({x:e.x,y:e.y}),endEdit(){},startEdit(){},vscode:{postMessage:o=>messages.push(o)},layout:n=>{const [w,h]=t.boxHalf(n);return {w:w*2,h:h*2};},paintOrder:()=>[],textMm:s=>s.length*1.4,show:s=>s});
const run=s=>vm.runInContext(s,c),load=(a,b)=>run(source.slice(source.indexOf(a),source.indexOf(b)));
run(`let nodes=[],edges=[],groups=[],cats=[],styles=[],shared=[],palette={},selN=new Set(),selE=new Set(),selG=null,styleClip=null,drag=null,hover=null,editing=null,space=false,lastCat='',pendingSelect=null;const selectedLayers=new Set(),src={value:''};const arrowsStyle='manhattan',CODE_PT=8,PT=25.4/72.27;const byId=id=>nodes.find(n=>n.id===id),catOf=id=>cats.find(c=>c.key===id),snap=x=>x,fine=x=>x,r1=String;`);
load(' const ANCHORS','\n\tfunction toMm');
load('\tfunction nodeAt','\t// Point on the border');
// Override paintOrder after nodeAt's definition via the provided function.
c.paintOrder=()=>run('nodes');
load('\tfunction boxHalf','\tfunction tip(');
load('\tfunction copyStyle','\tfunction unit(');
load("\tsvg.addEventListener('pointerdown'","\tsvg.addEventListener('wheel'");
const fig=t.parse(t.TEMPLATE),apply=o=>t.apply(fig,o);
apply({op:'addNode',id:'a',x:0,y:0,title:'A',cat:'work',minh:12});apply({op:'addNode',id:'b',x:70,y:0,title:'B',cat:'work',minh:12});
apply({op:'addGroup',id:'g',name:'Frame',frame:'dashed',color:'blue',parent:''});apply({op:'setGroup',ids:['a'],group:'g'});
apply({op:'addEdge',from:'b',to:'a',style:{step:2,color:'blue',lineWidth:.75,tipWidth:2,tipLength:3,side:'left'}});
apply({op:'addEdge',from:'a',to:'b',style:{step:5,color:'red'}});
const sync=()=>{c.state=JSON.parse(JSON.stringify({nodes:t.nodes(fig),edges:t.edges(fig),groups:t.groups(fig),cats:t.categories(fig),palette:t.PALETTE,source:t.serialize(fig)}));run('nodes=state.nodes;edges=state.edges;groups=state.groups;cats=state.cats;palette=state.palette;src.value=state.source;selN.clear();selE.clear();selG=null;');};
sync();
assert.equal(run('nextStep()'),1);run('edges[0].style.step=1;edges[1].style.step=3');assert.equal(run('nextStep()'),2);sync();
const event=(x,y,dataset={})=>({x,y,button:0,pointerId:1,target:{dataset,classList:{contains:()=>false}}});
const frame=run("frameRect('g')"),x=frame.x+frame.w/2;
handlers.pointerdown(event(50,0,{endpoint:'0:to'}));handlers.pointermove(event(x,0));assert.equal(run('drag.target.id'),'g');assert.equal(run('drag.target.anchor'),'east');handlers.pointerup(event(x,0));
const reconnect=messages.pop();assert.equal(reconnect.to,'g');assert.equal(reconnect.toAnchor,'east');apply(reconnect);sync();
const G=run('baseEdgeGeom(edges[0])');assert.equal(G.pts.at(-1)[0],x);
// Numeric controls, integer badges, clearing and 0.05 pt increments.
run(`const n=numberControl(.45,v=>post({width:v}));n.value='.65';n.events.change();const step=numberControl('',v=>post({step:v}),{step:1,min:1});step.value='1.5';step.events.change();step.value='4';step.events.change();step.value='';step.events.change();`);
assert.equal(messages.at(-3).width,.65);assert.equal(messages.at(-2).step,4);assert.equal(messages.at(-1).step,null);
run('selE.add(0);copyStyle();selE=new Set([1]);pasteStyle()');
const styleBatch=messages.pop();assert(!Object.hasOwn(styleBatch.ops.find(o=>o.op==='style').style,'step'));apply(styleBatch);assert.equal(t.edges(fig)[1].style.step,5);assert.equal(t.edges(fig)[1].style.tipLength,3);
// Cross-type style transfers a colour; group style does not alter its members.
sync();run("selE.add(0);copyStyle();selE.clear();selN.add('a');pasteStyle()");assert.equal(messages.at(-1).ops.at(-1).style.color,'blue');
run("selN.clear();selG='g';copyStyle();selG=null;selE.add(1);pasteStyle()");assert.equal(messages.at(-1).ops[0].style.color,'blue');
run("selE.clear();selG='g';selN.add('a');pasteStyle()");assert.equal(messages.at(-1).op,'groupProps');
run('selG=null;selN.clear();selE=new Set([0]);sourceColour([0])');assert.equal(messages.at(-1).ops[0].style.color,t.darkerColor('peach'));
// Copying a frame endpoint includes the fit-node's membership and hierarchy.
run('selE=new Set([0])');const clip=run('clip()');assert(clip.includes('% sakuga group g '));
const paste=t.pasteOps(t.parse(t.TEMPLATE),clip,5,-5),p=t.parse(t.TEMPLATE);t.apply(p,{op:'batch',ops:paste.ops});assert.equal(t.groups(p).length,1);assert.equal(t.edges(p).length,1);assert.equal(t.serialize(t.parse(t.serialize(p))),t.serialize(p));
console.log('Frame endpoint drops, numeric controls, next step, badge preservation, cross-type style paste, source colours and frame clipboard passed.');
