// Shared geometry for anchored endpoints, frame endpoints and parallel lanes (millimetres).
(function (root) {
 const padding = g => g.padding || (g.frame === 'dashed' ? 2.8 : g.frame === 'dotted' ? 1.8 : 3);
 function bounds(id, nodes, groups, seen = new Set(), edges = []) {
  if (seen.has(id)) return null;
  seen = new Set(seen); seen.add(id);
  const g = groups.find(g => g.id === id); if (!g) return null;
  const items = [...nodes.filter(n => n.group === id && !n.hidden), ...groups.filter(c => c.parent === id).map(c => bounds(c.id,nodes,groups,seen,edges)).filter(Boolean).map(b=>{const child=groups.find(g=>g.id===b.id), pos=child.titlePosition || 'legacy';if(child.name && (pos.startsWith('above') || pos==='below-left')) { const extra=(({scriptsize:8,footnotesize:9,small:10,normalsize:10.95,large:12}[child.titleFont || 'scriptsize'])+3)*25.4/72.27; return {...b,h:b.h+extra,y:b.y+(pos==='below-left' ? -extra/2 : extra/2)}; } return b;})];
  for(const e of edges.filter(e=>e.route==='u')) {const a=nodes.find(n=>n.id===e.from && n.group===id && !n.hidden), b=nodes.find(n=>n.id===e.to && n.group===id && !n.hidden);if(a&&b) { const route=geometry(e,a,b,edges,'manhattan');items.push(...route.pts.map(p=>({x:p[0],y:p[1],w:0,h:0}))); }}
  if (!items.length) return null;
  const m = g.frame === 'none' ? 0 : padding(g);
  const x0 = Math.min(...items.map(n => n.x-n.w/2))-m, x1 = Math.max(...items.map(n => n.x+n.w/2))+m;
  const y0 = Math.min(...items.map(n => n.y-n.h/2))-m, y1 = Math.max(...items.map(n => n.y+n.h/2))+m+(g.titlePosition?.startsWith('inside') ? 5 : 0);
  return {id,x:(x0+x1)/2,y:(y0+y1)/2,w:x1-x0,h:y1-y0,group:g.parent,frame:true};
 }
 function lane(e, edges) {
  if (Number.isFinite(e.lane)) return e.lane;
  const pair = edges.filter(o => (o.from === e.from && o.to === e.to) || (o.from === e.to && o.to === e.from));
  return pair.length > 1 ? ((pair.length-1)/2-pair.indexOf(e))*7 : 0;
 }
 function point(n, side, toward, offset) {
  if (side && side !== 'center') return [n.x+(side.includes('east') ? n.w/2 : side.includes('west') ? -n.w/2 : 0),n.y+(side.includes('north') ? n.h/2 : side.includes('south') ? -n.h/2 : 0)].map((v,k)=>n.frame && ((k===1 && /east|west/.test(side)) || (k===0 && /north|south/.test(side))) ? Math.max((k===0 ? n.x-n.w/2 : n.y-n.h/2)+0.5,Math.min((k===0 ? n.x+n.w/2 : n.y+n.h/2)-0.5,k===0 ? toward.x : toward.y)) : v);
  const dx=toward.x-n.x,dy=toward.y-n.y;
  const t=Math.min(dx ? n.w/2/Math.abs(dx) : Infinity,dy ? n.h/2/Math.abs(dy) : Infinity);
  return Number.isFinite(t) ? [n.x+dx*t,n.y+dy*t] : [n.x,n.y];
 }
 function geometry(e,a,b,edges,style,objects=[a,b],prior=[]) {
  if (!a || !b) return null;
  if(e.from===e.to)return loopGeometry(e,a);
  if(e.route==='fixed')return fixedGeometry(e,a,b,objects);
  if(e.route==='auto' || e.route==='manhattan'){const g=autoRoute(e,a,b,objects,prior),l=lane(e,edges);if(l && g.sa && g.sb && !e.fromAnchor && !e.toAnchor){const off=(n,s,p)=>{const h=/north|south/.test(s),limit=(h?n.w:n.h)/2-.5;return Math.max(-limit,Math.min(limit,p[h?0:1]-n[h?'x':'y']+l));};return autoRoute({...e,fromAnchor:g.sa,toAnchor:g.sb,fromOffset:off(a,g.sa,g.pts[0]),toOffset:off(b,g.sb,g.pts.at(-1))},a,b,objects,prior);}return g;}
  if (!a || !b) return null;
  const l=lane(e,edges);
  const sideA=e.fromAnchor || (e.route==='u' ? 'south' : undefined),sideB=e.toAnchor || (e.route==='u' ? 'south' : undefined);
  const p=point(a,sideA,b),q=point(b,sideB,a);
  if(e.fromOffset!==undefined)p[/north|south/.test(sideA)?0:1]+=e.fromOffset;
  if(e.toOffset!==undefined)q[/north|south/.test(sideB)?0:1]+=e.toOffset;
  const forward=q[0]<p[0] || (q[0]===p[0] && q[1]<p[1]) ? -1 : 1;
  const dx=(q[0]-p[0])*forward,dy=(q[1]-p[1])*forward,len=Math.hypot(dx,dy)||1;
  const shift=[-dy/len*l,dx/len*l];
  for (const [v,n,side,offset] of [[p,a,sideA,e.fromOffset],[q,b,sideB,e.toOffset]]) {
   if(offset!==undefined)continue;
   // A lane slides along a chosen side, never off the rectangle.
   if (side?.includes('east') || side?.includes('west')) v[1]+=Math.max(-n.h/2+0.5,Math.min(n.h/2-0.5,shift[1]));
   else if (side?.includes('north') || side?.includes('south')) v[0]+=Math.max(-n.w/2+0.5,Math.min(n.w/2-0.5,shift[0]));
   else { const vertical=Math.abs(v[0]-n.x)<n.w/2-0.01; if(vertical) v[0]+=shift[0]; else v[1]+=shift[1]; }
  }
  const route=e.route==='auto' ? style : e.route;
  let pts=[p,q],curve;
  if (route==='u' || (sideA && sideA===sideB && route==='manhattan')) {
   const s=sideA || 'south',h=s==='north'||s==='south',sign=s==='north'||s==='east' ? 1 : -1;
   const mid=e.mid ?? (h ? (sign>0 ? Math.max(p[1],q[1])+7 : Math.min(p[1],q[1])-7) : (sign>0 ? Math.max(p[0],q[0])+7 : Math.min(p[0],q[0])-7));
   pts=h ? [p,[p[0],mid],[q[0],mid],q] : [p,[mid,p[1]],[mid,q[1]],q];
  } else if (route==='hvh' || route==='vhv' || route==='manhattan') {
   const h=route==='hvh'||(route==='manhattan'&&Math.abs(dx)>=Math.abs(dy)), mid=e.mid ?? (h ? (p[0]+q[0])/2 : (p[1]+q[1])/2);
   pts=h ? [p,[mid,p[1]],[mid,q[1]],q] : [p,[p[0],mid],[q[0],mid],q];
  } else if (route==='bend'||route==='curved') {
   const angle=(route==='curved' ? 20 : e.bend||0)*Math.PI/180,th=Math.atan2(q[1]-p[1],q[0]-p[0]),L=Math.hypot(q[0]-p[0],q[1]-p[1])*0.3915;
   curve=[p,[p[0]+Math.cos(th+angle)*L,p[1]+Math.sin(th+angle)*L],[q[0]-Math.cos(th-angle)*L,q[1]-Math.sin(th-angle)*L],q];
  }
  if(pts.length>2 && (pts.every(p=>p[0]===pts[0][0]) || pts.every(p=>p[1]===pts[0][1]))) pts=[pts[0],pts[pts.length-1]];
  const label=curve ? [0,1].map(k=>curve[0][k]/8+3*curve[1][k]/8+3*curve[2][k]/8+curve[3][k]/8) : pts.length===4 ? [(pts[1][0]+pts[2][0])/2,(pts[1][1]+pts[2][1])/2] : [(p[0]+q[0])/2,(p[1]+q[1])/2];
  return {pts,curve,label,r:{type:curve ? 'bend' : pts.length===4 ? (pts[0][1]===pts[1][1] ? 'hvh' : 'vhv') : 'line',mid:e.mid},special:true};
 }
 // Preserve the existing unanchored path when only its label is edited.
 function legacyGeometry(e,a,b,style) {
  if(!a || !b)return null;
  const border=(n,t) => {
   const dx=t[0]-n.x,dy=t[1]-n.y,shape=n.style?.shape;
   if(!dx && !dy)return [n.x,n.y];
   const k=shape==='ellipse' || shape==='circle' ? 1/Math.hypot(dx/(n.w/2),dy/(n.h/2)) : shape==='diamond' ? 1/(Math.abs(dx)/(n.w/2)+Math.abs(dy)/(n.h/2)) : Math.min(dx ? n.w/2/Math.abs(dx) : Infinity,dy ? n.h/2/Math.abs(dy) : Infinity);
   return [n.x+dx*k,n.y+dy*k];
  };
  let type=e.route==='auto' ? style : e.route,mid=e.mid,at,bend=e.bend;
  const dx=b.x-a.x,dy=b.y-a.y,aw=a.w/2,ah=a.h/2,bw=b.w/2,bh=b.h/2;
  if(type==='curved'){type='bend';bend=20;}
  if(type==='manhattan'){
   const xo=Math.abs(dx)<aw+bw-1,yo=Math.abs(dy)<ah+bh-1;
   if(xo && !yo){if(Math.abs(dx)<.05)type='straight';else if(Math.abs(dx)<=aw-1){type='vert';at='b';}else if(Math.abs(dx)<=bw-1){type='vert';at='a';}else type='vhv';}
   else if(yo && !xo){if(Math.abs(dy)<.05)type='straight';else if(Math.abs(dy)<=ah-1){type='horz';at='b';}else if(Math.abs(dy)<=bh-1){type='horz';at='a';}else type='hvh';}
   else type=Math.abs(dy)>=Math.abs(dx) ? 'vhv' : 'hvh';
   if(type==='hvh'||type==='vhv')mid=Math.round((type==='hvh' ? a.x+b.x : a.y+b.y)*5)/10;
  }
  let pts,curve;
  if(type==='vert'){const x=at==='b' ? b.x : a.x,sgn=dy<0 ? -1 : 1;pts=[[x,a.y+sgn*ah],[x,b.y-sgn*bh]];}
  else if(type==='horz'){const y=at==='b' ? b.y : a.y,sgn=dx<0 ? -1 : 1;pts=[[a.x+sgn*aw,y],[b.x-sgn*bw,y]];}
  else if(type==='hvh'||type==='vhv'){
   const h=type==='hvh';
   if(mid===null || mid===undefined){const c=h ? [b.x,a.y] : [a.x,b.y];pts=[border(a,c),c,border(b,c)];}
   else {const c=h ? [mid,a.y] : [a.x,mid],d=h ? [mid,b.y] : [b.x,mid];pts=[border(a,c),c,d,border(b,d)];}
  }else if(type==='bend'){
   const th=Math.atan2(dy,dx),d=(bend || 0)*Math.PI/180,out=th+d,inn=th+Math.PI-d,p=border(a,[a.x+Math.cos(out)*1000,a.y+Math.sin(out)*1000]),q=border(b,[b.x+Math.cos(inn)*1000,b.y+Math.sin(inn)*1000]),L=Math.hypot(q[0]-p[0],q[1]-p[1])*.3915;
   curve=[p,[p[0]+Math.cos(out)*L,p[1]+Math.sin(out)*L],[q[0]+Math.cos(inn)*L,q[1]+Math.sin(inn)*L],q];pts=[p,q];
  }else pts=[border(a,[b.x,b.y]),border(b,[a.x,a.y])];
  const label=curve ? [0,1].map(k=>curve[0][k]/8+3*curve[1][k]/8+3*curve[2][k]/8+curve[3][k]/8) : pts.length===4 ? pts[1].map((v,k)=>(v+pts[2][k])/2) : pts[0].map((v,k)=>(v+pts[1][k])/2);
  return {pts,curve,label,r:{type:type==='straight' ? 'line' : type,mid,at,bend},special:true};
 }
 // Orthogonal routing in mm. One search contains every permitted port at both ends.
 const normals={east:[1,0],west:[-1,0],north:[0,1],south:[0,-1]};
 const sides=Object.keys(normals), eps=1e-7;
 const tidy=pts=>{const out=[];for(const p of pts){if(out.length && Math.hypot(p[0]-out.at(-1)[0],p[1]-out.at(-1)[1])<eps)continue;while(out.length>1){const a=out.at(-2),b=out.at(-1);if(Math.abs((b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0]))>eps || (b[0]-a[0])*(p[0]-b[0])+(b[1]-a[1])*(p[1]-b[1])<0)break;out.pop();}out.push(p.slice());}return out;};
 function hits(r,p,q,m=0){const x0=r.x-r.w/2-m,x1=r.x+r.w/2+m,y0=r.y-r.h/2-m,y1=r.y+r.h/2+m;return Math.abs(p[0]-q[0])<eps ? p[0]>x0+eps && p[0]<x1-eps && Math.max(p[1],q[1])>y0+eps && Math.min(p[1],q[1])<y1-eps : p[1]>y0+eps && p[1]<y1-eps && Math.max(p[0],q[0])>x0+eps && Math.min(p[0],q[0])<x1-eps;}
 const inside=(r,p,m=0)=>Math.abs(p[0]-r.x)<=r.w/2-m+eps && Math.abs(p[1]-r.y)<=r.h/2-m+eps;
 function port(n,s,offset=0){const p=point(n,s,n);p[/north|south/.test(s)?0:1]+=offset;return p;}
 function snapPort(n,s,p,disable=false){const h=/north|south/.test(s),length=h?n.w:n.h,center=h?n.x:n.y,raw=Math.max(-length/2,Math.min(length/2,(h?p.x:p.y)-center));let offset=raw,fraction;for(const f of [0,1/4,1/3,1/2,2/3,3/4,1])if(!disable && Math.abs(raw-(f-.5)*length)<1.5 && (fraction===undefined || Math.abs(raw-(f-.5)*length)<Math.abs(raw-offset))){offset=(f-.5)*length;fraction=f;}return {offset:+offset.toFixed(4),fraction};}
 function result(pts,more={}){pts=tidy(pts);let total=0;for(let i=1;i<pts.length;i++)total+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);let left=total/2,label=pts[0];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(left<=l){label=a.map((v,k)=>v+(b[k]-v)*(l?left/l:0));break;}left-=l;}return {pts,label,r:{type:pts.length===4?(pts[0][0]===pts[1][0]?'vhv':'hvh'):'line'},special:true,...more};}
 function autoRoute(e,a,b,objects=[],prior=[]){
  const others=objects.filter(n=>!n.hidden && !n.frame && n.kind!=='label' && n.id!==a.id && n.id!==b.id);
  const frames=objects.filter(n=>n.frame && n.id!==a.id && n.id!==b.id);
  const common=frames.filter(f=>inside(f,[a.x,a.y]) && inside(f,[b.x,b.y]));
  const obstacles=[...others.map(n=>({...n,margin:2})),{...a,margin:0},{...b,margin:0}];
  const free=(p,q)=>!obstacles.some(n=>hits(n,p,q,n.margin)) && common.every(f=>inside(f,p,1.2)&&inside(f,q,1.2));
  const valid=pts=>pts.slice(1).every((q,i)=>free(pts[i],q));
  const facing=(s,n,o)=>{const d=normals[s];return d[0]*(o.x-n.x)+d[1]*(o.y-n.y)>eps;};
  const allowed=(n,o,anchor,offset)=>sides.filter(s=>!anchor || s===anchor).flatMap(s=>{const h=/north|south/.test(s),len=h?n.w:n.h,c=h?n.x:n.y,other=h?o.x:o.y,limit=Math.max(0,len/2-2.5);const vals=offset!==undefined?[offset]:[0,-len/4,len/4,Math.max(-limit,Math.min(limit,other-c)),...others.flatMap(r=>(h?[r.x-r.w/2-2,r.x+r.w/2+2]:[r.y-r.h/2-2,r.y+r.h/2+2]).filter(v=>Math.abs(v-c)<=limit).map(v=>v-c))];return [...new Set(vals)].map(off=>({p:port(n,s,off),s,pen:facing(s,n,o)?0:14}));});
  const starts=allowed(a,b,e.fromAnchor,e.fromOffset),ends=allowed(b,a,e.toAnchor,e.toOffset);
  const finish=(pts,sa,sb,rule)=>result(pts,{sa,sb,rule});
  // 1: straight through the overlap of facing side intervals.
  for(const h of [true,false]){const axis=h?0:1,delta=(h?b.x-a.x:b.y-a.y);if(!delta)continue;const sa=h?(delta>0?'east':'west'):(delta>0?'north':'south'),sb=h?(delta>0?'west':'east'):(delta>0?'south':'north');if(e.fromAnchor && e.fromAnchor!==sa || e.toAnchor && e.toAnchor!==sb)continue;const lenA=h?a.h:a.w,lenB=h?b.h:b.w,ca=h?a.y:a.x,cb=h?b.y:b.x,lo=Math.max(ca-lenA/2+2.5,cb-lenB/2+2.5),hi=Math.min(ca+lenA/2-2.5,cb+lenB/2-2.5);if(hi-lo<=5)continue;let c=(ca>=lo && ca<=hi && cb>=lo && cb<=hi)?ca:(lo+hi)/2;if(e.fromOffset!==undefined)c=ca+e.fromOffset;if(e.toOffset!==undefined && Math.abs(c-(cb+e.toOffset))>eps)continue;const p=port(a,sa,c-ca),q=port(b,sb,c-cb);if((q[axis]-p[axis])*delta>0 && valid([p,q]))return finish([p,q],sa,sb,'aligned');}
  const candidates=[];
  for(const s of starts)for(const t of ends){if(!facing(s.s,a,b)||!facing(t.s,b,a))continue;const p=s.p,q=t.p,hs=normals[s.s][0]!==0,ht=normals[t.s][0]!==0;if(hs!==ht && Math.abs(b.x-a.x)>a.w/2+b.w/2 && Math.abs(b.y-a.y)>a.h/2+b.h/2){const c=hs?[q[0],p[1]]:[p[0],q[1]];if(valid([p,c,q]))candidates.push({pts:[p,c,q],s,t});}}
  const length=pts=>pts.slice(1).reduce((l,p,i)=>l+Math.abs(p[0]-pts[i][0])+Math.abs(p[1]-pts[i][1]),0);
  if(candidates.length){candidates.sort((x,y)=>length(x.pts)-length(y.pts));const c=candidates[0];return finish(c.pts,c.s.s,c.t.s,'L');}
  for(const s of starts)for(const t of ends){if(!facing(s.s,a,b)||!facing(t.s,b,a))continue;const p=s.p,q=t.p,hs=normals[s.s][0]!==0;if(hs!== (normals[t.s][0]!==0) || s.s===t.s)continue;const mid=hs?(p[0]+q[0])/2:(p[1]+q[1])/2,pts=hs?[p,[mid,p[1]],[mid,q[1]],q]:[p,[p[0],mid],[q[0],mid],q];if(valid(pts))candidates.push({pts,s,t});}
  if(candidates.length){candidates.sort((x,y)=>length(x.pts)-length(y.pts));const c=candidates[0];return finish(c.pts,c.s.s,c.t.s,'Z');}
  // 4: a single multi-source A*. Each state retains heading, bend budget and source side.
  const xs=new Set(),ys=new Set();for(const c of [...starts,...ends]){xs.add(c.p[0]);ys.add(c.p[1]);}for(const n of obstacles){xs.add(n.x-n.w/2-n.margin);xs.add(n.x+n.w/2+n.margin);ys.add(n.y-n.h/2-n.margin);ys.add(n.y+n.h/2+n.margin);}for(const f of frames){xs.add(f.x-f.w/2+1.2);xs.add(f.x+f.w/2-1.2);ys.add(f.y-f.h/2+1.2);ys.add(f.y+f.h/2-1.2);}
  xs.add(Math.min(...xs)-4);xs.add(Math.max(...xs)+4);ys.add(Math.min(...ys)-4);ys.add(Math.max(...ys)+4);
  const grid=s=>{const a=[...s].sort((a,b)=>a-b),out=[...a];for(let i=1;i<a.length;i++)out.push((a[i-1]+a[i])/2);return [...new Set(out)].sort((a,b)=>a-b);},X=grid(xs),Y=grid(ys),ny=Y.length;
  const goals=new Map();for(const t of ends){const k=X.indexOf(t.p[0])*ny+Y.indexOf(t.p[1]);if(!goals.has(k))goals.set(k,[]);goals.get(k).push(t);}
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]],dirSide=['east','west','north','south'];
  const h=p=>Math.max(0,Math.abs(p[0]-b.x)-b.w/2)+Math.max(0,Math.abs(p[1]-b.y)-b.h/2);
  const heap=[],best=new Map(),segCache=new Map();
  const push=n=>{const key=(((n.i*ny+n.j)*4+n.d)*4+n.bends)*4+n.source;if(best.has(key)&&best.get(key)<=n.g)return;best.set(key,n.g);n.key=key;n.f=n.g+h([X[n.i],Y[n.j]]);heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=heap[i].f)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
  const pop=()=>{const n=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){let m=i;for(const j of [i*2+1,i*2+2])if(j<heap.length&&heap[j].f<heap[m].f)m=j;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return n;};
  for(const s of starts)push({i:X.indexOf(s.p[0]),j:Y.indexOf(s.p[1]),d:dirSide.indexOf(s.s),bends:0,source:dirSide.indexOf(s.s),g:s.pen,s});
  let answer=null;
  while(heap.length){const n=pop();if(best.get(n.key)<n.g)continue;if(answer && n.f>=answer.cost)break;const p=[X[n.i],Y[n.j]],targets=goals.get(n.i*ny+n.j)||[];for(const t of targets)if(n.d===(dirSide.indexOf(t.s)^1)){const cost=n.g+t.pen+(t.s===n.s.s?10:0);if(!answer||cost<answer.cost)answer={n,t,cost};}
   for(let d=0;d<4;d++){if(d===(n.d^1))continue;const bends=n.bends+(d!==n.d?1:0);if(bends>3 || !n.par && d!==n.d)continue;const i=n.i+dirs[d][0],j=n.j+dirs[d][1];if(i<0||j<0||i>=X.length||j>=Y.length)continue;const q=[X[i],Y[j]],ka=n.i*ny+n.j,kb=i*ny+j,key=Math.min(ka,kb)+':'+Math.max(ka,kb);let c=segCache.get(key);if(c===undefined){c=Infinity;if(free(p,q)){const len=Math.abs(q[0]-p[0])+Math.abs(q[1]-p[1]);c=len;const mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];for(const f of frames)if(!inside(f,[a.x,a.y])&&!inside(f,[b.x,b.y])&&inside(f,mid))c+=2*len;for(const pl of prior)for(let k=1;k<pl.length;k++){const u=pl[k-1],v=pl[k],vert=d>=2,ov=Math.abs(u[0]-v[0])<eps;if(vert!==ov){const vp=vert?p:u,vq=vert?q:v,hp=vert?u:p,hq=vert?v:q;if(vp[0]>=Math.min(hp[0],hq[0])&&vp[0]<=Math.max(hp[0],hq[0])&&hp[1]>=Math.min(vp[1],vq[1])&&hp[1]<=Math.max(vp[1],vq[1]))c+=6;}else if(Math.abs(p[vert?0:1]-u[vert?0:1])<eps){const ax=vert?1:0;c+=3*Math.max(0,Math.min(Math.max(p[ax],q[ax]),Math.max(u[ax],v[ax]))-Math.max(Math.min(p[ax],q[ax]),Math.min(u[ax],v[ax])));}}}segCache.set(key,c);}if(Number.isFinite(c))push({i,j,d,bends,source:n.source,g:n.g+c+(d===n.d?0:8),s:n.s,par:n});}
  }
  if(answer){const pts=[];for(let n=answer.n;n;n=n.par)pts.push([X[n.i],Y[n.j]]);return finish(pts.reverse(),answer.n.s.s,answer.t.s,'detour');}
  return result([point(a,e.fromAnchor,b),point(b,e.toAnchor,a)],{blocked:true,rule:'blocked'});
 }
 function loopGeometry(e,n){const side=e.loopSide || 'north',angle={north:90,east:0,south:270,west:180}[side],normal=normals[side],size=e.loopSize ?? 8;let p,q,out,inn;const round=/circle|ellipse/.test(n.style?.shape);if(round){out=e.loopOut ?? angle+22;inn=e.loopIn ?? angle-22;const ray=deg=>{const r=deg*Math.PI/180;const k=1/Math.hypot(Math.cos(r)/(n.w/2),Math.sin(r)/(n.h/2));return [n.x+k*Math.cos(r),n.y+k*Math.sin(r)];};p=ray(out);q=ray(inn);}else{out=e.loopOut ?? angle;inn=e.loopIn ?? angle;const len=/north|south/.test(side)?n.w:n.h;p=port(n,e.fromAnchor || side,e.fromOffset ?? -len/6);q=port(n,e.toAnchor || side,e.toOffset ?? len/6);}
  const d=Math.min(e.loopMax ?? 10000,Math.max(size,.3915*(e.looseness ?? 1)*Math.hypot(q[0]-p[0],q[1]-p[1])*255/256)),c=(p,a)=>p.map((v,k)=>v+d*(k?Math.sin(a*Math.PI/180):Math.cos(a*Math.PI/180))),curve=[p,c(p,out),c(q,inn),q];return result([p,q],{curve,label:p.map((v,k)=>v/8+3*curve[1][k]/8+3*curve[2][k]/8+q[k]/8),loop:true,side,out,inn,d,sa:side,sb:side});
 }
 const fmt=v=>String(+v.toFixed(4));
 function portText(n,s,p){const h=/north|south/.test(s),shift=p[h?0:1]-n[h?'x':'y'];return Math.abs(shift)<eps?`(${n.id}.${s})`:`([${h?'x':'y'}shift=${fmt(shift)}mm]${n.id}.${s})`;}
 function polyline(pts,S,T,label='',projectStraight=false){if(projectStraight && pts.length===2 && (Math.abs(pts[0][0]-pts[1][0])<eps || Math.abs(pts[0][1]-pts[1][1])<eps)){const v=Math.abs(pts[0][0]-pts[1][0])<eps,target=T.replace(/^\(\[[^\]]*\]/,'(');return `${S} --${typeof label==='function'?label(0):label} (${S.slice(1,-1)} ${v?'|-':'-|'} ${target.slice(1,-1)})`;}if(label){const coords=pts.map((p,i)=>{if(!i)return S;if(i===pts.length-1)return T;const first=i===1,last=i===pts.length-2;if(first || last){const ref=first?S:T,adjacent=first?pts[0]:pts.at(-1),v=Math.abs(p[0]-adjacent[0])<eps;return `(${ref.slice(1,-1)} ${v?'|-':'-|'} ${v?'0,'+fmt(p[1]):fmt(p[0])+',0'})`;}return `(${p.map(fmt).join(',')})`;});return coords.map((c,i)=>i?` --${typeof label==='function'?label(i-1):(i-1===(pts.length===4?1:0)?label:'')} ${c}`:c).join('');}const p=pts,k=p.length-1,v=Math.abs(p[0][0]-p[1][0])<eps,coord=p=>`(${p.map(fmt).join(',')})`;if(k===1)return `${S} --${label} ${T}`;if(k===2)return `${S} ${v?'|-':'-|'}${label} ${T}`;if(k===3)return v?`${S} -- (${S.slice(1,-1)} |- 0,${fmt(p[1][1])}) -|${label} ${T}`:`${S} -- (${S.slice(1,-1)} -| ${fmt(p[1][0])},0) |-${label} ${T}`;if(k===4)return `${S} ${v?'|-':'-|'}${label} ${coord(v?[p[2][0],p[1][1]]:[p[1][0],p[2][1]])} ${v?'|-':'-|'} ${T}`;return [S,...p.slice(1,-1).map(coord),T].join(' --'+label+' ');}
 // Evaluate the calc-free coordinate/projection grammar used in fixed chains.
 function coordinate(text,objects){text=text.replace(/^\(|\)$/g,'').trim();const m=/^(.*?)\s+(\|-|-\|)\s+(.*)$/.exec(text);if(m){const a=coordinate(m[1],objects),b=coordinate(m[3],objects);return m[2]==='|-'?[a[0],b[1]]:[b[0],a[1]];}const xy=/^(-?[\d.]+),\s*(-?[\d.]+)$/.exec(text);if(xy)return [+xy[1],+xy[2]];const ref=/^(?:\[([^\]]+)\])?([\w-]+)(?:\.(.*))?$/.exec(text);if(!ref)return [0,0];const n=objects.find(n=>n.id===ref[2]);if(!n)return [0,0];const p=point(n,ref[3] || 'center',n);for(const sh of (ref[1]||'').matchAll(/([xy])shift=(-?[\d.]+)mm/g))p[sh[1]==='x'?0:1]+=+sh[2];return p;}
 function chainPoints(chain,objects){const pts=[coordinate(chain[0],objects)];for(let i=1;i<chain.length;i+=2){const p=pts.at(-1),q=coordinate(chain[i+1],objects),op=chain[i];if(op==='|-')pts.push([p[0],q[1]]);if(op==='-|')pts.push([q[0],p[1]]);pts.push(q);}return tidy(pts);}
 function fixedGeometry(e,a,b,objects){let pts=e.chain?chainPoints(e.chain,objects):[port(a,e.fromAnchor || 'east',e.fromOffset),...(e.waypoints || []).map(p=>p.slice()),port(b,e.toAnchor || 'west',e.toOffset)];if(pts.length>2){const first=/east|west/.test(e.fromAnchor || 'east');pts[1][first?1:0]=pts[0][first?1:0];const last=/east|west/.test(e.toAnchor || 'west');pts.at(-2)[last?1:0]=pts.at(-1)[last?1:0];}
  if(e.chain && pts.length>1){if(/^\([\w-]+\)$/.test(e.chain[0]))pts[0]=point(a,undefined,{x:pts[1][0],y:pts[1][1]});if(/^\([\w-]+\)$/.test(e.chain.at(-1)))pts[pts.length-1]=point(b,undefined,{x:pts.at(-2)[0],y:pts.at(-2)[1]});}
  // Only levels intersecting a moved endpoint are displaced. The remaining interior levels stay put.
  if(pts.length>2)for(const [n,side,end,adj,next] of [[a,e.fromAnchor,0,1,2],[b,e.toAnchor,pts.length-1,pts.length-2,pts.length-3]]){
   if(!normals[side])continue;const normal=normals[side],axis=normal[0]?0:1,sign=normal[axis];
   if(sign*(pts[adj][axis]-pts[end][axis])<eps){const old=pts[adj][axis],value=pts[end][axis]+sign*2;pts[adj][axis]=value;if(next!==end && Math.abs(pts[next][axis]-old)<eps)pts[next][axis]=value;}
  }
  for(let pass=0;pass<3;pass++)for(let i=1;i<pts.length-2;i++)for(const n of [a,b])if(hits(n,pts[i],pts[i+1])){const axis=Math.abs(pts[i][0]-pts[i+1][0])<eps?0:1,c=n[axis?'y':'x'],half=n[axis?'h':'w']/2,sign=pts[i][axis]>=c?1:-1;pts[i][axis]=pts[i+1][axis]=c+sign*(half+2);}
  return result(pts,{fixed:true});}

 function removeCorner(pts,j){pts=pts.map(p=>p.slice());if(j<1||j>=pts.length-1)return pts;const a=pts[j-1],b=pts[j+1];if(Math.abs(a[0]-b[0])<eps||Math.abs(a[1]-b[1])<eps)pts.splice(j,1);else if(j+2<pts.length){const c=pts[j+2];if(Math.abs(b[0]-c[0])<eps)b[0]=a[0];else b[1]=a[1];pts.splice(j,1);}else if(j>1){const c=pts[j-2];if(Math.abs(a[0]-c[0])<eps)a[0]=b[0];else a[1]=b[1];pts.splice(j,1);}return tidy(pts);}
 const api={removeCorner,bounds,lane,geometry,point,legacyGeometry,autoRoute,loopGeometry,snapPort,port,portText,polyline,chainPoints,fixedGeometry,tidy,hits};
 if(typeof module!=='undefined') module.exports=api;
 else root.SakugaRoutes=api;
})(typeof window==='undefined' ? globalThis : window);
