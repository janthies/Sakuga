// Bounding-box translation and equal-gap accumulation adapted from Excalidraw's
// packages/element/src/{align,distribute}.ts (MIT). See sketch.LICENSE.txt.
// Sakuga uses centre coordinates in mm, y upwards, and emits existing operations.
(function (root) {
 'use strict';
 const bounds = (ns, layout) => {
  const bs = ns.map(n => {const {w,h}=layout(n);return {x0:n.x-w/2,x1:n.x+w/2,y0:n.y-h/2,y1:n.y+h/2};});
  return {x0:Math.min(...bs.map(b=>b.x0)),x1:Math.max(...bs.map(b=>b.x1)),y0:Math.min(...bs.map(b=>b.y0)),y1:Math.max(...bs.map(b=>b.y1))};
 };
 function units(nodes, groups, ids, layout) {
  const selected=new Set(ids), used=new Set(), result=[];
  const inside=(n,id)=>{let p=n.group;const seen=new Set();while(p&&!seen.has(p)){if(p===id)return true;seen.add(p);p=groups.find(g=>g.id===p)?.parent;}return false;};
  // Collapse wholly selected groups, outermost first, so members remain rigid.
  const depth=g=>{let d=0,p=g.parent;const seen=new Set();while(p&&!seen.has(p)){seen.add(p);d++;p=groups.find(g=>g.id===p)?.parent;}return d;};
  const add=ns=>{ns.forEach(n=>used.add(n.id));if(ns.every(n=>!n.hidden&&!n.locked))result.push({ns,b:bounds(ns,layout)});};
  for(const g of [...groups].sort((a,b)=>depth(a)-depth(b))){const ns=nodes.filter(n=>inside(n,g.id));if(ns.length&&ns.every(n=>selected.has(n.id)&&!used.has(n.id)))add(ns);}
  for(const n of nodes)if(selected.has(n.id)&&!used.has(n.id))add([n]);
  return result;
 }
 function arrange(nodes,groups,ids,key,command,layout) {
  const us=units(nodes,groups,ids,layout), ops=[];
  if(us.length<2)return {op:'batch',ops};
  const move=(u,axis,delta)=>{if(Math.abs(delta)<1e-8)return;for(const n of u.ns)ops.push({op:'move',id:n.id,x:n.x+(axis==='x'?delta:0),y:n.y+(axis==='y'?delta:0)});};
  const ref=us.find(u=>u.ns.some(n=>n.id===key));
  const b=ref ? ref.b : bounds(us.flatMap(u=>u.ns),layout);
  if(command.startsWith('distribute')){
   const axis=command.endsWith('X')?'x':'y',lo=axis+'0',hi=axis+'1';
   us.sort((a,b)=>(a.b[lo]+a.b[hi])-(b.b[lo]+b.b[hi]));
   const extent=us.reduce((s,u)=>s+u.b[hi]-u.b[lo],0);
   const all=bounds(us.flatMap(u=>u.ns),layout), gap=(all[hi]-all[lo]-extent)/(us.length-1);
   let pos=all[lo];
   // Keep equal edge gaps even when negative (overlap), rather than switching to centres.
   for(const u of us){move(u,axis,pos-u.b[lo]);pos+=u.b[hi]-u.b[lo]+gap;}
  } else {
   const [axis,position]={left:['x',0],centerX:['x',.5],right:['x',1],bottom:['y',0],centerY:['y',.5],top:['y',1]}[command];
   const at=box=>box[axis+'0']+(box[axis+'1']-box[axis+'0'])*position;
   for(const u of us)move(u,axis,at(b)-at(u.b));
  }
  return {op:'batch',ops};
 }
 function sameSize(nodes,ids,key,axis,layout) {
  const ns=nodes.filter(n=>ids.includes(n.id)&&!n.hidden&&!n.locked), prop=axis==='w'?'width':'minh';
  const target=ns.find(n=>n.id===key), size=target?layout(target)[axis]:Math.max(...ns.map(n=>layout(n)[axis]));
  const ops=[];
  for(const n of ns){
   if(n===target)continue;
   // Invert the existing rendered geometry, including padding and shape expansion.
   let lo=0,hi=Math.max(size*2,n[prop]||0,1);
   if(layout({...n,[prop]:lo})[axis]>size+1e-6)continue; // intrinsic text/shape minimum
   for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(layout({...n,[prop]:mid})[axis]<size)lo=mid;else hi=mid;}
   ops.push({op:'node',id:n.id,[prop]:(lo+hi)/2});
  }
  return {op:'batch',ops};
 }
 function typicalGap(nodes,layout) {
  const boxes=nodes.filter(n=>!n.kind&&!n.hidden), gaps=[];
  for(const a of boxes)for(const axis of ['x','y']){
   const other=axis==='x'?'y':'x',size=axis==='x'?'w':'h',cross=axis==='x'?'h':'w',la=layout(a);
   const candidates=boxes.filter(b=>b!==a&&b[axis]>a[axis]&&Math.abs(b[other]-a[other])<(la[cross]+layout(b)[cross])/2)
    .map(b=>b[axis]-a[axis]-(la[size]+layout(b)[size])/2).filter(g=>g>=0);
   if(candidates.length)gaps.push(Math.min(...candidates));
  }
  gaps.sort((a,b)=>a-b);const m=Math.floor(gaps.length/2);
  return gaps.length?(gaps.length%2?gaps[m]:(gaps[m-1]+gaps[m])/2):8;
 }
 function nextBox(nodes,edges,source,id,below,layout) {
  const incoming=[...edges].reverse().find(e=>e.to===source.id), prev=incoming&&nodes.find(n=>n.id===incoming.from);
  let dx=1,dy=0;
  if(below){dx=0;dy=-1;}else if(prev){const x=source.x-prev.x,y=source.y-prev.y;if(Math.abs(y)>Math.abs(x)){dx=0;dy=Math.sign(y)||-1;}else{dx=Math.sign(x)||1;}}
  const gap=typicalGap(nodes,layout), n={...source,id,title:'',code:'',group:'',attachment:undefined,extra:[...source.extra],style:{...source.style}}, a=layout(source), b=layout(n);
  n.x=source.x+dx*((a.w+b.w)/2+gap);n.y=source.y+dy*((a.h+b.h)/2+gap);
  // Advance past every overlapping object; each pass strictly advances along the ray.
  for(let i=0;i<=nodes.length;i++){
   const hit=nodes.find(o=>!o.hidden&&Math.abs(n.x-o.x)<(b.w+layout(o).w)/2-1e-7&&Math.abs(n.y-o.y)<(b.h+layout(o).h)/2-1e-7);
   if(!hit)break;const h=layout(hit);
   if(dx)n.x=hit.x+dx*((h.w+b.w)/2+gap);else n.y=hit.y+dy*((h.h+b.h)/2+gap);
  }
  const {titlePosition,style,extra,layer,x,y,cat,icon,iconPosition,width,minh}=n;
  return {node:n,edge:{from:source.id,to:id,kind:'arr',route:'auto',mid:null,bend:0,head:'end',label:'',extra:[]},
   batch:{op:'batch',ops:[{op:'addNode',id,title:'',titlePosition,style,extra,layer,x,y,cat,icon,iconPosition,width,minh,from:source.id}]}};
 }
 const api={bounds,units,arrange,sameSize,typicalGap,nextBox};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SakugaSketch=api;
})(typeof globalThis==='object'?globalThis:this);
