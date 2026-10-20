// Interaction checks in a minimal DOM harness; no browser or test dependency required.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const documentEvents = {};
let document;
class Element {
 constructor(tag) { this.tagName=tag.toUpperCase(); this.children=[]; this.dataset={}; this.style={}; this.attributes={}; this.hidden=false; this.className=''; this.value=''; }
 get classList() { return {add:c=>{this.className+=' '+c;},remove:c=>{this.className=this.className.split(' ').filter(v=>v!==c).join(' ');}}; }
 append(...items) { items.forEach(item=>this.appendChild(item)); }
 appendChild(item) { this.children.push(item); item.parent=this; return item; }
 setAttribute(k,v) { this.attributes[k]=String(v); }
 contains(item) { return item===this || this.children.some(child=>child.contains(item)); }
 get isConnected() { return document.body.contains(this); }
 querySelectorAll(selector) { return this.children.flatMap(child=>[...(selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : child.tagName===selector.toUpperCase()) ? [child] : [],...child.querySelectorAll(selector)]); }
 getBoundingClientRect() { const i=this.parent?.children.indexOf(this)||0; return {left:20+i%8*30,top:40+Math.floor(i/8)*30,bottom:70,width:320,height:400}; }
 remove() { this.parent.children=this.parent.children.filter(c=>c!==this); }
 focus() { document.activeElement=this; dispatch('focusin',{target:this}); }
 click() { this.onclick?.(); }
 scrollIntoView() { this.scrolled=true; }
}
function dispatch(name, event) { for(const listener of documentEvents[name]||[]) listener(event); }
function key(key) { return {key,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}}; }
document={body:new Element('body'),createElement:tag=>new Element(tag),addEventListener:(name,fn)=>{(documentEvents[name]??=[]).push(fn);},querySelectorAll:selector=>document.body.querySelectorAll(selector)};
const icons=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../icons/icons.json'),'utf8'));
const context=vm.createContext({document,icons,innerWidth:1000,innerHeight:800,PT:25.4/72.27,window:{addEventListener(){}},console,el:(tag,attrs,parent)=>{const e=new Element(tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);parent?.appendChild(e);return e;},catOf:key=>key==='work'?{icon:'board'}:null,fillOf:()=> '#ffddcc',styleColor:()=> '#ffddcc',palette:{peach:{}}});
const source=fs.readFileSync(require('node:path').join(__dirname,'../media/editor.js'),'utf8');
vm.runInContext(source.slice(source.indexOf('\tfunction iconShape'),source.indexOf('\tfunction titleLines')),context);
const run=code=>vm.runInContext(code,context);
run("const picked=[]; const first=iconPicker('',value=>picked.push(value)); document.body.append(first); buildIconPanel(); first.click();");
assert.equal(run('iconPanel.hidden'),false);
assert.equal(run('iconEntries.length'),icons.length+1);
assert.equal(run("iconEntries[0].textContent"),'No icon');
assert.equal(run('iconGroups.length'),new Set(icons.map(i=>i.category)).size);
assert.equal(run("iconEntries.find(b=>b.dataset.value==='board').children[0].children.length"),icons.find(i=>i.name==='board').paths.length);
const preview=run("iconEntries.find(b=>b.dataset.value==='board')");
run("iconPanel.children[0].value='board'; iconPanel.children[0].oninput();");
assert.equal(run("iconEntries.find(b=>b.dataset.value==='board').hidden"),false);
assert.equal(run("iconEntries.find(b=>b.dataset.value==='bus').hidden"),true);
// First filtered entry is No icon; ArrowRight moves to the matching preview.
context.event=key('ArrowRight');run('iconPanel.onkeydown(event)');
context.event=key('Enter');run('iconPanel.onkeydown(event)');
assert.equal(run('picked[0]'),'board'); assert.equal(run('iconPanel.hidden'),true);
run('first.click()'); assert.equal(run("iconEntries.find(b=>b.dataset.value==='board')"),preview,'Opening must reuse the rendered previews');
dispatch('keydown',key('Escape')); assert.equal(run('iconPanel.hidden'),true);
run("const second=iconPicker('board',value=>picked.push('second:'+value)); document.body.append(second); second.click(); iconEntries[0].click();");
assert.equal(run('picked[1]'),'second:');
run("first.click(); iconPanel.children[0].value='unlikely-no-matches'; iconPanel.children[0].oninput();");
assert.equal(run('iconEntries.filter(b=>!b.hidden).length'),1,'No icon remains available for an empty result');
dispatch('pointerdown',{target:document.body}); assert.equal(run('iconPanel.hidden'),true);
run("const category=categoryChoice([['work','Work'],['','None']],'work',value=>picked.push(value)); document.body.append(category); category.click();");
assert.equal(run("category.children[0].style.background"),'#ffddcc');
assert.equal(run('category.children[1].tagName'),'SVG');
context.event=key('ArrowDown');run('floating.panel.onkeydown(event)');
assert.equal(run('document.activeElement.children[0].textContent'),'None');
run('document.activeElement.click()');assert.equal(run('picked[2]'),'');
console.log('Grouped previews, filtering, keyboard selection, clearing, dismissal, preview reuse and visual category choice passed.');
