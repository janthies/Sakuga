// Rebuild reference 02 entirely through Sakuga model operations.
const t = require('../out/tikz.js');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fig = t.parse(t.TEMPLATE);
const ops = [];
const cat=(key,name,color)=>ops.push({op:'addCategory',key,name,color});
cat('normal','Normal world','blue'); cat('secure','Secure world','red'); cat('hw','Hardware','grey');
cat('ok','Verifier side','green'); cat('rp','Relying party','peach');
ops.push({op:'legend',on:false});
const n=(id,x,y,title,cat,o={})=>ops.push({op:'addNode',id,x,y,title,cat,width:o.w??26,minh:o.h??11,code:o.code||'',style:o.style,kind:o.kind});
const X=[0,34,68];
n('app',X[0],0,'Application','normal'); n('rtos',X[1],0,'RTOS / TCP/IP','normal'); n('client',X[2],0,'Attestation\\\\client','normal',{style:{weight:'thick'}});
n('store',X[0],-34,'Protected\\\\storage','secure'); n('crypto',X[1],-34,'Crypto\\\\service','secure'); n('ias',X[2],-34,'Initial attest.\\\\service $^\\dagger$','secure',{style:{weight:'thick'}});
n('bl1',X[0],-68,'Boot ROM\\\\(BL1)','hw'); n('otp',X[1],-68,'OTP / eFuse\\\\\\textbf{IAK}$_{\\mathrm{priv}}$','hw'); n('rec',X[2],-68,'Boot record\\\\{\\scriptsize measurements}','hw');
n('ver',140,-4,'\\textbf{Verifier}\\\\[2pt]{\\scriptsize appraisal policy}\\\\{\\scriptsize freshness check (N)}\\\\{\\scriptsize $\\mathrm{Vrfy}(\\mathrm{IAK_{pub}},\\sigma)$}','ok',{w:36,h:28});
n('end',128,30,'\\textbf{Endorser}\\\\IAK$_{\\mathrm{pub}}$','hw',{w:18,h:12});
n('rvp',152,30,'\\textbf{Ref.\\ value}\\\\\\textbf{provider}','hw',{w:18,h:12});
n('rp',140,-68,'\\textbf{Relying party}\\\\{\\scriptsize fleet backend / gateway}','rp',{w:36,h:17});
const g=(id,name,frame,color,parent='',more={})=>ops.push({op:'addGroup',id,name,frame,color,parent,...more});
g('att','Attester (constrained device)','solid','grey','',{titlePosition:'above-center',titleFont:'small',lineWidth:1,frameColor:'#30343B'});
const world={fill:'tint',fillStrength:18,outline:'dashed',titleBold:true,titlePosition:'above-left'};
g('nw','Normal world (untrusted)','dashed','blue','att',{...world,frameColor:'#2D70A6',titleColor:'#2D70A6'}); g('sw','Secure world (SPE, TF-M)','dashed','red','att',{...world,frameColor:'#CF3C50',titleColor:'#CF3C50'}); g('hw','Hardware root of trust','dashed','grey','att',{...world,frameColor:'#6B7280',titleColor:'#6B7280'});
ops.push({op:'setGroup',ids:['app','rtos','client'],group:'nw'},{op:'setGroup',ids:['store','crypto','ias'],group:'sw'},{op:'setGroup',ids:['bl1','otp','rec'],group:'hw'});
const e=(from,to,label,o={})=>ops.push({op:'addEdge',from,to,label,...o});
e('client','ias','NSC call\\\\\\texttt{get\\_token(N)}');
e('ias','crypto','sign',{labelStyle:{font:'scriptsize',pos:.5,side:'above',dx:0,dy:1.5,color:'#804050',bold:true}}); e('otp','crypto','key'); e('rec','ias','claims');
e('bl1','rec','measures BL2 + images',{kind:'arr-dashed',route:'u',fromAnchor:'south',toAnchor:'south'});
e('end','ver','endorsements',{style:{side:'left'}}); e('rvp','ver','golden hashes',{style:{side:'right'}});
e('ver','att','nonce $N$',{fromAnchor:'west',toAnchor:'east',route:'straight',style:{step:1,side:'above'}});
e('att','ver','evidence\\\\(EAT / COSE)',{fromAnchor:'east',toAnchor:'west',route:'straight',style:{step:2,side:'below'},labelStyle:{font:'scriptsize',pos:.5,dx:2,dy:-1.5}});
e('ver','rp','attestation\\\\result',{style:{step:3,side:'right'}});
e('rp','att','grant /\\\\quarantine',{fromAnchor:'west',toAnchor:'east',route:'straight',style:{step:4,side:'above'}});
n('note',105,-43,'adversary controls\\\\network + NW','',{kind:'label',w:28,h:0,style:{font:'scriptsize',textColor:'#777777'}});
n('foot',65,-96,'$^\\dagger$ attested component \\quad Roles after RATS (RFC 9334); token format per PSA/EAT.','',{kind:'label',w:165,h:0,style:{font:'scriptsize',textColor:'#666666'}});
t.apply(fig,{op:'batch',ops});
for(const [ids,color] of [[['app','rtos','client'],'#2D70A6'],[['store','crypto','ias'],'#CF3C50'],[['bl1','otp','rec'],'#6B7280']]) t.apply(fig,{op:'style',ids,style:{fill:'white',color}});
t.edges(fig).forEach((e,index)=>t.apply(fig,{op:'label',index,style:{font:'scriptsize',...e.labelStyle}}));
const source=t.serialize(fig);
if(t.serialize(t.parse(source))!==source) throw new Error('Example does not round-trip');
fs.writeFileSync(path.join(root,'examples/rats-architecture.sakuga.tikz'),source);
const work=path.join(root,'work/feature-arch');fs.mkdirSync(work,{recursive:true});
const preamble=String.raw`\documentclass[11pt,border=1mm]{standalone}
\usepackage{fontspec}
\setsansfont{OpenSans-Regular.ttf}[Path=${root}/media/,AutoFakeBold=2,AutoFakeSlant=0.2]
\setmonofont{texgyrecursor-regular.otf}[Path=${root}/media/]
\usepackage{tikz}
\usetikzlibrary{arrows.meta,fit,backgrounds,svg.path,shapes.geometric,patterns}
\begin{document}
`;
fs.writeFileSync(path.join(work,'sakuga-02-v3.tex'),preamble+source+'\n\\end{document}\n');
console.log(`Wrote example and ${work}/sakuga-02-v3.tex (${t.nodes(fig).length} nodes, ${t.edges(fig).length} arrows; identical round trip).`);
