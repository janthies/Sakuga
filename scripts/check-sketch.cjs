// Run after npm run compile. Use the shipped geometry/ops and real editor key/edit handlers.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const t=require('../out/tikz'),sketch=require('../media/sketch');
const source=fs.readFileSync(path.join(__dirname,'../media/editor.js'),'utf8');
const layout=n=>{const [w,h]=t.boxHalf(n);return {w:w*2,h:h*2,lines:[n.title]};};
const fig=t.parse(t.TEMPLATE);
const add=(id,x,y,width=20,minh=10,extra={})=>t.apply(fig,{op:'addNode',id,title:id,cat:'',x,y,width,minh,...extra});
const near=(a,b)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);
add('a',0,0,10);add('b',30,12,20);add('c',90,-10,30);
const ns=()=>t.nodes(fig),ids=['a','b','c'];
const apply=batch=>{assert.equal(batch.op,'batch');t.apply(fig,batch);};
apply(sketch.arrange(ns(),[],ids,null,'left',layout));
const left=ns()[0].x-layout(ns()[0]).w/2;
ns().forEach(n=>near(n.x-layout(n).w/2,left));
// Restore an unequal-gap row with unequal sizes, then distribute its edge gaps.
ns().forEach((n,i)=>{n.x=[0,30,90][i];n.y=0;});
apply(sketch.arrange(ns(),[],ids,null,'distributeX',layout));
const gap=(a,b)=>b.x-a.x-(layout(a).w+layout(b).w)/2;
near(gap(ns()[0],ns()[1]),gap(ns()[1],ns()[2]));
apply(sketch.sameSize(ns(),ids,null,'w',layout));
ns().forEach(n=>near(layout(n).w,layout(ns()[2]).w));
for(const cmd of ['left','centerX','right','top','centerY','bottom']){
 const key=ns()[1],before={x:key.x,y:key.y};
 apply(sketch.arrange(ns(),[],ids,key.id,cmd,layout));
 near(key.x,before.x);near(key.y,before.y);
 const axis=['left','centerX','right'].includes(cmd)?'x':'y';
 const pos={left:0,centerX:.5,right:1,bottom:0,centerY:.5,top:1}[cmd];
 const at=n=>{const b=sketch.bounds([n],layout);return b[axis+'0']+(b[axis+'1']-b[axis+'0'])*pos;};
 ns().forEach(n=>near(at(n),at(key)));
}
// Key width, height, vertical distribution, mixed kinds and rigid nested groups.
ns()[0].width=12;ns()[1].width=15;ns()[2].width=20;
apply(sketch.sameSize(ns(),ids,'b','w',layout));ns().forEach(n=>near(n.width,15));
ns()[1].minh=22;apply(sketch.sameSize(ns(),ids,'b','h',layout));ns().forEach(n=>near(layout(n).h,22));
ns().forEach((n,i)=>n.y=[0,40,120][i]);apply(sketch.arrange(ns(),[],ids,null,'distributeY',layout));
near(ns()[1].y-ns()[0].y,ns()[2].y-ns()[1].y);
const mixed=JSON.parse(JSON.stringify(ns()));mixed[0].kind='label';mixed[1].kind='icon';mixed[1].minh=8;
mixed[0].group='inner';mixed[1].group='outer';mixed[2].group='';
const gs=[{id:'inner',parent:'outer'},{id:'outer',parent:''}],before=mixed[1].x-mixed[0].x;
const batch=sketch.arrange(mixed,gs,ids,null,'right',layout);
for(const op of batch.ops){Object.assign(mixed.find(n=>n.id===op.id),{x:op.x,y:op.y});}
near(mixed[1].x-mixed[0].x,before);
mixed[1].locked=true;
assert(!sketch.arrange(mixed,gs,ids,null,'left',layout).ops.some(o=>o.id==='a'||o.id==='b'));
// Tab placement, median spacing, occupied spots, direction from the last incoming edge.
const seed={...ns()[0],id:'seed',title:'seed',x:0,y:0,width:26,minh:12,style:{fill:'peach',border:'dashed'},extra:[]};
let draft=sketch.nextBox([seed],[],seed,'new',false,layout);
near(draft.node.x,(layout(seed).w+layout(draft.node).w)/2+8);near(draft.node.y,0);
assert.equal(draft.batch.ops.length,1);assert.equal(draft.batch.ops[0].from,'seed');
assert.deepEqual(draft.node.style,seed.style);assert.equal(draft.node.width,seed.width);
const below=sketch.nextBox([seed],[],seed,'down',true,layout);near(below.node.y,-20);near(below.node.x,0);
const occupied={...draft.node,id:'occupied'};
const occupiedNext=sketch.nextBox([seed,occupied],[],seed,'next',false,layout);
assert(occupiedNext.node.x>occupied.x+layout(occupied).w);
const occupiedBelow={...below.node,id:'occupiedBelow'};
assert(sketch.nextBox([seed,occupiedBelow],[],seed,'down',true,layout).node.y<occupiedBelow.y-layout(occupiedBelow).h);
const predecessor={...seed,id:'predecessor',x:0,y:30};
draft=sketch.nextBox([seed,predecessor],[{from:'predecessor',to:'seed'}],seed,'new',false,layout);
assert(draft.node.y<0);near(draft.node.x,0);
const leftward={...seed,id:'leftward',x:100};
assert(sketch.nextBox([seed,leftward],[{from:'predecessor',to:'seed'},{from:'leftward',to:'seed'}],seed,'new',false,layout).node.x<0);
const spaced=[0,40,90].map((x,i)=>({...seed,id:`s${i}`,x}));
near(sketch.typicalGap(spaced,layout),45-layout(seed).w);
// Saved result uses the actual batch op and survives the TikZ round trip.
t.apply(fig,draft.batch);const saved=t.parse(t.serialize(fig));assert(t.nodes(saved).some(n=>n.id==='new'));assert(t.edges(saved).some(e=>e.to==='new'));

const events={},messages=[],input={style:{},value:'',focus(){},select(){},setSelectionRange(){},addEventListener:(name,fn)=>events['input:'+name]=fn};
const ctx=vm.createContext({SakugaSketch:sketch,Set,Map,Math,layout,input,
 document:{addEventListener:(name,fn)=>events[name]=fn,createElement:()=>({children:[],appendChild(n){this.children.push(n);},setAttribute(){},blur(){}})},
 inspector:{children:[],appendChild(n){this.children.push(n);}},
 svg:{addEventListener:(name,fn)=>events[name]=fn,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0}),classList:{add(){},remove(){}}},
 post:op=>messages.push(op),render(){assert(run('[...selN].every(byId)'),'Selection refers to existing nodes');},toMm:ev=>({x:ev.x||0,y:ev.y||0}),show:s=>s,tex:s=>s,px:x=>x,py:y=>y,
 isTyping:()=>false,groupById:()=>null,members:()=>[],isBox:n=>n&&!n.kind,
 selectedLayers:new Set(),etools:{style:{}},TITLE_PT:10,PT:25.4/72.27,
 state:[seed],view:{s:4},newId:()=> 'fresh'
});
const run=code=>vm.runInContext(code,ctx),load=(start,end)=>run(source.slice(source.indexOf(start),source.indexOf(end)));
run("let nodes=state.map(n=>({...n})), edges=[],groups=[],selN=new Set(['seed']),selE=new Set(),keyObject=null,freshBox=null,editing=null,floating=null,space=false,selG=null,pendingSelect=null,activeLayer='layer1',cats=[],styles=[],shared=[],lastCat='',drag=null;const byId=id=>nodes.find(n=>n.id===id);");
load(' const SKETCH_CONTROLS','\n\tconst SHORTCUTS');
load(' function sketchCommand','\n\tfunction edgeInside');
load("\tdocument.addEventListener('keydown', ev => {\n\t\tif (floating", "\tdocument.addEventListener('keyup'");
const press=(key,extra={})=>{let prevented=false;events.keydown({key,code:'Key'+key.toUpperCase(),preventDefault(){prevented=true;},...extra});return prevented;};
const finish=key=>events['input:keydown']({key,preventDefault(){},stopPropagation(){}});
assert(press('Tab'));assert.equal(run('editing'),'fresh');assert.equal(messages.length,0);
finish('Escape');assert.equal(messages.length,0);assert.equal(run('nodes.length'),1);assert.equal(run("selN.has('seed')"),true);
press('Tab',{shiftKey:true});assert(run("byId('fresh').y")<0);input.value='New title';finish('Enter');
assert.equal(messages.length,1);assert.equal(messages[0].op,'batch');assert.equal(messages.pop().ops[0].title,'New title');
run("selN=new Set(['seed']);");
assert(press('z'));assert.equal(input.value,'z');finish('Enter');assert.equal(messages.pop().ops[0].title,'z');
assert(!press('d'));assert(!press('r'));assert.equal(run('editing'),null);
assert(!press('z',{ctrlKey:true}));assert(!press('z',{altKey:true}));assert(!press('z',{metaKey:true}));
assert(!press('z',{isComposing:true}));
assert(press('😀'));assert.equal(input.value,'😀');finish('Escape');
assert(press('F2'));assert.equal(input.value,'seed');finish('Escape');
assert(press('Enter'));assert.equal(input.value,'seed');finish('Escape');
run("nodes[0].kind='label';");assert(press('!'));assert.equal(input.value,'!');finish('Escape');assert(!press('Tab'));
run("nodes[0].locked=true;");assert(!press('z'));
// The actual controls emit one batch, and Shift still starts a constrained drag.
run("nodes[0].locked=false;nodes.push({...nodes[0],id:'second',x:50});selN=new Set(['seed','second']);selE.add(0);");
run('sketchControls()');assert.equal(ctx.inspector.children[0].children.length,10);
ctx.inspector.children[0].children[0].onclick();assert.equal(messages.pop().op,'batch');
load("\tsvg.addEventListener('pointerdown'", "\tsvg.addEventListener('pointermove'");
events.pointerdown({button:0,shiftKey:true,target:{dataset:{node:'second'},classList:{contains:()=>false}},pointerId:1});
assert.equal(run('keyObject'),'second');assert.equal(run('drag.move'),true);
events.pointerdown({button:0,ctrlKey:true,target:{dataset:{node:'second'},classList:{contains:()=>false}},pointerId:1});
assert.equal(run('keyObject'),null);assert.equal(run("selN.has('second')"),false);
// Every visible shortcut has an explicit scoped extension binding, avoiding workbench grabs.
const pkg=require('../package.json');for(const [cmd,,key] of run('SKETCH_CONTROLS')){
 const binding=pkg.contributes.keybindings.find(b=>b.command==='sakuga.sketch.'+cmd);
 assert.equal(binding.key,key.toLowerCase());assert(binding.when.includes('activeCustomEditorId == sakuga.figure && webviewFocus'));
 assert(!/^alt\+(?:[hjklq]|shift\+[hjkl])$/.test(binding.key));
}
console.log('Sketch: alignment, equal edge gaps, key objects, sizes, rigid groups, locks, Tab placement/direction/obstacles, one-batch creation, cancellation, type-to-edit and scoped shortcuts passed.');
