const routing = require('../media/routes.js');
const textGeometry = require('../media/text.js');
// The figure file is TikZ. Sakuga understands one node or one arrow per line, category lines
// in the header and two generated blocks (theme and legend); every other line is kept as it is.

// Fill colours a category can take, in the look of Fig. 5.2 of the Masterarbeit.
export const PALETTE: Record<string, { name: string; hex: string; mix: number }> = {
	blue: { name: 'sgBlue', hex: 'BBCCEE', mix: 85 },
	green: { name: 'sgGreen', hex: 'CCDDAA', mix: 85 },
	peach: { name: 'sgPeach', hex: 'FFDDCC', mix: 100 },
	grey: { name: 'sgGrey', hex: 'DDDDDD', mix: 70 },
	yellow: { name: 'sgYellow', hex: 'EEEEBB', mix: 85 },
	cyan: { name: 'sgCyan', hex: 'CCEEFF', mix: 100 },
	red: { name: 'sgRed', hex: 'FFCCCC', mix: 100 },
	accent: { name: 'palRose', hex: 'CC6677', mix: 100 },
	black: { name: 'black', hex: '000000', mix: 100 },
	white: { name: 'white', hex: 'FFFFFF', mix: 100 },
};
export const FONT_SIZES = ['scriptsize', 'footnotesize', 'small', 'normalsize', 'large'];
export const fontSize = (fig: Figure) => fig.lines.flatMap(l => l.t === 'raw' && /^% sakuga font /.test(l.text) ? [l.text.slice(14)] : [])[0] || 'small';
export const smallerFont = (size: string) => ({scriptsize:'tiny', footnotesize:'scriptsize', small:'footnotesize', normalsize:'small', large:'normalsize'}[size] || 'footnotesize');
export interface ObjectStyle { compact?: boolean; lineWidth?: number; tipLength?: number; tipWidth?: number; step?: number; opacity?: number; pattern?: string; patternColor?: string; mark?: string; markCorner?: string; markSize?: string; markColor?: string; shape?: string; fill?: string; border?: string; color?: string; weight?: string; text?: string; font?: string; textColor?: string; start?: string; end?: string; position?: string; side?: string }
export const ARROWS = ['arr', 'arr-dashed'] as const;
export const DEFAULT_WIDTH = 26;

export interface Icon { name: string; category: string; paths: string[]; circles?: { cx: number; cy: number; r: number }[]; rects?: { x: number; y: number; width: number; height: number; rx?: number }[] }
let iconCatalog: Icon[] = [];
export function setIcons(icons: Icon[]) { iconCatalog = icons; }
export interface Category { key: string; name: string; color: string; icon?: string; boxes?: boolean; legend?: boolean }
// A named style acts on every object that names it. One flat level per kind, no inheritance.
// props use the names of ObjectStyle (a box style's colour is its fill); an object keeps only
// the properties that differ from its style, which are its overrides.
export type StyleKind = 'box' | 'arrow' | 'frame' | 'label';
export const STYLE_KINDS: StyleKind[] = ['box', 'arrow', 'frame', 'label'];
export interface StyleDef { kind: StyleKind; key: string; name: string; legend?: boolean; icon?: string; boxes?: boolean; props: Record<string, any> }
// Properties a style can hold for the objects that use it, and groups that always travel together
// (a font size without the emphasis, or the tips of an arrow, would change meaning if split).
export const STYLEABLE: Record<StyleKind, string[]> = {
	box: ['fill', 'color', 'border', 'weight', 'lineWidth', 'shape', 'font', 'text', 'textColor'],
	label: ['fill', 'color', 'border', 'weight', 'lineWidth', 'font', 'text', 'textColor'],
	arrow: ['color', 'border', 'lineWidth', 'tipLength', 'tipWidth', 'start', 'end'],
	frame: ['frame', 'color', 'frameColor', 'outline', 'fill', 'fillStrength', 'lineWidth', 'padding', 'titlePosition', 'titleBold', 'titleFont', 'titleColor'],
};
const STYLE_GROUPS: Record<StyleKind, string[][]> = { box: [['font', 'text'], ['weight', 'lineWidth']], label: [['font', 'text'], ['weight', 'lineWidth']], arrow: [['tipLength', 'tipWidth', 'start', 'end']], frame: [] };
const PRIMARY: Record<StyleKind, string> = { box: 'fill', label: 'textColor', arrow: 'color', frame: 'color' };
const NUMBER_PROPS = ['lineWidth', 'tipLength', 'tipWidth', 'fillStrength', 'padding'];
const BOOLEAN_PROPS = ['titleBold'];
export const ANCHORS = ['north west', 'north', 'north east', 'west', 'center', 'east', 'south west', 'south', 'south east'];
export interface Attachment { parent: string; anchor: string; ownAnchor: string; dx: number; dy: number }
export interface FigNode {
	titlePosition?: string; attachment?: Attachment;
	wantWidth?: number; codeFont?: string; style?: ObjectStyle; id: string; icon?: string; iconPosition?: string; kind?: string; cat: string; x: number; y: number; title: string; code: string; width: number; minh: number;
	layer: string; group: string; hidden: boolean; locked: boolean; extra: string[];
}
// A group is a folder in the layer stack; it can draw a frame or a tinted region around its members.
export interface Layer { opacity?: number; id: string; name: string; hidden: boolean; locked: boolean }
export interface LabelStyle { segment?: number; pos?: number; dx?: number; dy?: number; side?: string; font?: string; bold?: boolean; italic?: boolean; color?: string; background?: boolean }
export interface AttachedLabel { text: string; style?: LabelStyle }
export interface Group { fill?: string; fillStrength?: number; outline?: string; labelStyle?: LabelStyle; padding?: number; titlePosition?: string; titleBold?: boolean; titleFont?: string; titleColor?: string; lineWidth?: number; frameColor?: string; id: string; name: string; frame: string; color: string; parent: string }
const newDefaultGroups = new WeakSet<Group>();
export const FRAMES = ['none', 'dashed', 'dotted', 'solid', 'region'] as const;
// route: 'auto' uses the ordered orthogonal router; 'straight', 'manhattan' and 'curved' choose a style
// for this arrow; 'hvh' (across, down, across; mid = x of the vertical part), 'vhv' (down, across,
// down; mid = y of the horizontal part) and 'bend' (bend in degrees, positive = left) are shapes set
// by hand. mid = null puts the corner at the target. head: 'end', 'both' or 'none'.
// Fixed chains use native coordinate/operator tokens; editable waypoints are absolute mm.
// Side offsets and loop control distances use mm; loop angles use TikZ degrees.
export interface FigEdge { styleKey?: string; fromOffset?: number; toOffset?: number; loopSide?: string; loopSize?: number; loopOut?: number; loopIn?: number; looseness?: number; loopMax?: number; chain?: string[]; waypoints?: number[][]; fromAnchor?: string; toAnchor?: string; lane?: number;
	labelStyle?: LabelStyle; labels?: AttachedLabel[]; style?: ObjectStyle; from: string; to: string; kind: string; route: string; mid: number | null; bend: number;
	head: string; label: string; extra: string[];
}
export const STYLES = ['straight', 'manhattan', 'curved'] as const;
const MARKERS = ['sg straight', 'sg manhattan', 'sg curved', 'sg fixed'];

type Line =
	| { t: 'node'; n: FigNode }
	| { t: 'edge'; e: FigEdge }
	| { t: 'style'; s: StyleDef }
	| { t: 'legendflag'; on: boolean }
	| { t: 'arrowsflag'; style: string }
	| { t: 'layer'; layer: Layer }
	| { t: 'group'; g: Group }
	| { t: 'groups' }
	| { t: 'theme' }
	| { t: 'icons' }
	| { t: 'legend' }
	| { t: 'raw'; text: string };

export interface Figure { lines: Line[] }

const PIC = /^\s*\\pic\[(.*)\]\s*\(([\w-]+)\)\s*at\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*\{sg object=\{([\w-]*)\}\{([\d.]+)\}\{([\d.]+)\}\};\s*$/;
const NODE = /^\s*\\node\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*\(([\w-]+)\)\s*at\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*\{(.*)\};\s*$/;
const EDGE = /^\s*\\draw\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*(\(.*\));\s*$/;
const ARROWSFLAG = /^%\s*sakuga arrows\s+(straight|manhattan|curved)\s*$/;
const GROUP = /^%\s*sakuga group\s+([\w-]+)\s+\{([^}]*)\}\s+(\w+)\s+([#\w-]+)(?:\s+in=([\w-]+))?(.*)$/;
const LAYER = /^%\s*sakuga layer\s+([\w-]+)\s+\{([^}]*)\}(?:\s+(hidden))?(?:\s+(locked))?(?:\s+opacity=([\d.]+))?\s*$/;
const HIDDEN = /^%\s*sakuga hidden\s+(.*)$/;
const CAT = /^%\s*sakuga category\s+([\w-]+)\s+\{([^}]*)\}\s+([#\w]+)(?:\s+icon=([\w-]+))?(?:\s+(boxes))?(?:\s+(no-legend))?\s*$/;
const STYLE = /^%\s*sakuga style\s+(box|arrow|frame|label)\s+([\w-]+)\s+\{([^}]*)\}(.*)$/;
const LEGENDFLAG = /^%\s*sakuga legend\s+(on|off)\s*$/;
const CODE = /\\\\\[-1pt\]\\sgcode\{(.*)\}$/;

function opts(s: string): string[] {
	const out: string[] = [];
	let start = 0, depth = 0;
	for (let i = 0; i < s.length; i++) {
		if (s[i - 1] === '\\') { continue; }
		if ('{['.includes(s[i])) { depth++; }
		else if ('}]'.includes(s[i])) { depth--; }
		else if (s[i] === ',' && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
	}
	out.push(s.slice(start).trim());
	return out.filter(Boolean);
}

const shapeKeys: Record<string,string> = {rounded:'rounded corners=1.4pt', rectangle:'rounded corners=0pt', pill:'rounded corners=100mm', ellipse:'ellipse', circle:'circle', diamond:'diamond', cylinder:'cylinder'};
const tipKeys: Record<string,string> = {Latex:'Latex[length=1.5mm, width=1.2mm]', Stealth:'Stealth[length=1.5mm, width=1.2mm]', triangle:'Triangle[open, length=1.5mm, width=1.2mm]', barb:'Straight Barb[length=1.5mm, width=1.2mm]', circle:'Circle[length=1.2mm]', bar:'Bar[width=1.2mm]', none:''};
const patternKeys: Record<string,string> = {hatched:'north east lines', crosshatch:'crosshatch', dots:'dots', horizontal:'horizontal lines', vertical:'vertical lines'};
const cornerKeys: Record<string,string> = {ne:'north east', nw:'north west', se:'south east', sw:'south west'};
const readColor = (v: string) => /^sgc[0-9a-f]{6}$/i.test(v) ? '#'+v.slice(3).toUpperCase() : Object.keys(PALETTE).find(k => fill(k) === v) || (v === 'black!25' ? v : '');
export function darkerColor(color: string): string {
 const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : (PALETTE[color] || PALETTE.grey).hex;
 return '#'+[0,2,4].map(i => Math.round(parseInt(hex.slice(i,i+2),16)*0.6).toString(16).padStart(2,'0')).join('').toUpperCase();
}
const groupDefaults: Record<string, unknown> = {padding:0,titlePosition:'legacy',titleBold:false,titleFont:'scriptsize',titleColor:'',lineWidth:0,frameColor:'',fill:'',fillStrength:30,outline:'',labelStyle:undefined};
function readGroup(tail: string): Partial<Group> {
 const g: any = {};
 for (const m of (tail || '').matchAll(/(padding|titlePosition|titleBold|titleFont|titleColor|lineWidth|frameColor|fill|fillStrength|outline|labelStyle)=([^ ]+)/g)) {
  g[m[1]] = m[1] === 'titleBold' ? m[2] === 'true' : ['padding','lineWidth','fillStrength'].includes(m[1]) ? +m[2] : m[1]==='labelStyle' ? JSON.parse(Buffer.from(m[2],'hex').toString()) : m[2];
 }
 return g;
}
function groupOptions(g: Group): string {
 const defaults={...groupDefaults,padding:g.frame==='dashed' ? 2.8 : g.frame==='dotted' ? 1.8 : 3,lineWidth:g.frame==='region' || g.frame==='none' ? 0 : g.frame==='dotted' ? 1.5 : .7};
 return Object.entries(defaults).filter(([k,v]) => (g as any)[k] !== undefined && (g as any)[k] !== '' && (g as any)[k] !== v && !(['padding','lineWidth'].includes(k) && (g as any)[k]===0)).map(([k]) => ` ${k}=${k==='labelStyle' ? Buffer.from(JSON.stringify(cleanLabel(g.labelStyle))).toString('hex') : (g as any)[k]}`).join('');
}
export function cleanLabel(st: LabelStyle = {}): LabelStyle {
 const out: any = {}; const defaults: any = {pos:.5,dx:0,dy:0,side:'',font:'',color:''};
 for(const [k,v] of Object.entries(st)) if(v !== undefined && v !== null && v !== defaults[k]) out[k]=v;
 return out;
}
export function frameAppearance(g: Group) {
 return {fill:g.fill || (g.frame==='region' ? 'tint' : 'none'), strength:g.fillStrength ?? 30, outline:g.outline || (g.frame==='region' || g.frame==='none' ? (g.lineWidth ? 'solid' : 'none') : g.frame), color:g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'), width:g.lineWidth || (g.frame==='dotted' ? 1.5 : .7)};
}
function labelMetrics(text:string,st:LabelStyle | undefined,font:string,step=0):string {
 const pt=({scriptsize:8,footnotesize:9,small:10,normalsize:10.95,large:12} as Record<string,number>)[st?.font || font] || 10;
 const h=Math.max(text.split('\\\\').length*pt*1.25,step ? 3.6/(25.4/72.27) : 0);
 return `, outer sep=0pt, text height=${h*.6}pt, text depth=${h*.4}pt`;
}
function labelOptions(st: LabelStyle = {}, defaults: LabelStyle = {}): string {
 const v={...defaults,...cleanLabel(st)};
 return [v.pos !== undefined ? `pos=${v.pos}` : '',v.side || '',v.dx || v.dy ? `shift={(${v.dx || 0}mm,${v.dy || 0}mm)}` : '',v.color ? `text=${fill(v.color)}` : '',`font=\\sffamily\\${v.font || 'small'}${v.bold ? '\\bfseries' : ''}${v.italic ? '\\itshape' : ''}`,v.background===false ? 'fill=none' : v.background===true ? 'fill=white' : ''].filter(Boolean).map(v=>', '+v).join('');
}
function markOption(st: ObjectStyle): string {
 const corner = st.markCorner || 'ne', anchor = `path picture bounding box.${cornerKeys[corner] || cornerKeys.ne}`;
 const size = st.markSize === 'medium' ? 5 : 2.4, x = corner.endsWith('e') ? -1 : 1, y = corner.startsWith('n') ? -1 : 1;
 const path = st.mark === 'circle' ? `([xshift=${x*size/2}mm,yshift=${y*size/2}mm]${anchor}) circle[radius=${size/2}mm]` : `(${anchor}) -- ([xshift=${x*size}mm]${anchor}) -- ([yshift=${y*size}mm]${anchor}) -- cycle`;
 return `path picture={\\path[fill=${fill(st.markColor || '#33333A')},draw=none,sharp corners] ${path};}`;
}
// Opacity on the command is the rendered product. sg opacity retains the editable
// object value when a layer contributes, so repeated saves never multiply twice.
const opacity = (value: number | undefined) => value === undefined || !Number.isFinite(value) ? 1 : Math.max(0, Math.min(1, value));
function opacityOptions(own: number | undefined, layer = 1): string[] {
 const value = opacity(own), effective = Math.round(value * opacity(layer) * 1e6) / 1e6;
 return [...(effective !== 1 ? [`opacity=${effective}`] : []), ...(layer !== 1 ? [`sg opacity=${value}`] : [])];
}
export const nodeOpacity = (fig: Figure, n: FigNode) => opacity(n.style?.opacity) * opacity(nodeLayer(fig,n).opacity);
export const edgeLayerOpacity = (fig: Figure, e: FigEdge) => { const source = nodes(fig).find(n => n.id === e.from); return source ? opacity(nodeLayer(fig,source).opacity) : 1; };

function scaledTip(key: string, st: ObjectStyle): string {
 return (tipKeys[key] || '').replace(/length=[\d.]+mm/,`length=${st.tipLength ?? 1.5}mm`).replace(/width=[\d.]+mm/,`width=${st.tipWidth ?? 1.2}mm`);
}
function styleOptions(st: ObjectStyle = {}, arrow = false, height = 6.16, ctx: { thin?: boolean; redraw?: boolean } = {}): string[] {
 const out: string[] = [];
 if(st.compact) out.push('sg compact');
 if (!arrow && st.shape && shapeKeys[st.shape]) { out.push(st.shape === 'pill' ? `rounded corners=${Math.round(height * 50) / 100}mm` : shapeKeys[st.shape]); }
 if (st.textColor) { out.push(`text=${fill(st.textColor)}`); }
 if (st.fill) { out.push(`fill=${st.fill === 'none' ? 'none' : fill(st.fill)}`); }
 if (st.color) { out.push(`draw=${st.color === 'black' ? 'black' : fill(st.color)}`); }
 if (st.border) { out.push(st.border === 'none' ? 'draw=none' : ctx.redraw && st.border === 'solid' ? 'draw=black!38' : st.border); if (st.border === 'double') { out.push('double distance=0.8pt'); } }
 if (!arrow && st.patternColor) { out.push(`pattern color=${fill(st.patternColor)}`); }
 if (!arrow && st.pattern && patternKeys[st.pattern]) { out.push(`postaction={pattern=${patternKeys[st.pattern]},pattern color=${fill(st.patternColor || 'black!25')}}`); }
 if (!arrow && st.mark && st.mark !== 'none') { out.push(markOption(st)); }
 if (arrow && st.lineWidth !== undefined && st.lineWidth !== 0.45) { out.push(`line width=${st.lineWidth}pt`, `sg line width=${st.lineWidth}`); }
 if (arrow && st.tipLength !== undefined && st.tipLength !== 1.5) { out.push(`sg tip length=${st.tipLength}`); }
 if (arrow && st.tipWidth !== undefined && st.tipWidth !== 1.2) { out.push(`sg tip width=${st.tipWidth}`); }
 if (st.step) { out.push(`sg step=${st.step}`); }
 if (!arrow && st.lineWidth !== undefined) { out.push(`line width=${st.lineWidth}pt`); }
 else if (st.weight && st.weight !== 'thin' && !(arrow && st.lineWidth !== undefined)) { out.push(`line width=${st.weight === 'medium' ? '0.8' : '1.2'}pt`); }
 else if (!arrow && st.weight === 'thin' && ctx.thin) { out.push('line width=0.45pt'); }
 if (st.font || st.text) { out.push(`font=\\sffamily${st.font ? '\\'+st.font : ''}${st.text === 'bold' ? '\\bfseries' : st.text === 'italic' ? '\\itshape' : st.text === 'bold-italic' ? '\\bfseries\\itshape' : ''}`); }
 if (arrow && ((st.tipLength !== undefined && st.tipLength !== 1.5) || (st.tipWidth !== undefined && st.tipWidth !== 1.2) || (st.start && st.start !== 'none') || (st.end && st.end !== 'Latex'))) { out.push(`{${scaledTip(st.start || 'none', st)}}-{${scaledTip(st.end || 'Latex', st)}}`); }
 return out;
}
function readStyle(options: string[], arrow = false, styled = false): {style: ObjectStyle; extra: string[]} {
 const style: ObjectStyle = {}, extra: string[] = [];
 for (const o of options) {
  const shape = Object.keys(shapeKeys).find(k => shapeKeys[k] === o) || (/^rounded corners=[\d.]+mm$/.test(o) ? 'pill' : '');
  if(o==='sg compact') {style.compact=true;}
  else if (/^(?:sg )?opacity\s*=/.test(o)) { const v = Number(o.split('=')[1]); if (Number.isFinite(v)) { style.opacity = opacity(v); } else { extra.push(o); } }
  else if (shape) { style.shape = shape; }
  else if (o === 'solid' || o === 'dashed' || o === 'dotted' || o === 'double') { style.border = o; }
  else if (o === 'double distance=0.8pt') { /* emitted with double */ }
  else if (o.startsWith('pattern color=') && readColor(o.slice(14))) { style.patternColor = readColor(o.slice(14)); }
  else if (o.startsWith('postaction={pattern=')) {
   const m = /^postaction=\{pattern=([^,]+),\s*pattern color=([^}]+)\}$/.exec(o);
   const key = m && Object.keys(patternKeys).find(k => patternKeys[k] === m[1]);
   if (m && key && readColor(m[2])) { style.pattern = key; if (m[2] !== 'black!25') { style.patternColor = readColor(m[2]); } } else { extra.push(o); }
  }
  else if (o.startsWith('path picture=')) {
   const color = /fill=([^,]+)/.exec(o), corner = /bounding box\.(north east|north west|south east|south west)/.exec(o);
   const size = /(?:xshift|yshift)=(-?[\d.]+)mm/.exec(o);
   const candidate: ObjectStyle = {mark:o.includes('circle[radius=') ? 'circle' : 'triangle'};
   if (color && corner && size) {
    const c = Object.keys(cornerKeys).find(k => cornerKeys[k] === corner[1])!;
    if (c !== 'ne') { candidate.markCorner = c; }
    if (Math.abs(+size[1]) * (candidate.mark === 'circle' ? 2 : 1) === 5) { candidate.markSize = 'medium'; }
    if (color[1] !== 'sgc33333A') { candidate.markColor = readColor(color[1]); }
   }
   if (color && corner && size && markOption(candidate) === o) { Object.assign(style, candidate); } else { extra.push(o); }
  }
  else if (o.startsWith('text=') && readColor(o.slice(5))) { style.textColor = readColor(o.slice(5)); }
  else if (o === 'draw=none') { style.border = 'none'; }
  else if (styled && !arrow && o === 'draw=black!38') { style.border = 'solid'; }
  else if (styled && !arrow && o === 'line width=0.45pt') { style.weight = 'thin'; }
  else if (!arrow && /^line width=[\d.]+pt$/.test(o) && !/^line width=(0.8|1.2)pt$/.test(o)) { style.lineWidth = parseFloat(o.slice(11)); }
  else if (/^(fill|draw)=/.test(o)) {
   const v = o.split('=')[1], color = readColor(v) || (v === 'none' ? v : '');
   if (color) { style[o.startsWith('fill') ? 'fill' : 'color'] = color; } else { extra.push(o); }
  } else if (arrow && /^line width=[\d.]+pt$/.test(o)) { if (o === 'line width=0.8pt' || o === 'line width=1.2pt') { style.weight = o.includes('0.8') ? 'medium' : 'thick'; } else { style.lineWidth = parseFloat(o.slice(11)); } }
  else if (arrow && /^sg label (side|position)=/.test(o)) { const [key,v]=o.split('='); style[key==='sg label side' ? 'side' : 'position']=v; }
  else if (/^sg step=/.test(o) || (arrow && /^sg (line width|tip length|tip width|step)=/.test(o))) { const [key,v] = o.split('='); (style as any)[key === 'sg line width' ? 'lineWidth' : key === 'sg step' ? 'step' : key === 'sg tip length' ? 'tipLength' : 'tipWidth'] = +v; }
  else if (/^line width=(0.8|1.2)pt$/.test(o)) { style.weight = o.includes('0.8') ? 'medium' : 'thick'; }
  else if (o.startsWith('font=') && /\\(sffamily|bfseries|itshape|scriptsize|footnotesize|small|normalsize|large)/.test(o)) {
   style.font = FONT_SIZES.find(f => o.includes('\\'+f));
   if (o.includes('\\bfseries')) { style.text = o.includes('\\itshape') ? 'bold-italic' : 'bold'; } else if (o.includes('\\itshape')) { style.text = 'italic'; }
  } else if (arrow && /^\{.*\}-\{.*\}$/.test(o)) {
   const m = /^\{(.*)\}-\{(.*)\}$/.exec(o)!;
   style.start = Object.keys(tipKeys).find(k => scaledTip(k,style) === m[1]); style.end = Object.keys(tipKeys).find(k => scaledTip(k,style) === m[2]);
  } else { extra.push(o); }
 }
 if (options.some(o=>o.startsWith('sg line width='))) delete style.weight;
 const own = options.find(o => /^sg opacity\s*=/.test(o));
 if (own && Number.isFinite(Number(own.split('=')[1]))) { style.opacity = opacity(Number(own.split('=')[1])); }
 return {style, extra};
}


// ---- Named styles: reading and writing the `% sakuga style` lines ----
function readStyleLine(kind: StyleKind, key: string, name: string, tail: string): StyleDef {
 const def: StyleDef = { kind, key, name, props: {}, legend: false };
 for (const tok of tail.trim().split(/\s+/).filter(Boolean)) {
  let m: RegExpExecArray | null;
  if (tok === 'boxes') { def.boxes = true; }
  else if (tok === 'legend') { def.legend = true; }
  else if ((m = /^icon=([\w-]+)$/.exec(tok))) { def.icon = m[1]; }
  else if ((m = /^([A-Za-z]+)=(.*)$/.exec(tok))) { def.props[m[1]] = NUMBER_PROPS.includes(m[1]) ? +m[2] : BOOLEAN_PROPS.includes(m[1]) ? m[2] === 'true' : m[2]; }
  else if (kind === 'arrow' && /^(solid|dashed|dotted|double)$/.test(tok)) { def.props.border = tok; }
  else if (kind === 'frame' && /^(none|dashed|dotted|solid|region)$/.test(tok)) { def.props.frame = tok; }
  else if (PALETTE[tok] || /^#[0-9a-f]{6}$/i.test(tok)) { def.props[PRIMARY[kind]] = tok; }
 }
 return def;
}
const isColour = (v: unknown) => typeof v === 'string' && (!!PALETTE[v] || /^#[0-9a-f]{6}$/i.test(v));
export function styleLine(d: StyleDef): string {
 const p = { ...d.props }, parts: string[] = [];
 if (d.kind === 'arrow' && p.border) { parts.push(p.border); delete p.border; }
 if (d.kind === 'frame' && p.frame) { parts.push(p.frame); delete p.frame; }
 const primary = PRIMARY[d.kind];
 if (isColour(p[primary])) { parts.push(p[primary]); delete p[primary]; }
 if (d.icon) { parts.push('icon=' + d.icon); }
 if (d.boxes) { parts.push('boxes'); }
 if (d.legend) { parts.push('legend'); }
 for (const k of STYLEABLE[d.kind]) { if (p[k] !== undefined && p[k] !== null && p[k] !== '') { parts.push(`${k}=${p[k]}`); } }
 return `% sakuga style ${d.kind} ${d.key} {${d.name}}${parts.length ? ' ' + parts.join(' ') : ''}`;
}
export const styleDefs = (fig: Figure) => fig.lines.flatMap(l => l.t === 'style' ? [l.s] : []);
export const findStyle = (fig: Figure, key: string | undefined, kind?: StyleKind) => key ? styleDefs(fig).find(s => s.key === key && (!kind || s.kind === kind)) : undefined;
// The box styles as the old category list: colour, icon, "icon in boxes", legend flag.
export const categories = (fig: Figure): Category[] => styleDefs(fig).filter(s => s.kind === 'box').map(s => ({ key: s.key, name: s.name, color: s.props.fill || 'white', icon: s.icon, boxes: s.boxes, legend: !!s.legend }));
export const nodeStyleKind = (n: FigNode): StyleKind | null => n.kind === 'icon' ? null : n.kind === 'label' ? 'label' : 'box';
const objectKey = (o: FigNode | FigEdge) => 'from' in o ? o.styleKey : o.cat;
const objectKind = (o: FigNode | FigEdge): StyleKind | null => 'from' in o ? 'arrow' : nodeStyleKind(o);
export const styleOf = (fig: Figure, o: FigNode | FigEdge) => { const k = objectKind(o); return k ? findStyle(fig, objectKey(o), k) : undefined; };
const isSet = (v: unknown) => v !== undefined && v !== null && v !== '';
export const styleableOf = (kind: StyleKind, st: Record<string, any> = {}) => Object.fromEntries(STYLEABLE[kind].filter(k => isSet(st[k])).map(k => [k, st[k]]));
// The object's own values on top of its style; a group is taken whole from the object if it names any of it.
export function mergeStyle(kind: StyleKind, base: Record<string, any>, st: Record<string, any>): ObjectStyle {
 const out: any = { ...st }, groups = STYLE_GROUPS[kind], grouped = new Set(groups.flat());
 for (const k of STYLEABLE[kind]) { if (!grouped.has(k) && out[k] === undefined && isSet(base[k])) { out[k] = base[k]; } }
 for (const g of groups) { if (g.every(k => out[k] === undefined)) { for (const k of g) { if (isSet(base[k])) { out[k] = base[k]; } } } }
 return out;
}
// What an object changes against its style (plus every property a style cannot hold).
export function overrideOf(kind: StyleKind, st: Record<string, any>, base: Record<string, any>): ObjectStyle {
 const out: any = {}, groups = STYLE_GROUPS[kind], grouped = new Set(groups.flat());
 for (const k of Object.keys(st)) { if (!STYLEABLE[kind].includes(k)) { out[k] = st[k]; } }
 for (const k of STYLEABLE[kind]) { if (!grouped.has(k) && st[k] !== undefined && st[k] !== base[k]) { out[k] = st[k]; } }
 for (const g of groups) { if (g.some(k => st[k] !== base[k])) { for (const k of g) { if (st[k] !== undefined) { out[k] = st[k]; } } } }
 return out;
}
export function overrideKeys(fig: Figure, o: FigNode | FigEdge): string[] {
 const def = styleOf(fig, o), kind = objectKind(o);
 if (!def || !kind) { return []; }
 const ov = overrideOf(kind, o.style || {}, def.props);
 const keys = new Set(STYLEABLE[kind].filter(k => (ov as any)[k] !== undefined));
 for (const g of STYLE_GROUPS[kind]) { if (g.some(k => keys.has(k))) { g.forEach(k => keys.add(k)); } }
 return STYLEABLE[kind].filter(k => keys.has(k));
}
// Make every styled object carry style + overrides (idempotent).
export function settle(fig: Figure) {
 for (const o of [...nodes(fig), ...edges(fig)]) {
  const def = styleOf(fig, o);
  if (def) { o.style = mergeStyle(def.kind, def.props, o.style || {}); }
 }
}
// Boxes that share the same overrides against the same style: candidates for a new style.
export function sharedOverrides(fig: Figure): { cat: string; props: Record<string, any>; ids: string[] }[] {
 const groupsOf = new Map<string, { cat: string; props: Record<string, any>; ids: string[] }>();
 for (const n of nodes(fig)) {
  if (n.kind) { continue; }
  const def = findStyle(fig, n.cat, 'box');
  const props = def ? styleableOf('box', overrideOf('box', n.style || {}, def.props)) : styleableOf('box', n.style || {});
  if (!Object.keys(props).length) { continue; }
  const sig = JSON.stringify([n.cat, Object.entries(props).sort()]);
  const g = groupsOf.get(sig) ?? { cat: n.cat, props, ids: [] };
  g.ids.push(n.id); groupsOf.set(sig, g);
 }
 return [...groupsOf.values()].filter(g => g.ids.length >= 2);
}
function withTips(st: ObjectStyle): ObjectStyle {
 return st.start || st.end || st.tipLength !== undefined || st.tipWidth !== undefined ? { ...st, start: st.start || 'none', end: st.end || 'Latex' } : st;
}
// Options of the TikZ style definition `sg style/<key>`.
function styleDefOptions(d: StyleDef): string[] {
 const p = d.props as ObjectStyle;
 if (d.kind === 'box') { return ['sg box', ...styleOptions(p, false)]; }
 if (d.kind === 'label') { return ['sg label', ...(p.border && p.border !== 'none' ? ['draw=black!38'] : []), ...styleOptions(p, false)]; }
 if (d.kind === 'arrow') { return ['arr', ...styleOptions(withTips(p), true)]; }
 return [`sg frame ${(d.props.frame && d.props.frame !== 'none') ? d.props.frame : 'dashed'}`];
}

export function parse(text: string): Figure {
	const lines: Line[] = [];
	const individuallyHidden = new Set<string>();
	const labelKeys = new Set(Array.from(text.matchAll(/^%\s*sakuga style label\s+([\w-]+)/gm), m => m[1]));
	let block: 'theme' | 'legend' | 'groups' | 'icons' | null = null;
	for (let line of text.split(/\r?\n/)) {
		const hidden = HIDDEN.exec(line);
		if (hidden && !block) {
			line = hidden[1];
		}
		if (block) {
			if (line.includes(`% sakuga ${block} end`)) {
				block = null;
			}
			continue;
		}
		if (/^%\s*sakuga (theme|legend|groups|icons) begin/.test(line)) {
			block = line.includes('icons') ? 'icons' : line.includes('theme') ? 'theme' : line.includes('groups') ? 'groups' : 'legend';
			lines.push({ t: block });
			continue;
		}
		const relative = /at \(\[shift=\{\((-?[\d.]+)(?:mm)?,\s*(-?[\d.]+)(?:mm)?\)\}\]([\w-]+)\.(north west|north east|south west|south east|north|south|east|west|center)\)/.exec(line);
		const own = /(?:\[|,\s*)anchor=(north west|north east|south west|south east|north|south|east|west|center)(?=,|\])/.exec(line);
		const attachment: Attachment | undefined = relative ? {parent:relative[3], anchor:relative[4], ownAnchor:own?.[1] || 'center', dx:+relative[1], dy:+relative[2]} : undefined;
		if (relative) { line = line.replace(relative[0], 'at (0,0)'); }
		let m = LAYER.exec(line);
		if (m) { lines.push({ t: 'layer', layer: { id: m[1], name: m[2], hidden: !!m[3], locked: !!m[4], ...(m[5] !== undefined ? {opacity: opacity(+m[5])} : {}) } }); continue; }
		m = CAT.exec(line);
		if (m) {
			lines.push({ t: 'style', s: { kind: 'box', key: m[1], name: m[2], props: { fill: m[3] }, icon: m[4], boxes: !!m[5], legend: !m[6] } });
			continue;
		}
		m = STYLE.exec(line);
		if (m) {
			lines.push({ t: 'style', s: readStyleLine(m[1] as StyleKind, m[2], m[3], m[4]) });
			continue;
		}
		m = LEGENDFLAG.exec(line);
		if (m) {
			lines.push({ t: 'legendflag', on: m[1] === 'on' });
			continue;
		}
		m = PIC.exec(line);
		if (m) {
			// Pics use their origin, so the emitted shift already accounts for the own anchor.
			if (attachment) {
				attachment.dx += attachment.ownAnchor.includes('west') ? -+m[6]/2 : attachment.ownAnchor.includes('east') ? +m[6]/2 : 0;
				attachment.dy += attachment.ownAnchor.includes('north') ? +m[7]/2 : attachment.ownAnchor.includes('south') ? -+m[7]/2 : 0;
			}
			const o = opts(m[1]), value = (key: string) => o.find(v => v.startsWith(key + '='))?.slice(key.length + 1) || '';
			lines.push({t: 'node', n: {id: m[2], attachment, kind: 'icon', icon: m[5], x: +m[3], y: +m[4], width: +m[6], minh: +m[7], title: value('pic text').slice(1, -1), code: '', cat: '', layer: value('sg layer'), group: value('sg in'), hidden: !!hidden || o.includes('sg hidden'), locked: o.includes('sg locked'), ...readStyle(o.filter(v => !/^(?:pic text|anchor|sg layer|sg in)=/.test(v) && v !== 'sg locked' && v !== 'sg hidden'))}});
			if (o.includes('sg hidden')) { individuallyHidden.add(m[2]); }
			continue;
		}
		m = NODE.exec(line);
		if (m) {
			const o = opts(m[1]);
			if (o.includes('sg hidden')) { individuallyHidden.add(m[2]); }
			const styleOpt = o.find(x => x.startsWith('sg style/') || x.startsWith('cat-'));
				const cat = styleOpt ? styleOpt.slice(styleOpt.startsWith('cat-') ? 4 : 9) : '';
				const isLabel = o.includes('sg label') || labelKeys.has(cat);
			const w = o.find(x => /^text width\s*=/.test(x));
			const h = o.find(x => /^minimum height\s*=/.test(x));
			const layer = o.find(x => /^sg layer\s*=/.test(x));
			const g = o.find(x => /^sg in\s*=/.test(x));
			let content = /^\\sgcontent\{[\w-]+\}\{[\d.]+\}\{([\s\S]*)\}$/.exec(m[5])?.[1] ?? m[5];
			const positioned = /^\\parbox\[c\]\[([\d.]+)mm\]\[([tcb])\]\{[\d.]+mm\}\{\\(raggedright|centering|raggedleft) ([\s\S]*)\}$/.exec(content);
			let titlePosition: string | undefined;
			if (positioned) {
				const vertical = {t:'north',c:'',b:'south'}[positioned[2]];
				const horizontal = {raggedright:'west',centering:'',raggedleft:'east'}[positioned[3]];
				titlePosition = [vertical,horizontal].filter(Boolean).join(' ') || 'center'; content = positioned[4];
			}
			const code = CODE.exec(content);
			const title = code ? content.slice(0, code.index) : content;
			const icon = /^\\sgicon\{([\w-]+)\}\\ /.exec(title);
			lines.push({
				t: 'node', n: {
					id: m[2], attachment, titlePosition, kind: isLabel ? 'label' : undefined, cat, x: +m[3], y: +m[4],
					title: icon ? title.slice(icon[0].length) : title, icon: o.find(x => x.startsWith('sg icon='))?.slice(8) || icon?.[1], iconPosition: o.find(x => x.startsWith('sg icon position='))?.slice(17),
					code: code ? code[1] : '',
                    wantWidth: o.some(x=>x.startsWith('sg want=')) ? +o.find(x=>x.startsWith('sg want='))!.slice(8) : undefined,
                    codeFont: o.find(x=>x.startsWith('sg code font='))?.slice(13),
					width: w ? parseFloat(w.split('=')[1]) : DEFAULT_WIDTH,
					minh: h ? parseFloat(h.split('=')[1]) : 0,
					layer: layer ? layer.split('=')[1].trim() : '', group: g ? g.split('=')[1].trim() : '', hidden: o.includes('sg hidden') || !!hidden, locked: o.includes('sg locked'),
					...readStyle(o.filter(x => !x.startsWith('sg want=') && !x.startsWith('sg code font=') && !x.startsWith('sg icon') && x !== styleOpt && x !== 'sg box' && x !== 'sg label' && !x.startsWith('sg label height=') && !(o.includes('sg compact') && /^(text height|text depth)=/.test(x)) && !(isLabel && x === 'draw=black!38') && !(attachment && x === `anchor=${attachment.ownAnchor}`) && x !== w && x !== h && x !== g && x !== layer && x !== 'sg hidden' && x !== 'sg locked'), false, !!cat),
				},
			});
			continue;
		}
		m = GROUP.exec(line);
		if (m) {
			lines.push({ t: 'group', g: { id: m[1], name: m[2], frame: m[3], color: m[4], parent: m[5] ?? '', ...readGroup(m[6]) } });
			continue;
		}
		m = ARROWSFLAG.exec(line);
		if (m) {
			lines.push({ t: 'arrowsflag', style: m[1] });
			continue;
		}
		m = EDGE.exec(line);
		const e = m && parsePath(opts(m[1]), m[2]);
		if (e) {
			lines.push({ t: 'edge', e });
			continue;
		}
		lines.push({ t: 'raw', text: line });
	}
	const fig = { lines };
 for(const n of nodes(fig)) if(n.kind==='label' && n.style?.step) n.title=n.title.startsWith('\\sglabel{') ? n.title.replace(/^\\sglabel\{[^}]*\}\{/, '').slice(0,-1) : n.title.replace(/^\\sgstep\{[^}]*\}(?:\\ )?/, '');
	for (const n of nodes(fig)) {
		if (nodeLayer(fig, n).hidden) { n.hidden = individuallyHidden.has(n.id); }
	}
	for (const n of nodes(fig)) normalizeWidth(fig,n);
	resolveAttachments(fig);
	settle(fig);
	return fig;
}

// The path of an arrow: coordinates in parentheses, operators between them, at most one label node.
function parsePath(o: string[], path: string): FigEdge | null {
 const labelStart=/node\[[^\]]*\]\s*\{/.exec(path);
 let label: string | undefined, routePath=path;
 if(labelStart) {
  let depth=1,i=labelStart.index+labelStart[0].length;
  for(;i<path.length && depth;i++) { let slashes=0;for(let j=i-1;j>=0 && path[j]==='\\';j--) slashes++;if(slashes%2) continue; if(path[i]==='{') depth++; if(path[i]==='}') depth--; }
  label=path.slice(labelStart.index,i); routePath=path.slice(0,labelStart.index)+path.slice(i);
 }
 while(/node\[[^\]]*\]\s*\{/.test(routePath)) { const m=/node\[[^\]]*\]\s*\{/.exec(routePath)!; let d=1,i=m.index+m[0].length; for(;i<routePath.length && d;i++) { if(routePath[i-1]==='\\') continue; if(routePath[i]==='{') d++; if(routePath[i]==='}') d--; } routePath=routePath.slice(0,m.index)+routePath.slice(i); }
 const tokens=routePath.match(/\([^()]*\)|--|-\||\|-|to\[[^\]]*\]/g);
 if(!tokens) return null;
 const coords=tokens.filter(t=>t.startsWith('('));
 const ops=tokens.filter(t=>!t.startsWith('('));
	const ids = (c: string) => c.slice(1, -1).replace(/^\[[^\]]*\]/,'').split(/-\||\|-/).map(p => p.trim().split('.')[0]).filter(p => /^[A-Za-z_][\w-]*$/.test(p));
	if (coords.length < 2 || !ids(coords[0]).length || !ids(coords[coords.length - 1]).length) {
		return null;
	}
	const from = ids(coords[0])[0], to = ids(coords[coords.length - 1]).slice(-1)[0];
 const endpointAnchor = (c: string) => /-\||\|-/.test(c) ? undefined : /\.(north west|north east|south west|south east|north|south|east|west|center)(?=\s|\))/.exec(c)?.[1];
	const styleOpt = o.find(x => x.startsWith('sg style/'));
	const kind = o.find(x => (ARROWS as readonly string[]).includes(x)) ?? 'arr';
	const head = o.includes('head both') ? 'both' : o.includes('head none') ? 'none' : 'end';
	const e: FigEdge = {
		...(styleOpt ? {styleKey: styleOpt.slice(9)} : {}), from, to, fromAnchor:endpointAnchor(coords[0]), toAnchor:endpointAnchor(coords[coords.length-1]), kind, route: 'auto', mid: null, bend: 0, head,
		label: label ? label.replace(/^node\[[^\]]*\]\s*\{/, '').slice(0, -1) : '',
		...readStyle(o.filter(x => x !== kind && x !== styleOpt && x !== 'head both' && x !== 'head none' && !MARKERS.includes(x) && !/^sg (lane|route|mid|bend)=/.test(x) && !/^sg implicit /.test(x) && !x.startsWith('sg labels=')), true, !!styleOpt),
	};
 const meta=o.find(x=>x.startsWith('sg labels=')); if(meta) { const data=JSON.parse(Buffer.from(meta.slice(10),'hex').toString()); e.labelStyle=data.style; e.labels=data.labels;if(data.text!==undefined)e.label=data.text; }
	if (label) { e.style = { ...e.style, ...(/near start/.test(label) ? {position:'start'} : /near end/.test(label) ? {position:'end'} : {}), ...(!e.labelStyle?.side && /, above/.test(label) ? {side:'above'} : !e.labelStyle?.side && /, below/.test(label) ? {side:'below'} : !e.labelStyle?.side && /, left/.test(label) ? {side:'left'} : !e.labelStyle?.side && /, right/.test(label) ? {side:'right'} : {}) }; }
	const lane = o.find(v => v.startsWith('sg lane=')); if (lane) { e.lane = +lane.slice(8); }
 const routeMeta = o.find(v => v.startsWith('sg route='));
 const offset=(c:string)=>{if(/xshift=.*yshift=/.test(c))return undefined;const m=/[xy]shift=(-?[\d.]+)mm/.exec(c);return m ? +m[1] : undefined;};
 e.fromOffset=offset(coords[0]);e.toOffset=offset(coords[coords.length-1]);
 let parsedPath=false;
 const loop=/to\[([^\]]*(?:out=|loop )[^\]]*)\]/.exec(routePath);
 if(from===to && loop){
  const opts=loop[1],value=(name:string)=>{const m=new RegExp('(?:^|,\\s*)'+name+'=(-?[\\d.]+)(?:mm)?').exec(opts);return m ? +m[1] : undefined;};
  e.route='loop';e.loopOut=value('out');e.loopIn=value('in');e.loopSize=value('min distance') ?? 8;e.looseness=value('looseness');e.loopMax=value('max distance');
  const angle=e.loopOut ?? 90;e.loopSide=e.fromAnchor || (angle>=45&&angle<135?'north':angle>=135&&angle<225?'west':angle>=225&&angle<315?'south':'east');
  parsedPath=true;
 }
 if(o.includes('sg fixed') && !routeMeta && !ops.some(op=>op.startsWith('to')) && !(coords.length===3 && ops[1]==='--' && /^\(-?[\d.]+,-?[\d.]+\)$/.test(coords[1]) && !e.fromAnchor && !e.toAnchor)){e.route='fixed';e.chain=tokens;parsedPath=true;}

 if(meta){const data=JSON.parse(Buffer.from(meta.slice(10),'hex').toString());if(data.legacySide)e.style={...e.style,side:data.legacySide};if(data.legacyPosition)e.style={...e.style,position:data.legacyPosition};}
 if (e.style?.step) { if(e.label.startsWith('\\sglabel{')) e.label=e.label.replace(/^\\sglabel\{[^}]*\}\{/, '').slice(0,-1); e.label=e.label.replace(/^\\sgstep\{[^}]*\}(?:\\ )?/, ''); if(e.label.startsWith('\\shortstack{') && e.label.endsWith('}')) e.label=e.label.slice(12,-1); }
 if(parsedPath)return e;
 if (routeMeta) { for(const end of ['from','to'] as const){const key='sg implicit '+end,implicit=o.find(x=>x===key || x.startsWith(key+'='));if(implicit){if(implicit===key)delete e[end==='from'?'fromAnchor':'toAnchor'];else e[end==='from'?'fromAnchor':'toAnchor']=implicit.slice(key.length+1);delete e[end==='from'?'fromOffset':'toOffset'];}} e.route=routeMeta.slice(9); const mid=o.find(v=>v.startsWith('sg mid=')), bend=o.find(v=>v.startsWith('sg bend=')); if(mid) e.mid=+mid.slice(7); if(bend) e.bend=+bend.slice(8); return e; }

 const marker = o.find(x => MARKERS.includes(x));
	if (marker && marker !== 'sg fixed') {
		e.route = marker.slice(3);
	} else if (marker === 'sg fixed') {
		const xy = coords.length === 3 ? coords[1].slice(1, -1).split(',').map(Number) : null;
		if (ops[0] === '-|') {
			e.route = 'hvh';
			e.mid = xy ? xy[0] : null;
		} else if (ops[0] === '|-') {
			e.route = 'vhv';
			e.mid = xy ? xy[1] : null;
		} else if (ops[0]?.startsWith('to')) {
			const a = /bend (left|right)(?:=(-?[\d.]+))?/.exec(ops[0]);
			e.route = 'bend';
			e.bend = (a && a[2] ? +a[2] : 30) * (a && a[1] === 'right' ? -1 : 1);
		} else {
			e.route = 'straight';
		}
	}
	return e;
}

const num = (v: number) => String(Math.round(v * 100) / 100);

export const nodes = (fig: Figure) => fig.lines.flatMap(l => l.t === 'node' ? [l.n] : []);
export const edges = (fig: Figure) => fig.lines.flatMap(l => l.t === 'edge' ? [l.e] : []);
export const groups = (fig: Figure) => fig.lines.flatMap(l => l.t === 'group' ? [l.g] : []);
export const layers = (fig: Figure): Layer[] => {
	const ls = fig.lines.flatMap(l => l.t === 'layer' ? [l.layer] : []);
	return ls.length ? ls : [{ id: 'layer1', name: 'Layer 1', hidden: false, locked: false }];
};
export const nodeLayer = (fig: Figure, n: FigNode) => layers(fig).find(l => l.id === n.layer) ?? layers(fig)[0];
export const isHidden = (fig: Figure, n: FigNode) => n.hidden || nodeLayer(fig, n).hidden;
export const isLocked = (fig: Figure, n: FigNode) => n.locked || nodeLayer(fig, n).locked;
function groupMembers(fig: Figure, id: string): FigNode[] {
	return nodes(fig).filter(n => {
		let parent = n.group; const seen = new Set<string>();
		while (parent && !seen.has(parent)) {
			if (parent === id) { return true; }
			seen.add(parent); parent = groups(fig).find(g => g.id === parent)?.parent ?? '';
		}
		return false;
	});
}
function materializeLayers(fig: Figure) {
	if (!fig.lines.some(l => l.t === 'layer')) { insert(fig, { t: 'layer', layer: { ...layers(fig)[0] } }); }
	for (const n of nodes(fig)) { n.layer = nodeLayer(fig, n).id; }
}
export const legendOn = (fig: Figure) => fig.lines.every(l => l.t !== 'legendflag' || l.on);
export const arrowStyle = (fig: Figure) => {
	const f = fig.lines.find(l => l.t === 'arrowsflag');
	return f && f.t === 'arrowsflag' ? f.style : 'manhattan';
};

// Content width and wrapped geometry shared with the canvas.
function normalizeWidth(fig: Figure,n: FigNode): void {
 const effective={...n,icon:nodeIcon(fig,n)};textGeometry.normalize(effective,fontSize(fig));
 n.width=effective.width;
 if(effective.wantWidth===undefined)delete n.wantWidth;else n.wantWidth=effective.wantWidth;
 if(effective.codeFont===undefined)delete n.codeFont;else n.codeFont=effective.codeFont;
}

export function boxHalf(n: FigNode): [number, number] {
 const {w,h}=textGeometry.layout(n);return [w/2,h/2];
}

// The shape an arrow gets. Manhattan: a straight vertical or horizontal line where the boxes face
// each other, otherwise one jog in the middle.
export function resolveRoute(e: FigEdge, a: FigNode, b: FigNode, style: string): { type: string; mid?: number | null; at?: string; bend?: number } {
	let route = e.route === 'auto' ? style : e.route;
	if (route === 'straight') {
		return { type: 'line' };
	}
	if (route === 'curved') {
		return { type: 'bend', bend: 20 };
	}
	if (route === 'hvh' || route === 'vhv') {
		return { type: route, mid: e.mid };
	}
	if (route === 'bend') {
		return { type: 'bend', bend: e.bend };
	}
	const [aw, ah] = boxHalf(a), [bw, bh] = boxHalf(b);
	const dx = b.x - a.x, dy = b.y - a.y;
	const xOverlap = Math.abs(dx) < aw + bw - 1, yOverlap = Math.abs(dy) < ah + bh - 1;
	if (xOverlap && !yOverlap) {
		if (Math.abs(dx) < 0.05) { return { type: 'line' }; }
		if (Math.abs(dx) <= aw - 1) { return { type: 'vert', at: 'b' }; }
		if (Math.abs(dx) <= bw - 1) { return { type: 'vert', at: 'a' }; }
		return { type: 'vhv', mid: Math.round((a.y + b.y) / 2 * 10) / 10 };
	}
	if (yOverlap && !xOverlap) {
		if (Math.abs(dy) < 0.05) { return { type: 'line' }; }
		if (Math.abs(dy) <= ah - 1) { return { type: 'horz', at: 'b' }; }
		if (Math.abs(dy) <= bh - 1) { return { type: 'horz', at: 'a' }; }
		return { type: 'hvh', mid: Math.round((a.x + b.x) / 2 * 10) / 10 };
	}
	if (Math.abs(dy) >= Math.abs(dx)) {
		return { type: 'vhv', mid: Math.round((a.y + b.y) / 2 * 10) / 10 };
	}
	return { type: 'hvh', mid: Math.round((a.x + b.x) / 2 * 10) / 10 };
}

function fill(color: string): string {
	if (/^#[0-9a-f]{6}$/i.test(color)) { return 'sgc'+color.slice(1).toUpperCase(); }
	if (color === 'black!25') { return color; }
	const p = PALETTE[color] ?? PALETTE.white;
	return p.mix === 100 ? p.name : `${p.name}!${p.mix}`;
}

function nodeIcon(fig: Figure, n: FigNode): string | undefined {
 const c = categories(fig).find(c => c.key === n.cat);
 return n.icon === 'none' ? undefined : n.icon === 'category' || (!n.icon && c?.boxes) ? c?.icon : n.icon;
}

export function anchorPoint(n: FigNode, anchor: string): [number, number] {
 const [w,h] = boxHalf(n);
 return [n.x + (anchor.includes('west') ? -w : anchor.includes('east') ? w : 0), n.y + (anchor.includes('north') ? h : anchor.includes('south') ? -h : 0)];
}
export function resolveAttachments(fig: Figure) {
 const done = new Set<string>(), visiting = new Set<string>();
 const visit = (n: FigNode) => {
  if (done.has(n.id) || visiting.has(n.id)) { return; }
  visiting.add(n.id);
  const a = n.attachment, parent = a && nodes(fig).find(p => p.id === a.parent && !p.kind);
  if (a && parent && !visiting.has(parent.id)) {
   visit(parent);
   const sized = (o: FigNode) => ({...o, icon:nodeIcon(fig,o), style:{...o.style,font:o.style?.font || fontSize(fig)}});
   const [px,py] = anchorPoint(sized(parent),a.anchor), [ox,oy] = anchorPoint({...sized(n),x:0,y:0},a.ownAnchor);
   n.x = px + a.dx - ox; n.y = py + a.dy - oy;
  }
  visiting.delete(n.id); done.add(n.id);
 };
 nodes(fig).forEach(visit);
}
function coordinate(n: FigNode): string {
 const a = n.attachment;
 const [ox,oy] = a && n.kind === 'icon' ? anchorPoint({...n,x:0,y:0},a.ownAnchor) : [0,0];
 return a ? `([shift={(${num(a.dx-ox)}mm,${num(a.dy-oy)}mm)}]${a.parent}.${a.anchor})` : `(${num(n.x)},${num(n.y)})`;
}

function nodeLine(n: FigNode, figureFont = 'small', hasIcon = !!n.icon, layerOpacity = 1, fig?: Figure): string {
	if (n.kind === 'icon') {
		const o = [`pic text={${n.title}}`, ...(n.attachment ? [`anchor=${n.attachment.ownAnchor}`] : []), ...(n.layer ? [`sg layer=${n.layer}`] : []), ...(n.group ? [`sg in=${n.group}`] : []), ...(n.locked ? ['sg locked'] : []), ...opacityOptions(n.style?.opacity,layerOpacity), ...n.extra];
		const line = `\\pic[${o.join(', ')}] (${n.id}) at ${coordinate(n)} {sg object={${n.icon || ''}}{${num(n.width)}}{${num(n.minh || n.width)}}};`;
		return n.hidden ? `% sakuga hidden ${line}` : line;
	}
	const def = fig && n.cat && nodeStyleKind(n) ? findStyle(fig, n.cat, nodeStyleKind(n)!) : undefined;
	const own: ObjectStyle | undefined = def ? overrideOf(def.kind, n.style || {}, def.props) : n.style;
	const o = [n.cat ? `sg style/${n.cat}` : n.kind === 'label' ? 'sg label' : 'sg box'];
	if (n.kind === 'label') { o.push(`sg label height=${boxHalf({...n,style:{...n.style,font:n.style?.font || figureFont}})[1]*2}`); }
	if (n.kind === 'label' && own?.border && own.border !== 'none') { o.push('draw=black!38'); }
	if (n.attachment && n.kind !== 'icon') { o.push(`anchor=${n.attachment.ownAnchor}`); }
	if(n.wantWidth !== undefined && n.wantWidth !== n.width) o.push(`sg want=${n.wantWidth}`);
    if(n.codeFont && n.codeFont !== smallerFont(n.style?.font || figureFont)) o.push(`sg code font=${n.codeFont}`);
	if (n.width !== DEFAULT_WIDTH) {
		o.push(`text width=${n.width}mm`);
	}
	if (n.minh > 0) {
		o.push(`minimum height=${num(n.minh)}mm`);
	}
	if (n.layer) { o.push(`sg layer=${n.layer}`); }
	if (n.group) {
		o.push(`sg in=${n.group}`);
	}
	if (n.locked) {
		o.push('sg locked');
	}
	if (n.icon) { o.push(`sg icon=${n.icon}`); }
	if (hasIcon) { o.push(`sg icon height=${num(boxHalf({...n,icon:'active',style:{...n.style,shape:'',font:n.style?.font || figureFont}})[1] * 2 - 0.45 * 25.4 / 72.27)}`); }
	if (n.iconPosition) { o.push(`sg icon position=${n.iconPosition}`); }
	if(n.style?.compact){const body=(boxHalf({...n,style:{...n.style,font:n.style?.font || figureFont}})[1]*2-2*25.4/72.27)/(25.4/72.27);o.push(`text height=${body*.6}pt`,`text depth=${body*.4}pt`);}
	const title = n.kind==='label' && n.style?.step ? `\\sglabel{${n.style.step}}{${n.title}}` : n.title;
	let content = n.code ? `${title}\\\\[-1pt]\\sgcode{${n.code}}` : title;
	if (n.titlePosition && n.titlePosition !== 'center') {
	 const pos = n.titlePosition, h = boxHalf({...n,icon:undefined,style:{...n.style,shape:'',font:n.style?.font || figureFont}})[1]*2 - 7.45*25.4/72.27;
	 content = `\\parbox[c][${num(h)}mm][${pos.includes('north') ? 't' : pos.includes('south') ? 'b' : 'c'}]{${num(n.width)}mm}{\\${pos.includes('west') ? 'raggedright' : pos.includes('east') ? 'raggedleft' : 'centering'} ${content}}`;
	}
	const label = hasIcon ? `\\sgcontent{${n.iconPosition || 'left'}}{${n.width}}{${content}}` : content;
	const line = `\\node[${[...o, ...styleOptions(own, false, boxHalf({...n, style: {...n.style, font: n.style?.font || figureFont}})[1] * 2, { thin: !!def && (def.props.lineWidth !== undefined || (!!def.props.weight && def.props.weight !== 'thin')), redraw: !!def && def.kind === 'box' && def.props.border === 'none' }), ...opacityOptions(n.style?.opacity,layerOpacity), ...n.extra].join(', ')}] (${n.id}) at ${coordinate(n)} {${label}};`;
	return n.hidden ? `% sakuga hidden ${line}` : line;
}

function hiddenReference(fig: Figure, n: FigNode): string[] {
	if (!isHidden(fig,n)) { return []; }
	const descendants = (id: string, seen = new Set<string>()): boolean => {
		if (seen.has(id)) { return false; } seen.add(id);
		return nodes(fig).some(child => child.attachment?.parent === id && (!isHidden(fig,child) || descendants(child.id,seen)));
	};
	if (!descendants(n.id)) { return []; }
	return ['% sakuga icons begin (generated anchor for hidden parent)',
		nodeLine({...n,hidden:false,extra:[...n.extra,'opacity=0','overlay']},fontSize(fig),!!nodeIcon(fig,n),1,fig),
		'% sakuga icons end'];
}

function attachedIcons(fig: Figure, objects = nodes(fig)): string[] {
	const out = ['% sakuga icons begin (generated)'];
	for (const n of objects) {
		if (!nodeIcon(fig,n) || n.kind === 'icon' || isHidden(fig, n)) { continue; }
		const name = nodeIcon(fig,n);
		if (!name) { continue; }
		const p = n.iconPosition || 'left';
		const anchor = ({left:'west',right:'east',above:'north',nw:'north west',ne:'north east',sw:'south west',se:'south east'} as Record<string,string>)[p] || 'west';
		const x = ['right','ne','se'].includes(p) ? -4 : p === 'above' ? -1.5 : 1;
		const y = ['above','nw','ne'].includes(p) ? -1 : ['sw','se'].includes(p) ? 4 : 1.5;
		out.push(`\\pic${nodeOpacity(fig,n) !== 1 ? `[${opacityOptions(nodeOpacity(fig,n)).join(', ')}]` : ''} at ([xshift=${x}mm,yshift=${y}mm]${n.id}.${anchor}) {sg icon/${name}};`);
	}
	out.push('% sakuga icons end');
	return out;
}

export function routeObjects(fig: Figure): any[] {
 const ns = nodes(fig).map(n => { const [w,h]=boxHalf({...n,icon:nodeIcon(fig,n),style:{...n.style,font:n.style?.font || fontSize(fig)}}); return {...n,w:w*2,h:h*2,hidden:isHidden(fig,n)}; });
 return [...ns,...groups(fig).filter(g=>g.frame!=='none' || edges(fig).some(e=>e.from===g.id||e.to===g.id)).map(g=>routing.bounds(g.id,ns,groups(fig),new Set(),edges(fig))).filter(Boolean)];
}
export function specialGeometry(fig: Figure, e: FigEdge): any {
 if (!['auto','manhattan','fixed','loop'].includes(e.route) && e.from!==e.to && !e.labelStyle && !e.labels?.length && !e.fromAnchor && !e.toAnchor && !groups(fig).some(g=>g.id===e.from||g.id===e.to) && !routing.lane(e,edges(fig)) && e.route!=='u') return null;
 const objects=routeObjects(fig);
 const a=objects.find(n=>n.id===e.from),b=objects.find(n=>n.id===e.to);
 if(!['auto','manhattan','fixed','loop'].includes(e.route) && e.from!==e.to && !e.fromAnchor && !e.toAnchor && !a?.frame && !b?.frame && !routing.lane(e,edges(fig)) && e.route!=='u') return routing.legacyGeometry(e,a,b,arrowStyle(fig));
 const prior=edges(fig).slice(0,edges(fig).indexOf(e)).map(o=>{const x=objects.find(n=>n.id===o.from),y=objects.find(n=>n.id===o.to);return x&&y ? routing.geometry(o,x,y,edges(fig),arrowStyle(fig),objects)?.pts : null;}).filter(Boolean);
 return routing.geometry(e,a,b,edges(fig),arrowStyle(fig),objects,prior);
}
function edgeLine(fig: Figure, e: FigEdge): string {
	const edef = styleOf(fig, e);
	const eown: ObjectStyle | undefined = edef ? overrideOf('arrow', e.style || {}, edef.props) : e.style;
	const o = [e.styleKey ? `sg style/${e.styleKey}` : e.kind];
 const labelData={...(Object.keys(cleanLabel(e.labelStyle)).length ? {style:cleanLabel(e.labelStyle)} : {}),...(e.labels?.length ? {labels:e.labels.map(l=>({...l,style:cleanLabel(l.style)}))} : {})};
 if(e.labels?.length) (labelData as any).text=e.label;
 if(e.labelStyle || e.labels?.length){if(e.style?.side)(labelData as any).legacySide=e.style.side;if(e.style?.position)(labelData as any).legacyPosition=e.style.position;}
 if(Object.keys(labelData).length) o.push('sg labels='+Buffer.from(JSON.stringify(labelData)).toString('hex'));
 if(!e.label) {if(e.style?.side) o.push(`sg label side=${e.style.side}`);if(e.style?.position) o.push(`sg label position=${e.style.position}`);}
	if (e.head !== 'end') {
		o.push(`head ${e.head}`);
	}
	if(e.from===e.to){o.push('sg fixed');}
 else if (e.route === 'straight' || e.route === 'manhattan' || e.route === 'curved') {
		o.push(`sg ${e.route}`);
	} else if (e.route !== 'auto') {
		o.push('sg fixed');
	}
	const a = nodes(fig).find(n => n.id === e.from), b = nodes(fig).find(n => n.id === e.to);
	const r = a && b ? resolveRoute(e, {...a,icon:nodeIcon(fig,a),style:{...a.style,font:a.style?.font || fontSize(fig)}}, {...b,icon:nodeIcon(fig,b),style:{...b.style,font:b.style?.font || fontSize(fig)}}, arrowStyle(fig)) : { type: 'line' };
	const content = e.style?.step && e.label ? `\\sglabel{${e.style.step}}{${e.label}}` : e.style?.step ? `\\sgstep{${e.style.step}}` : e.label;
 const lbl = (pos: string, extras=true) => content ? ` node[sg elabel${e.labelStyle ? '' : e.label && e.style?.position ? ', near '+e.style.position : pos}${e.label && e.style?.side && !e.labelStyle?.side ? ', '+e.style.side : ''}${labelMetrics(e.label,e.labelStyle,fontSize(fig),e.style?.step)}${labelOptions(e.labelStyle,{font:fontSize(fig),color:e.style?.color || '',pos:e.style?.position==='start' ? .25 : e.style?.position==='end' ? .75 : undefined})}] {${content}}${(extras ? e.labels || [] : []).map(l=>` node[sg elabel${labelMetrics(l.text,l.style,fontSize(fig))}${labelOptions(l.style,{font:fontSize(fig),color:e.style?.color || '',side:e.style?.side,pos:e.style?.position==='start' ? .25 : e.style?.position==='end' ? .75 : undefined})}] {${l.text}}`).join('')}` : (e.labels || []).map(l=>` node[sg elabel${labelMetrics(l.text,l.style,fontSize(fig))}${labelOptions(l.style,{font:fontSize(fig),color:e.style?.color || '',side:e.style?.side,pos:e.style?.position==='start' ? .25 : e.style?.position==='end' ? .75 : undefined})}] {${l.text}}`).join('');
	const A = a?.kind === 'icon' ? e.from + '-center' : e.from, B = b?.kind === 'icon' ? e.to + '-center' : e.to;
	let path: string;
 const G = specialGeometry(fig,e);
 if (e.lane !== undefined) o.push(`sg lane=${e.lane}`);
 if(G && (G.rule || G.loop || G.fixed)) {
  const objects=routeObjects(fig),aa=objects.find(n=>n.id===e.from),bb=objects.find(n=>n.id===e.to);
  const inferred=(n:any,p:number[],other:any)=>Math.abs(p[0]-(n.x+n.w/2))<.001?'east':Math.abs(p[0]-(n.x-n.w/2))<.001?'west':p[1]>=n.y?'north':'south';
  const sa=G.sa || e.fromAnchor || inferred(aa,G.pts[0],bb),sb=G.sb || e.toAnchor || inferred(bb,G.pts[G.pts.length-1],aa);
  let start=routing.portText(aa,sa,G.pts[0]),stop=routing.portText(bb,sb,G.pts[G.pts.length-1]);
  const zero=(id:string,side:string)=>`([${/north|south/.test(side)?'x':'y'}shift=0mm]${id}.${side})`;if(e.fromOffset===0)start=zero(A,sa);if(e.toOffset===0)stop=zero(B,sb);
  if(G.loop){
   if(/circle|ellipse/.test(aa.style?.shape)){start=`(${A}.${num(G.out)})`;stop=`(${A}.${num(G.inn)})`;}
   const options=[`out=${G.out}`,`in=${G.inn}`,`min distance=${e.loopSize ?? 8}mm`,...(e.looseness!==undefined && e.looseness!==1?[`looseness=${e.looseness}`]:[]),...(e.loopMax!==undefined?[`max distance=${e.loopMax}mm`]:[])];
   path=`${start} to[${options.join(',')}]${lbl(e.style?.side || e.labelStyle?.side ? '' : ', '+(({north:'above',south:'below',east:'right',west:'left'} as Record<string,string>)[G.side] || 'above'))} ${stop}`;
  }else{
   if(!G.fixed){o.push(`sg route=${e.route}`);if(!e.fromAnchor)o.push('sg implicit from');else if(e.fromOffset===undefined)o.push('sg implicit from='+e.fromAnchor);if(!e.toAnchor)o.push('sg implicit to');else if(e.toOffset===undefined)o.push('sg implicit to='+e.toAnchor);if(e.mid!==null)o.push(`sg mid=${e.mid}`);if(e.bend)o.push(`sg bend=${e.bend}`);}
   const segment=(st:LabelStyle | undefined)=>Math.max(0,Math.min(G.pts.length-2,st?.segment ?? (e.style?.position==='start'?0:e.style?.position==='end'?G.pts.length-2:G.pts.length===4?1:0)));
   const labels=(i:number)=>(segment(e.labelStyle)===i?lbl('',false):'')+(e.labels || []).filter(l=>segment(l.style)===i).map(l=>` node[sg elabel${labelMetrics(l.text,l.style,fontSize(fig))}${labelOptions(l.style,{font:fontSize(fig),color:e.style?.color || '',side:e.style?.side})}] {${l.text}}`).join('');
   path=routing.polyline(G.pts,start,stop,(content || e.labels?.length)?labels:'',!!G.rule && !e.toAnchor);
  }
 } else if (G) {
  o.push(`sg route=${e.route}`); if(!e.fromAnchor) o.push('sg implicit from'); if(!e.toAnchor) o.push('sg implicit to'); if(e.mid !== null) o.push(`sg mid=${e.mid}`); if(e.bend) o.push(`sg bend=${e.bend}`);
  const objects=routeObjects(fig), end=(id: string, anchor: string | undefined, p: number[]) => {
   const n=objects.find(n=>n.id===id), c=anchor ? routing.point(n,anchor,n) : [n.x,n.y];
   const offset=id===e.from?e.fromOffset:e.toOffset;
   if(offset!==undefined && /^(north|south|east|west)$/.test(anchor || '')){const text=routing.portText(n,anchor,p);return offset===0 && !text.includes('shift')?`([${/north|south/.test(anchor!)?'x':'y'}shift=0mm]${id}.${anchor})`:text;}
   return `([xshift=${p[0]-c[0]}mm,yshift=${p[1]-c[1]}mm]${id}${anchor ? '.'+anchor : '.center'})`;
  };
  const points=G.curve || G.pts, start=end(e.from,e.fromAnchor,points[0]), stop=end(e.to,e.toAnchor,points[points.length-1]);
  const segment=(st:LabelStyle | undefined) => Math.max(0,Math.min(points.length-2,st?.segment ?? (e.style?.position==='start' ? 0 : e.style?.position==='end' ? points.length-2 : points.length===4 ? 1 : 0)));
  const at=(i:number) => {
   const primary=segment(e.labelStyle)===i && content ? lbl('',false) : '';
   const extras=(e.labels || []).filter(l=>segment(l.style)===i).map(l=>` node[sg elabel${labelMetrics(l.text,l.style,fontSize(fig))}${labelOptions(l.style,{font:fontSize(fig),color:e.style?.color || '',side:e.style?.side,pos:e.style?.position==='start' ? .25 : e.style?.position==='end' ? .75 : undefined})}] {${l.text}}`).join('');
   return primary+extras;
  };
  path=G.curve ? `${start} .. controls (${points[1]}) and (${points[2]}) ..${lbl('')} ${stop}` : points.map((p: number[],i: number)=>i===0 ? start : ` --${at(i-1)} ${i===points.length-1 ? stop : '('+p.join(',')+')'}`).join('');

 } else if (r.type === 'vert' && a && b) {
		const side = b.y < a.y ? 'south' : 'north', bside = b.y < a.y ? 'north' : 'south';
		path = r.at === 'b' ? `(${A}.${side} -| ${B}) --${lbl('')} (${B})` : `(${A}) --${lbl('')} (${A} |- ${B}.${bside})`;
	} else if (r.type === 'horz' && a && b) {
		const side = b.x > a.x ? 'east' : 'west', bside = b.x > a.x ? 'west' : 'east';
		path = r.at === 'b' ? `(${A}.${side} |- ${B}) --${lbl('')} (${B})` : `(${A}) --${lbl('')} (${A} -| ${B}.${bside})`;
	} else if (r.type === 'hvh' && b) {
		path = r.mid === null || r.mid === undefined
			? `(${A}) -|${lbl(', pos=0.25')} (${B})`
			: `(${A}) -|${lbl(', pos=0.75')} (${num(r.mid)},${num(b.y)}) -- (${B})`;
	} else if (r.type === 'vhv' && b) {
		path = r.mid === null || r.mid === undefined
			? `(${A}) |-${lbl(', pos=0.25')} (${B})`
			: `(${A}) |-${lbl(', pos=0.75')} (${num(b.x)},${num(r.mid)}) -- (${B})`;
	} else if (r.type === 'bend') {
		const d = r.bend ?? 20;
		path = `(${A}) to[bend ${d >= 0 ? 'left' : 'right'}=${num(Math.abs(d))}]${lbl('')} (${B})`;
	} else {
		path = `(${A}) --${lbl('')} (${B})`;
	}
	return `\\draw[${[...o, ...styleOptions(eown && (eown.start || eown.end || eown.tipLength !== undefined || eown.tipWidth !== undefined) ? { ...eown, start: eown.start || (e.head === 'both' ? 'Latex' : 'none'), end: eown.end || (e.head === 'none' ? 'none' : 'Latex') } : eown, true), ...opacityOptions(e.style?.opacity,edgeLayerOpacity(fig,e)), ...e.extra].join(', ')}] ${path};`;
}

function iconCode(fig: Figure): string[] {
	const usedCats = new Set(nodes(fig).map(n => n.cat));
	const used = new Set([...nodes(fig).map(n => nodeIcon(fig,n)), ...categories(fig).filter(c => legendOn(fig) && usedCats.has(c.key)).map(c => c.icon)].filter(Boolean));
	if (!used.size && !nodes(fig).some(n=>n.kind === 'icon')) { return []; }
	return [
		String.raw`\tikzset{sg icon stroke/.style={draw=black!60,line width=0.6pt,line cap=round,line join=round}}`,
		String.raw`\tikzset{pics/sg object/.style n args={3}{code={\path (-#2/2,-#3/2) rectangle (#2/2,#3/2);\node[anchor=center,inner sep=0pt,outer sep=0pt,minimum width=#2mm,minimum height=#3mm] (-center) at (0,0) {};\if\relax\detokenize{#1}\relax\else\pic[xscale=#2/3,yscale=#3/3] at (-#2/2,#3/2) {sg icon/#1};\fi\node[anchor=west,inner sep=0pt,align=left] (-label) at (#2/2+1,0) {\tikzpictext};}}}`,
		String.raw`\def\sgicon#1{\tikz[baseline=-0.3pt]{\path[use as bounding box] (0,0) rectangle (8.544pt,8.544pt);\pic at (0,8.544pt) {sg icon/#1};}}`,
		...iconCatalog.filter(i => used.has(i.name)).map(i => String.raw`\tikzset{sg icon/${i.name}/.pic={\begin{scope}[x=1pt,y=1pt,scale=0.355659449,yscale=-1,sg icon stroke]` +
			i.paths.map(p => `\\draw svg "${p}";`).join('') +
			(i.circles ?? []).map(c => `\\draw (${c.cx},${c.cy}) circle[radius=${c.r}];`).join('') +
			(i.rects ?? []).map(r => `\\draw[rounded corners=${r.rx ?? 0}pt] (${r.x},${r.y}) rectangle (${r.x + r.width},${r.y + r.height});`).join('') + String.raw`\end{scope}}}`),
	];
}

function themeBlock(fig: Figure): string[] {
	const custom = new Set<string>();
    for(const d of styleDefs(fig)){ for(const match of styleDefOptions(d).join(', ').matchAll(/sgc([0-9A-F]{6})/g)) { custom.add(match[1]); } }
	for (const [objects, arrow] of [[nodes(fig), false], [edges(fig), true]] as const) {
	 for (const o of objects) {
	  for (const match of [...styleOptions(o.style, arrow), ...o.extra].join(', ').matchAll(/sgc([0-9A-F]{6})/g)) { custom.add(match[1]); }
	 }
	}

	for (const g of groups(fig)) { for (const c of [g.color,frameAppearance(g).color,g.frameColor,g.titleColor,g.labelStyle?.color,darkerColor(g.color),darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373'))]) { if (c && /^#[0-9a-f]{6}$/i.test(c)) custom.add(c.slice(1).toUpperCase()); } }
 for(const e of edges(fig)) for(const l of [e.labelStyle,...(e.labels || []).map(l=>l.style)]) if(l?.color?.startsWith('#')) custom.add(l.color.slice(1).toUpperCase());
	return [
		'% sakuga theme begin (generated from the style lines above)',
		...iconCode(fig),
		...[...custom].sort().map(hex => `\\definecolor{sgc${hex}}{HTML}{${hex}}`),
		...Object.keys(PALETTE).filter(c => c !== 'white').map(c => `\\definecolor{${PALETTE[c].name}}{HTML}{${PALETTE[c].hex}}`),
		String.raw`\def\sgcontent#1#2#3{\def\sgpos{#1}\def\sgleft{left}\def\sgright{right}\def\sgsw{sw}\def\sgse{se}\ifx\sgpos\sgleft\makebox[#2mm][r]{\parbox{\dimexpr#2mm-4mm\relax}{\centering#3}}\else\ifx\sgpos\sgright\makebox[#2mm][l]{\parbox{\dimexpr#2mm-4mm\relax}{\centering#3}}\else\ifx\sgpos\sgsw\parbox{#2mm}{\centering#3\par\vspace*{4mm}}\else\ifx\sgpos\sgse\parbox{#2mm}{\centering#3\par\vspace*{4mm}}\else\parbox{#2mm}{\vspace*{4mm}\centering#3}\fi\fi\fi\fi}`,
		String.raw`\def\sgcodesize{}\tikzset{sg want/.style={},sg code font/.code={\def\sgcodesize{\csname#1\endcsname}}}`,
		String.raw`\def\sgcode#1{{\ifdim\csname f@size\endcsname pt<9pt\tiny\else\ifdim\csname f@size\endcsname pt<10pt\scriptsize\else\ifdim\csname f@size\endcsname pt<10.5pt\footnotesize\else\ifdim\csname f@size\endcsname pt<11.5pt\small\else\normalsize\fi\fi\fi\fi\sgcodesize\ttfamily\textcolor{black!48}{#1}}}`,
		String.raw`\def\sgstep#1{\tikz[baseline=-0.6ex]\node[circle,fill=.,text=white,font=\sffamily\bfseries\scriptsize,inner sep=1pt,minimum size=3.6mm]{#1};}`,
		String.raw`\def\sglabel#1#2{\raisebox{\dimexpr\depth/2-\height/2\relax}{\sgstep{#1}}\hspace{0.8mm}\raisebox{\dimexpr\depth/2-\height/2\relax}{\shortstack{#2}}}`,
		'\\tikzset{',
		`  sg box/.style={draw=black!38, line width=0.45pt, rounded corners=1.4pt, align=center,`,
		`    inner xsep=3pt, inner ysep=3.5pt, minimum height=6mm, text width=${DEFAULT_WIDTH}mm, fill=white},`,
		'  sg compact/.style={inner xsep=1pt, inner ysep=1pt, minimum height=0pt},',
		'  sg label/.style={sg box, draw=none, fill=none, rounded corners=0pt}, sg label height/.style={minimum height={#1mm-0.45pt}},',
		...styleDefs(fig).map(d => `  sg style/${d.key}/.style={${styleDefOptions(d).join(', ')}},`),
		'  arr/.style={-{Latex[length=1.5mm, width=1.2mm]}, draw=black!50, line width=0.45pt, rounded corners=2pt},',
		'  head both/.style={{Latex[length=1.5mm, width=1.2mm]}-{Latex[length=1.5mm, width=1.2mm]}},',
		'  head none/.style={-},',
		'  sg elabel/.style={align=center, text=black!65, font=\\sffamily\\scriptsize, fill=white, inner sep=1pt},',
		'  sg labels/.style={}, sg label side/.style={}, sg label position/.style={}, sg step/.style={}, sg lane/.style={}, sg line width/.style={}, sg tip length/.style={}, sg tip width/.style={}, sg route/.style={}, sg mid/.style={}, sg bend/.style={}, sg implicit from/.style={}, sg implicit to/.style={},',
		'  sg straight/.style={}, sg manhattan/.style={}, sg curved/.style={}, sg fixed/.style={},',
		'  sg icon height/.style={minimum height=#1mm}, sg icon/.style={}, sg icon position/.style={}, sg in/.style={}, sg layer/.style={}, sg hidden/.style={}, sg locked/.style={}, sg opacity/.style={},',
		'  sg frame dashed/.style={draw=black!55, line width=0.7pt, dash pattern=on 9pt off 3pt, rounded corners=2.5pt, inner sep=2.8mm},',
		'  sg frame dotted/.style={draw=black!55, line width=1.5pt, line cap=round, dash pattern=on 0pt off 4.5pt, rounded corners=2.5pt, inner sep=1.8mm},',
		'  sg frame region/.style={rounded corners=1.5pt, inner sep=3mm},',
		'  sg frame solid/.style={draw=black!55, line width=0.7pt, rounded corners=2.5pt, inner sep=3mm},',
		'  sg frame none/.style={inner sep=0pt},',
		'  sg glabel/.style={font=\\sffamily\\scriptsize, text=black!55, inner sep=1.5pt},',
		'  arr-dashed/.style={arr, draw=black!35, dash pattern=on 1.4pt off 1.4pt},',
		'  sg swatch/.style={draw=black!38, line width=0.45pt, rounded corners=1pt,',
		'    minimum width=3.6mm, minimum height=3.6mm, inner sep=0pt},',
		'}',
		'% sakuga theme end',
	];
}

// Frames and regions of the groups, behind everything else; inner groups first, so that an outer
// frame can fit around an inner one.
function groupsBlock(fig: Figure): string[] {
	const gs = groups(fig).filter(g => g.frame !== 'none' || edges(fig).some(e=>e.from===g.id||e.to===g.id));
	if (!gs.length) {
		return [];
	}
	const visible = nodes(fig).filter(n => !isHidden(fig, n));
	const members = (gid: string): string[] => [
		...visible.filter(n => n.group === gid).map(n => n.kind === 'icon' ? `(${n.id}-center) (${n.id}-label)` : `(${n.id})`),
		...groups(fig).filter(g => g.parent === gid).flatMap(g => g.frame === 'none' ? members(g.id) : (members(g.id).length ? [`(${g.id})`] : [])),
	];
	const depth = (g: Group): number => g.parent ? 1 + depth(groups(fig).find(x => x.id === g.parent) ?? { ...g, parent: '' }) : 0;
	const out = ['% sakuga groups begin (generated from the group lines)', '\\begin{scope}[on background layer]'];
	// first the size of every frame, inner ones first; then the drawing, outer ones first
	const sized = [...gs].sort((a, b) => depth(b) - depth(a)).filter(g => members(g.id).length);
	for (const g of sized) {
		const b=routeObjects(fig).find(n=>n.id===g.id);
  out.push(`\\node[inner sep=0pt, outer sep=0pt, fit={(${b.x-b.w/2},${b.y-b.h/2}) (${b.x+b.w/2},${b.y+b.h/2})}] (${g.id}) {};`);
	}
	for (const g of [...sized].reverse()) {
		const member = groupMembers(fig,g.id).find(n => !isHidden(fig,n));
		const alpha = member ? opacity(nodeLayer(fig,member).opacity) : 1;
		const alphaKey = alpha !== 1 ? `, opacity=${alpha}` : '';
  const look=frameAppearance(g), base=g.frame==='none' ? 'solid' : g.frame;
  const fillKey=look.fill==='none' ? ', fill=none' : ', fill='+fill(g.color).split('!')[0]+'!'+look.strength;
  out.push(`\\path[sg frame ${base}${fillKey}, draw=${look.outline==='none' ? 'none' : fill(look.color)}, ${look.outline==='dashed' ? 'dash pattern=on 9pt off 3pt' : look.outline==='dotted' ? 'dash pattern=on 0pt off 4.5pt' : 'solid'}, line cap=${look.outline==='dotted' ? 'round' : 'butt'}, line width=${look.width}pt${alphaKey}] (${g.id}.south west) rectangle (${g.id}.north east);`);
  const position=g.titlePosition || 'legacy';
  if (g.name && (position !== 'legacy' || g.frame === 'region')) {
   const [corner,anchor] = ({'above-left':['north west','south west'],'above-center':['north','south'],'inside-top-left':['north west','north west'],'inside-top-right':['north east','north east'],'below-left':['south west','north west'],legacy:['north west','north west']} as Record<string,string[]>)[position] || ['north west','south west'];
   const color=g.titleColor || (position==='legacy' ? '' : darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373')));
   out.push(`\\node[sg glabel, anchor=${anchor}, outer sep=0pt, text height=${(({scriptsize:8,footnotesize:9,small:10,normalsize:10.95,large:12} as Record<string,number>)[g.labelStyle?.font || g.titleFont || 'scriptsize'])*.75}pt, text depth=${(({scriptsize:8,footnotesize:9,small:10,normalsize:10.95,large:12} as Record<string,number>)[g.labelStyle?.font || g.titleFont || 'scriptsize'])*.25}pt${g.titleBold ? ', font=\\sffamily\\'+(g.titleFont || 'scriptsize')+'\\bfseries' : g.titleFont ? ', font=\\sffamily\\'+g.titleFont : ''}${color ? ', text='+fill(color) : ''}${labelOptions(g.labelStyle,{font:g.titleFont || 'scriptsize',bold:g.titleBold || false,color:color || ''})}${alphaKey}] at (${g.id}.${corner}) {${g.name}};`);
  }
	}
	out.push('\\end{scope}', '% sakuga groups end');
	return out;
}

// Legend: one swatch per used category, three per column, below the figure's bottom-left corner.
function legendBlock(fig: Figure): string[] {
	const used = new Set(nodes(fig).map(n => n.cat));
	const cats = categories(fig).filter(c => used.has(c.key) && c.legend);
	if (!legendOn(fig) || cats.length === 0) {
		return [];
	}
	const out = ['% sakuga legend begin (generated)', '\\begin{scope}[shift={(current bounding box.south west)}]'];
	cats.forEach((c, i) => {
		const x = Math.floor(i / 3) * 34, y = -7 - (i % 3) * 6;
		out.push(`\\node[sg swatch, fill=${fill(c.color)}, anchor=north west] at (${x},${y}) {};`);
		out.push(`\\node[anchor=west, inner sep=0pt, font=\\sffamily\\${smallerFont(fontSize(fig))}] at (${num(x + 4.6)},${num(y - 1.8)}) {${c.icon ? `\\sgicon{${c.icon}}\\ ` : ''}${c.name}};`);
	});
	out.push('\\end{scope}', '% sakuga legend end');
	return out;
}

function pictureFont(line: string, size: string): string {
 const font = `font=\\sffamily\\${size}`;
 if (/font=\\sffamily\\\w+/.test(line)) { return line.replace(/font=\\sffamily\\\w+/, font); }
 return line.replace(/\\begin\{tikzpicture\}(?:\[([^\]]*)\])?/, (_, options: string) => `\\begin{tikzpicture}[${options ? options+', ' : ''}${font}]`);
}

export function serialize(fig: Figure): string {
	settle(fig);
	resolveAttachments(fig);
	const ordered: FigNode[] = [], visited = new Set<string>();
	const visit = (n: FigNode) => { if (visited.has(n.id)) { return; } visited.add(n.id); const p = n.attachment && nodes(fig).find(p => p.id === n.attachment!.parent); if (p) { visit(p); } ordered.push(n); };
	layers(fig).forEach(layer => nodes(fig).filter(n => nodeLayer(fig,n).id === layer.id).forEach(visit));
	// Reuse node slots so unrecognised TikZ and comments keep their positions.
	let nextNode = 0;
	const lines: Line[] = fig.lines.filter(l => l.t !== 'edge' && l.t !== 'groups' && l.t !== 'icons')
		.map(l => l.t === 'node' ? { t: 'node', n: ordered[nextNode++] } : l);
	let afterNodes = lines.map(l => l.t).lastIndexOf('node') + 1;
	if (!afterNodes) {
		afterNodes = lines.findIndex(l => l.t === 'legend' || (l.t === 'raw' && l.text.includes('\\end{tikzpicture}')));
		if (afterNodes < 0) { afterNodes = lines.length; }
	}
	lines.splice(afterNodes, 0, ...edges(fig).map(e => ({ t: 'edge' as const, e })));

	if (!lines.some(l => l.t === 'theme')) {
		const at = lines.findIndex(l => l.t === 'raw' && l.text.includes('\\begin{tikzpicture}'));
		lines.splice(at + 1, 0, { t: 'theme' });
	}
	if (!lines.some(l => l.t === 'groups') && groups(fig).some(g => g.frame !== 'none' || edges(fig).some(e=>e.from===g.id||e.to===g.id))) {
		const at = lines.map(l => l.t).lastIndexOf('node');
		lines.splice(at + 1, 0, { t: 'groups' });
	}
	if (!lines.some(l => l.t === 'legend')) {
		const at = lines.findIndex(l => l.t === 'raw' && l.text.includes('\\end{tikzpicture}'));
		lines.splice(at < 0 ? lines.length : at, 0, { t: 'legend' });
	}
	return lines.flatMap(l => {
		switch (l.t) {
			case 'node': return [nodeLine({ ...l.n, style: l.n.style, hidden: isHidden(fig, l.n), extra: [...l.n.extra, ...(l.n.hidden && nodeLayer(fig, l.n).hidden ? ['sg hidden'] : [])] }, fontSize(fig), !!nodeIcon(fig,l.n), opacity(nodeLayer(fig,l.n).opacity), fig), ...hiddenReference(fig,l.n), ...(nodeIcon(fig,l.n) && l.n.kind !== 'icon' && !isHidden(fig,l.n) ? attachedIcons(fig,[l.n]) : [])];
			case 'edge': {
				const hiddenGroup = groups(fig).some(g=>(g.id===l.e.from || g.id===l.e.to) && groupMembers(fig,g.id).every(n=>isHidden(fig,n)));
				const hid = hiddenGroup || nodes(fig).some(n => isHidden(fig, n) && (n.id === l.e.from || n.id === l.e.to));
				return [hid ? `% sakuga hidden ${edgeLine(fig, l.e)}` : edgeLine(fig, l.e)];
			}
			case 'layer': return [`% sakuga layer ${l.layer.id} {${l.layer.name}}${l.layer.hidden ? ' hidden' : ''}${l.layer.locked ? ' locked' : ''}${opacity(l.layer.opacity) !== 1 ? ` opacity=${opacity(l.layer.opacity)}` : ''}`];
			case 'group': return [`% sakuga group ${l.g.id} {${l.g.name}} ${l.g.frame} ${l.g.color}${l.g.parent ? ` in=${l.g.parent}` : ''}${groupOptions(l.g)}`];
			case 'groups': return groupsBlock(fig);
			case 'arrowsflag': return [`% sakuga arrows ${l.style}`];
			case 'style': return [styleLine(l.s)];
			case 'legendflag': return [`% sakuga legend ${l.on ? 'on' : 'off'}`];
			case 'theme': return themeBlock(fig);
			case 'icons': return attachedIcons(fig);
			case 'legend': return legendBlock(fig);
			case 'raw': return [l.text.includes('\\begin{tikzpicture}') ? pictureFont(l.text, fontSize(fig)) : l.text];
		}
	}).join('\n');
}

// Insert after the last line of the same kind, else at a sensible place.
function insert(fig: Figure, line: Line) {
	const last = (t: string) => fig.lines.map(l => l.t).lastIndexOf(t as Line['t']);
	let at = last(line.t);
	if (at < 0 && line.t === 'edge') {
		at = last('node');
	}
	if (at < 0 && line.t === 'group') {
		at = Math.max(last('style'), last('legendflag'), last('arrowsflag'));
	}
	if (at < 0 && (line.t === 'legendflag' || line.t === 'arrowsflag')) {
		at = Math.max(last('style'), last('legendflag'));
	}
	if (at < 0 && (line.t === 'style' || line.t === 'legendflag' || line.t === 'arrowsflag' || line.t === 'group' || line.t === 'layer')) {
		at = fig.lines.findIndex(l => l.t === 'raw' && l.text.includes('\\begin{tikzpicture}')) - 1;
	}
	if (at < 0 && line.t === 'node') {
		at = fig.lines.findIndex(l => l.t === 'theme');
	}
	if (at < 0) {
		at = fig.lines.findIndex(l => l.t === 'legend' || (l.t === 'raw' && l.text.includes('\\end{tikzpicture}'))) - 1;
	}
	fig.lines.splice(at + 1, 0, line);
}

export type Op =
 | {op:'label'; index?: number; group?: string; slot?: number; text?: string; style?: LabelStyle}
 | {op:'detachLabel'; index?: number; group?: string; slot?: number; id: string; x: number; y: number; width?: number}
 | {op:'attachLabel'; id: string; index?: number; group?: string; style?: LabelStyle}

 | { op: 'font'; size: string }
 | { op: 'duplicateLayer'; id: string; newId: string }
 | { op: 'mergeLayers'; ids: string[]; target: string }
 | { op: 'style'; ids?: string[]; indices?: number[]; style: ObjectStyle }

	| { op: 'attach'; id: string; attachment: Attachment | null }
	| { op: 'move'; id: string; x: number; y: number }
	| { op: 'addNode'; wantWidth?: number; codeFont?: string; titlePosition?: string; attachment?: Attachment; style?: ObjectStyle; extra?: string[]; layer?: string; id: string; x: number; y: number; title: string; cat: string; icon?: string; iconPosition?: string; kind?: string; code?: string; width?: number; minh?: number; from?: string }
	| { op: 'addEdge'; styleKey?: string; fromOffset?: number; toOffset?: number; loopSide?: string; loopSize?: number; loopOut?: number; loopIn?: number; looseness?: number; loopMax?: number; chain?: string[]; waypoints?: number[][]; labelStyle?: LabelStyle; labels?: AttachedLabel[]; fromAnchor?: string; toAnchor?: string; lane?: number; style?: ObjectStyle; extra?: string[]; from: string; to: string; kind?: string; route?: string; mid?: number | null; bend?: number; head?: string; label?: string }
	| { op: 'node'; wantWidth?: number; codeFont?: string; titlePosition?: string; id: string; title?: string; icon?: string; iconPosition?: string; kind?: string; code?: string; cat?: string; width?: number; minh?: number }
	| { op: 'arrow'; styleKey?: string; fromOffset?: number; toOffset?: number; loopSide?: string; loopSize?: number; loopOut?: number; loopIn?: number; looseness?: number; loopMax?: number; chain?: string[] | null; waypoints?: number[][]; resetAuto?: boolean; from?: string; to?: string; fromAnchor?: string; toAnchor?: string; lane?: number | null; index: number; kind?: string; route?: string; mid?: number | null; bend?: number; head?: string; label?: string }
	| { op: 'arrows'; style: string }
	| { op: 'sheet'; width: number }
	| { op: 'addLayer'; id: string; name: string }
	| { op: 'layerProps'; id: string; name?: string; hidden?: boolean; locked?: boolean; opacity?: number }
	| { op: 'deleteLayer'; id: string }
	| { op: 'reorderLayers'; order: string[] }
	| { op: 'setLayer'; ids: string[]; layer: string }
	| { op: 'reorder'; order: string[] }
	| { op: 'addGroup'; fill?: string; fillStrength?: number; outline?: string; labelStyle?: LabelStyle; padding?: number; titlePosition?: string; titleBold?: boolean; titleFont?: string; titleColor?: string; lineWidth?: number; frameColor?: string; id: string; name: string; frame?: string; color?: string; parent?: string }
	| { op: 'groupProps'; fill?: string; fillStrength?: number; outline?: string; labelStyle?: LabelStyle; padding?: number; titlePosition?: string; titleBold?: boolean; titleFont?: string; titleColor?: string; lineWidth?: number; frameColor?: string; id: string; name?: string; frame?: string; color?: string; parent?: string }
	| { op: 'deleteGroup'; id: string }
	| { op: 'setGroup'; ids: string[]; group: string }
	| { op: 'hide'; ids: string[]; hidden: boolean }
	| { op: 'lock'; ids: string[]; locked: boolean }
	| { op: 'deleteNode'; id: string }
	| { op: 'deleteEdge'; index: number }
	| { op: 'addCategory'; key: string; name: string; color: string; icon?: string; boxes?: boolean; legend?: boolean }
	| { op: 'category'; key: string; name?: string; color?: string; icon?: string; boxes?: boolean; legend?: boolean }
	| { op: 'deleteCategory'; key: string }
	| { op: 'legend'; on: boolean }
	| { op: 'styleAdd'; kind: StyleKind; key?: string; name: string; props?: Record<string, any>; icon?: string; boxes?: boolean; legend?: boolean; from?: { id?: string; index?: number }; assign?: { ids?: string[]; indices?: number[] } }
	| { op: 'styleEdit'; key: string; name?: string; props?: Record<string, any>; icon?: string; boxes?: boolean; legend?: boolean }
	| { op: 'styleUpdate'; key: string; id?: string; index?: number }
	| { op: 'styleDelete'; key: string; to?: string }
	| { op: 'resetStyle'; ids?: string[]; indices?: number[]; keys?: string[] }
	| { op: 'batch'; ops: Op[] };

export function slugKey(name: string, taken: string[]): string {
	const base = name.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1').toLowerCase()
		.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cat';
	let key = base;
	for (let i = 2; taken.includes(key); i++) {
		key = `${base}-${i}`;
	}
	return key;
}

const usersOf = (fig: Figure, def: StyleDef): (FigNode | FigEdge)[] => def.kind === 'arrow' ? edges(fig).filter(e => e.styleKey === def.key) : nodes(fig).filter(n => n.cat === def.key && nodeStyleKind(n) === def.kind);
// Change a style definition while the users keep their overrides.
function restyle(fig: Figure, def: StyleDef, mutate: (users: (FigNode | FigEdge)[]) => void) {
 const users = usersOf(fig, def), before = users.map(u => overrideOf(def.kind, u.style || {}, def.props));
 mutate(users);
 users.forEach((u, i) => { u.style = mergeStyle(def.kind, def.props, before[i]); });
}
// A property change on an object. On a styled object an empty value means "back to the style",
// except where the style itself differs from the house look and the object asks for the house look.
function patchStyle(fig: Figure, o: FigNode | FigEdge, patch: ObjectStyle): ObjectStyle {
 const st: any = { ...o.style, ...patch }, kind = objectKind(o), def = styleOf(fig, o);
 if (kind === 'box' || kind === 'label') {
  if ('weight' in patch && !('lineWidth' in patch)) { delete st.lineWidth; }
  if (patch.lineWidth !== undefined && patch.lineWidth !== null && patch.weight === undefined) { delete st.weight; }
 }
 if (!def || !kind) { for (const k of Object.keys(st)) { if (st[k] === null) { delete st[k]; } } return st; }
 const base = def.props;
 for (const k of STYLEABLE[kind]) {
  if (!(k in patch) || isSet((patch as any)[k])) { continue; }
  if (k === 'border' && base.border && base.border !== 'solid') { st.border = 'solid'; }
  else if (k === 'shape' && base.shape && base.shape !== 'rounded') { st.shape = 'rounded'; }
  else if (k === 'weight' && (base.lineWidth !== undefined || (base.weight && base.weight !== 'thin'))) { st.weight = 'thin'; delete st.lineWidth; }
  else { delete st[k]; }
 }
 for (const g of STYLE_GROUPS[kind]) {
  if (!g.some(k => k in patch)) { continue; }
  if (g.every(k => !isSet(st[k])) && g.some(k => isSet(base[k]))) { if (g[0] === 'font') { st.font = fontSize(fig); } else if (g[0] === 'weight') { st.weight = 'thin'; } }
 }
 return st;
}

export function apply(fig: Figure, op: Op): void {
	const node = (id: string) => nodes(fig).find(n => n.id === id);
	switch (op.op) {
 case 'sheet': {
  if (!Number.isFinite(op.width) || op.width < 50 || op.width > 400) break;
  fig.lines=fig.lines.filter(l=>!(l.t==='raw' && /^%\s*sakuga sheet\s+/.test(l.text)));
  if(op.width!==146)fig.lines.unshift({t:'raw',text:`% sakuga sheet ${op.width}`});
  break;
 }
 case 'label': {
  const g=groups(fig).find(g=>g.id===op.group),e=op.index===undefined ? undefined : edges(fig)[op.index];
  const target:any=g || (op.slot===undefined ? e : e?.labels?.[op.slot]); if(!target) break;
  if(op.text!==undefined) { if(g) g.name=op.text; else if(op.slot===undefined) e!.label=op.text; else target.text=op.text; }
  const key=g || op.slot===undefined ? 'labelStyle' : 'style'; target[key]=cleanLabel({...target[key],...op.style}); if(!Object.keys(target[key]).length) delete target[key]; break;
 }
 case 'detachLabel': {
  const g=groups(fig).find(g=>g.id===op.group),e=op.index===undefined ? undefined : edges(fig)[op.index],l=op.slot===undefined ? undefined : e?.labels?.[op.slot];
  if(!g && !e) break;
  const st=g?.labelStyle || l?.style || e?.labelStyle || {},title=g?.name ?? l?.text ?? e!.label;
  const color=st.color || (g ? g.titleColor || darkerColor(g.frameColor || (g.outline ? darkerColor(g.color) : '#737373')) : e?.style?.color || '#595959');
  apply(fig,{op:'addNode',id:op.id,x:op.x,y:op.y,title,kind:'label',cat:'',layer:(g ? groupMembers(fig,g.id)[0] : nodes(fig).find(n=>n.id===e?.from))?.layer,width:op.width || 26,style:{opacity:e?.style?.opacity,compact:true,font:st.font || (g ? g.titleFont || 'scriptsize' : fontSize(fig)),textColor:color,text:(st.bold ?? g?.titleBold) && st.italic ? 'bold-italic' : (st.bold ?? g?.titleBold) ? 'bold' : st.italic ? 'italic' : '',fill:(st.background ?? !g) ? 'white' : 'none'}});
  if(g) g.name=''; else if(l) e!.labels!.splice(op.slot!,1); else {e!.label='';delete e!.labelStyle; if(e!.style) { const badge=e!.style.step; if(badge) node(op.id)!.style!.step=badge; delete e!.style.step; }} break;
 }
 case 'attachLabel': {
  const n=node(op.id),g=groups(fig).find(g=>g.id===op.group),e=op.index===undefined ? undefined : edges(fig)[op.index]; if(n?.kind!=='label' || (!g && !e)) break;
  const st:LabelStyle=cleanLabel({font:n.style?.font,color:n.style?.textColor,bold:n.style?.text?.startsWith('bold') ? true : undefined,italic:n.style?.text?.includes('italic') ? true : undefined,background:n.style?.fill==='white' ? true : n.style?.fill==='none' ? false : undefined,...op.style});
  if(g) {g.name=n.title;g.labelStyle=st;} else if(!e!.label) {e!.label=n.title;e!.labelStyle=st;if(n.style?.step)e!.style={...e!.style,step:n.style.step};} else {e!.labels=[...(e!.labels || []),{text:n.title,style:st}];}
  fig.lines=fig.lines.filter(l=>!(l.t==='node' && l.n===n));break;
 }
 case 'font':
  if (FONT_SIZES.includes(op.size)) { fig.lines = fig.lines.filter(l => !(l.t === 'raw' && /^% sakuga font /.test(l.text))); fig.lines.unshift({t:'raw', text:`% sakuga font ${op.size}`}); }
  break;
 case 'style':
  for (const n of nodes(fig)) { if (op.ids?.includes(n.id)) { n.style = patchStyle(fig, n, op.style); } }
  for (const i of op.indices || []) { const e = edges(fig)[i]; if (e) { e.style = patchStyle(fig, e, op.style); if (op.style.start !== undefined || op.style.end !== undefined) { e.style.start = e.style.start || (e.head === 'both' ? 'Latex' : 'none'); e.style.end = e.style.end || (e.head === 'none' ? 'none' : 'Latex'); e.head = 'end'; } if (op.style.border !== undefined) { e.kind = 'arr'; } } }
  break;
 case 'styleAdd': {
  const taken = styleDefs(fig).map(d => d.key);
  const key = op.key && /^[\w-]+$/.test(op.key) && !taken.includes(op.key) ? op.key : slugKey(op.name, taken);
  const src: any = op.from?.id !== undefined ? node(op.from.id) : op.from?.index !== undefined ? edges(fig)[op.from.index] : undefined;
  const def: StyleDef = { kind: op.kind, key, name: op.name, props: { ...styleableOf(op.kind, op.props), ...(src ? styleableOf(op.kind, src.style) : {}) }, ...(op.icon ? { icon: op.icon } : {}), ...(op.boxes ? { boxes: true } : {}), legend: op.legend ?? false };
  insert(fig, { t: 'style', s: def });
  const targets: any[] = [...(src ? [src] : []), ...(op.assign?.ids || []).flatMap(id => node(id) ?? []), ...(op.assign?.indices || []).flatMap(i => edges(fig)[i] ?? [])];
  for (const t of targets) { if ('from' in t) { t.styleKey = key; } else { t.cat = key; } }
  break;
 }
 case 'styleEdit': {
  const def = findStyle(fig, op.key); if (!def) { break; }
  restyle(fig, def, users => {
   if (op.name !== undefined && op.name !== def.name) {
    const key = slugKey(op.name, styleDefs(fig).filter(d => d !== def).map(d => d.key));
    for (const u of users) { if ('from' in u) { u.styleKey = key; } else { u.cat = key; } }
    def.key = key; def.name = op.name;
   }
   for (const [k, v] of Object.entries(op.props || {})) { if (isSet(v)) { def.props[k] = v; } else { delete def.props[k]; } }
   if (op.icon !== undefined) { if (op.icon) { def.icon = op.icon; } else { delete def.icon; } }
   if (op.boxes !== undefined) { def.boxes = op.boxes; }
   if (op.legend !== undefined) { def.legend = op.legend; }
  });
  break;
 }
 case 'styleUpdate': {
  const def = findStyle(fig, op.key); if (!def) { break; }
  const src: any = op.id !== undefined ? node(op.id) : op.index !== undefined ? edges(fig)[op.index] : undefined; if (!src) { break; }
  restyle(fig, def, () => { Object.assign(def.props, styleableOf(def.kind, src.style)); });
  break;
 }
 case 'styleDelete': {
  const def = findStyle(fig, op.key); if (!def) { break; }
  const dest = findStyle(fig, op.to, def.kind);
  for (const u of usersOf(fig, def)) {
   if (dest) { for (const k of STYLEABLE[def.kind]) { delete (u.style as any)?.[k]; } if ('from' in u) { u.styleKey = dest.key; } else { u.cat = dest.key; } }
   else if ('from' in u) { delete u.styleKey; } else { u.cat = ''; }
  }
  fig.lines = fig.lines.filter(l => !(l.t === 'style' && l.s === def));
  break;
 }
 case 'resetStyle': {
  const targets: any[] = [...nodes(fig).filter(n => op.ids?.includes(n.id)), ...(op.indices || []).flatMap(i => edges(fig)[i] ?? [])];
  for (const t of targets) {
   const kind = objectKind(t); if (!kind || !styleOf(fig, t)) { continue; }
   const keys = new Set(op.keys?.length ? op.keys : STYLEABLE[kind]);
   for (const g of STYLE_GROUPS[kind]) { if (g.some(k => keys.has(k))) { g.forEach(k => keys.add(k)); } }
   for (const k of keys) { delete t.style?.[k]; }
  }
  break;
 }
 case 'mergeLayers':
  if (layers(fig).some(l => l.id === op.target)) { for (const n of nodes(fig)) { if (op.ids.includes(nodeLayer(fig,n).id)) { n.layer = op.target; } } fig.lines = fig.lines.filter(l => !(l.t === 'layer' && op.ids.includes(l.layer.id) && l.layer.id !== op.target)); }
  break;
 case 'duplicateLayer': {
  materializeLayers(fig); const source = layers(fig).find(l => l.id === op.id); if (!source || layers(fig).some(l => l.id === op.newId)) { break; }
  const ns = nodes(fig).filter(n => n.layer === op.id), map = new Map<string,string>();
  const used = [...nodes(fig).map(n => n.id), ...groups(fig).map(g => g.id)];
  const fresh = (id: string) => { const key = slugKey(id+'-copy',used); used.push(key); map.set(id,key); return key; };
  const gs = groups(fig).filter(g => ns.some(n => groupMembers(fig,g.id).includes(n))); gs.forEach(g => fresh(g.id)); ns.forEach(n => fresh(n.id));
  const es = edges(fig).filter(e => map.has(e.from) && map.has(e.to));
  const at = fig.lines.findIndex(l => l.t === 'layer' && l.layer.id === op.id); fig.lines.splice(at+1,0,{t:'layer',layer:{...source,id:op.newId,name:source.name+' copy'}});
  gs.forEach(g => insert(fig,{t:'group',g:{...g,id:map.get(g.id)!,parent:map.get(g.parent)||''}}));
  ns.forEach(n => insert(fig,{t:'node',n:{...n,attachment:n.attachment ? {...n.attachment,parent:map.get(n.attachment.parent)||n.attachment.parent} : undefined,id:map.get(n.id)!,layer:op.newId,group:map.get(n.group)||'',style:{...n.style},extra:[...n.extra]}}));
  es.forEach(e => insert(fig,{t:'edge',e:{...e,labelStyle:e.labelStyle && {...e.labelStyle},labels:e.labels?.map(l=>({...l,style:{...l.style}})),from:map.get(e.from)!,to:map.get(e.to)!,style:{...e.style},extra:[...e.extra]}})); break;
 }

		case 'addLayer':
			materializeLayers(fig);
			if (!layers(fig).some(l => l.id === op.id)) { insert(fig, { t: 'layer', layer: { id: op.id, name: op.name.replace(/[{}\r\n]/g, ''), hidden: false, locked: false } }); }
			break;
		case 'layerProps': {
			materializeLayers(fig);
			const l = layers(fig).find(l => l.id === op.id);
			if (l) {
				if (op.name !== undefined) { l.name = op.name.replace(/[{}\r\n]/g, ''); }
				if (op.hidden !== undefined) { l.hidden = op.hidden; }
				if (op.locked !== undefined) { l.locked = op.locked; }
				if (op.opacity !== undefined) { l.opacity = opacity(op.opacity); }
			}
			break;
		}
		case 'deleteLayer': {
			materializeLayers(fig); const ls = layers(fig), i = ls.findIndex(l => l.id === op.id);
			if (i < 0 || ls.length === 1) { break; }
			for (const n of nodes(fig)) { if (n.layer === op.id) { n.layer = ls[i > 0 ? i - 1 : 1].id; } }
			fig.lines = fig.lines.filter(l => !(l.t === 'layer' && l.layer.id === op.id));
			break;
		}
		case 'reorderLayers': {
			materializeLayers(fig); const ls = layers(fig);
			const order = [...new Set(op.order)].flatMap(id => ls.filter(l => l.id === id));
			order.push(...ls.filter(l => !order.includes(l)));
			let i = 0; for (const l of fig.lines) { if (l.t === 'layer') { l.layer = order[i++]; } }
			break;
		}
		case 'setLayer': {
			if (!layers(fig).some(l => l.id === op.layer)) { break; }
			const moving = new Set(op.ids.flatMap(id => groups(fig).some(g => g.id === id) ? groupMembers(fig, id).map(n => n.id) : [id]));
			for (const n of nodes(fig)) {
				if (!moving.has(n.id)) { continue; }
				n.layer = op.layer;
				if (!op.ids.some(id => groups(fig).some(g => g.id === id) && groupMembers(fig, id).includes(n))) { n.group = ''; }
			}
			for (const g of groups(fig)) { if (op.ids.includes(g.id) && g.parent && !op.ids.includes(g.parent)) { g.parent = ''; } }
			break;
		}
		case 'attach': {
   const n = node(op.id), a = op.attachment;
   if (!n) { break; }
   if (!a) { delete n.attachment; break; }
   let p = node(a.parent); const seen = new Set([n.id]);
   while (p && !seen.has(p.id)) { seen.add(p.id); p = p.attachment ? node(p.attachment.parent) : undefined; }
   if (!p && node(a.parent) && !node(a.parent)!.kind && ANCHORS.includes(a.anchor) && ANCHORS.includes(a.ownAnchor) && Number.isFinite(a.dx) && Number.isFinite(a.dy)) { n.attachment = {...a}; }
   break;
  }
		case 'move': {
			const n = node(op.id);
			if (n) { if (n.attachment) { n.attachment.dx += op.x-n.x; n.attachment.dy += op.y-n.y; } n.x = op.x; n.y = op.y; }
			break;
		}
		case 'addNode':
			insert(fig, { t: 'node', n: {
				wantWidth:op.wantWidth, codeFont:op.codeFont, titlePosition: op.titlePosition, attachment: op.attachment && {...op.attachment}, style: op.style, id: op.id, cat: op.cat, x: op.x, y: op.y, title: op.title, icon: op.icon, iconPosition: op.iconPosition, kind: op.kind, code: op.code ?? '',
				width: op.width ?? DEFAULT_WIDTH, minh: op.minh ?? 0, layer: layers(fig).find(l => l.id === op.layer)?.id ?? layers(fig)[0].id, group: '', hidden: false, locked: false, extra: op.extra ?? [],
			} });
			if (op.from) {
				insert(fig, { t: 'edge', e: { from: op.from, to: op.id, kind: 'arr', route: 'auto', mid: null, bend: 0, head: 'end', label: '', extra: [] } });
			}
			break;
		case 'addEdge':
			insert(fig, { t: 'edge', e: {
				...(op.styleKey ? {styleKey: op.styleKey} : {}), labelStyle:op.labelStyle && {...op.labelStyle}, labels:op.labels?.map(l=>({...l,style:{...l.style}})), ...Object.fromEntries(['fromOffset','toOffset','loopSide','loopSize','loopOut','loopIn','looseness','loopMax','chain','waypoints'].filter(k=>(op as any)[k]!==undefined).map(k=>[k,(op as any)[k]])), fromAnchor:op.fromAnchor, toAnchor:op.toAnchor, lane:op.lane, style: op.style, from: op.from, to: op.to, kind: op.kind ?? 'arr', route: op.route ?? 'auto', mid: op.mid ?? null, bend: op.bend ?? 0,
				head: op.head ?? 'end', label: op.label ?? '', extra: op.extra ?? [],
			} });
			break;
		case 'node': {
			const n = node(op.id);
			if (n) {
				if (op.titlePosition !== undefined && ANCHORS.includes(op.titlePosition)) { n.titlePosition = op.titlePosition; }
				if (op.icon !== undefined) { n.icon = op.icon; }
				if (op.iconPosition !== undefined) { n.iconPosition = op.iconPosition; }
				if (op.title !== undefined) { n.title = op.title; }
				if (op.code !== undefined) { n.code = op.code; }
				if (op.cat !== undefined && op.cat !== n.cat && (!op.cat || !findStyle(fig, op.cat) || findStyle(fig, op.cat)!.kind === nodeStyleKind(n))) {
						const kind = nodeStyleKind(n);
						if (kind && n.style) { for (const k of STYLEABLE[kind]) { delete (n.style as any)[k]; } }
						n.cat = op.cat;
					}
				if (op.width !== undefined && op.width > 0) { n.width = op.width; delete n.wantWidth; }
                if(op.wantWidth !== undefined && op.wantWidth>0)n.wantWidth=op.wantWidth;
                if(op.codeFont !== undefined)n.codeFont=op.codeFont || undefined;
				if (op.minh !== undefined && op.minh >= 0) { n.minh = op.minh; }
			}
			break;
		}
		case 'arrow': {
			const e = edges(fig)[op.index];
			if (e) {
    if(e.route==='fixed' && e.chain && ['from','to','fromAnchor','toAnchor','fromOffset','toOffset'].some(k=>(op as any)[k]!==undefined)){e.waypoints=specialGeometry(fig,e)?.pts.slice(1,-1);delete e.chain;}
				for (const key of ['from','to','fromAnchor','toAnchor','lane'] as const) { if (op[key] !== undefined) { if (key==='lane' && op[key]===null) delete e.lane; else (e as any)[key]=op[key]; } }
				if (op.styleKey !== undefined) { if (e.style) { for (const k of STYLEABLE.arrow) { delete (e.style as any)[k]; } } if (op.styleKey) { e.styleKey = op.styleKey; e.kind = 'arr'; } else { delete e.styleKey; } }
					if (op.kind !== undefined) { e.kind = op.kind; if (e.style) { delete e.style.border; } }
				if (op.route !== undefined) { e.route = op.route; if(op.route!=='fixed'){delete e.chain;delete e.waypoints;} }
    for(const key of ['fromOffset','toOffset','loopSide','loopSize','loopOut','loopIn','looseness','loopMax','chain','waypoints'] as const)if(op[key]!==undefined){if(key==='chain' && op[key]===null)delete e.chain;else (e as any)[key]=op[key];}
    if(op.loopSide!==undefined){for(const k of ['fromAnchor','toAnchor','fromOffset','toOffset'])delete (e as any)[k];}
    if(op.resetAuto){e.route='auto';e.mid=null;e.bend=0;for(const k of ['fromAnchor','toAnchor','fromOffset','toOffset','chain','waypoints','loopSide','loopSize','loopOut','loopIn','looseness','loopMax','lane'])delete (e as any)[k];}
				if (op.mid !== undefined) { e.mid = op.mid; }
				if (op.bend !== undefined) { e.bend = op.bend; }
				if (op.head !== undefined) { e.head = op.head; if (e.style) { delete e.style.start; delete e.style.end; } }
				if (op.label !== undefined) { e.label = op.label; }
			}
			break;
		}
		case 'deleteNode':
			for (const child of nodes(fig)) { if (child.attachment?.parent === op.id) { delete child.attachment; } }
			fig.lines = fig.lines.filter(l => !(l.t === 'node' && l.n.id === op.id)
				&& !(l.t === 'edge' && (l.e.from === op.id || l.e.to === op.id)));
			break;
		case 'deleteEdge': {
			const e = edges(fig)[op.index];
			fig.lines = fig.lines.filter(l => !(l.t === 'edge' && l.e === e));
			break;
		}
		case 'addCategory':
			apply(fig, { op: 'styleAdd', kind: 'box', key: op.key, name: op.name, props: { fill: op.color }, icon: op.icon, boxes: op.boxes, legend: op.legend ?? true });
			break;
		case 'category':
			apply(fig, { op: 'styleEdit', key: op.key, name: op.name, icon: op.icon, boxes: op.boxes, legend: op.legend, props: op.color !== undefined ? { fill: op.color } : undefined });
			break;
		case 'deleteCategory':
			apply(fig, { op: 'styleDelete', key: op.key });
			break;
		case 'batch': {
			// Move parents first so a selection moves once, regardless of selection order.
			const depth = (id: string): number => {
				const seen = new Set<string>(); let n = node(id);
				while (n?.attachment && !seen.has(n.id)) { seen.add(n.id); n = node(n.attachment.parent); }
				return seen.size;
			};
			const moves = op.ops.filter(o => o.op === 'move').sort((a, b) => depth(a.id) - depth(b.id));
			for (const o of op.ops) { apply(fig, o.op === 'move' ? moves.shift()! : o); }
			break;
		}
		case 'reorder': {
			// node lines take the new order (bottom to top); everything else stays where it is
			const at = fig.lines.map((l, i) => l.t === 'node' ? i : -1).filter(i => i >= 0);
			const byId = new Map(nodes(fig).map(n => [n.id, n]));
			const order = [...new Set(op.order.filter(id => byId.has(id))), ...nodes(fig).map(n => n.id).filter(id => !op.order.includes(id))];
			at.forEach((i, k) => { fig.lines[i] = { t: 'node', n: byId.get(order[k])! }; });
			break;
		}
		case 'addGroup': {
   const g: Group = { fill:op.fill ?? (!op.frame ? 'tint' : undefined),fillStrength:op.fillStrength,outline:op.outline ?? (!op.frame ? 'dashed' : undefined),labelStyle:op.labelStyle, padding:op.padding,titlePosition:op.titlePosition ?? 'above-left',titleBold:op.titleBold ?? true,titleFont:op.titleFont,titleColor:op.titleColor,lineWidth:op.lineWidth,frameColor:op.frameColor,id: op.id, name: op.name, frame: op.frame || 'dashed', color: op.color || 'grey', parent: op.parent || '' };
   insert(fig,{t:'group',g});if(!op.frame) newDefaultGroups.add(g);
			break;
  }
		case 'groupProps': {
			const g = groups(fig).find(x => x.id === op.id);
			if (g) {
				for (const key of Object.keys(groupDefaults)) { if ((op as any)[key] !== undefined) (g as any)[key]=(op as any)[key]; }
				if (op.name !== undefined) { g.name = op.name; }
				if (op.frame !== undefined) { g.frame = op.frame; newDefaultGroups.delete(g); }
				if (op.color !== undefined) { g.color = op.color; }
				if (op.parent !== undefined && op.parent !== g.id) { g.parent = op.parent; }
    if(g.frame==='none' && op.frame===undefined){if(g.outline && g.outline!=='none')g.frame='solid';else if(g.fill && g.fill!=='none')g.frame='region';}
			}
			break;
		}
		case 'deleteGroup': {
			const g = groups(fig).find(x => x.id === op.id);
			if (g) {
				for (const n of nodes(fig)) { if (n.group === g.id) { n.group = g.parent; } }
				for (const c of groups(fig)) { if (c.parent === g.id) { c.parent = g.parent; } }
				fig.lines = fig.lines.filter(l => !(l.t === 'group' && l.g === g) && !(l.t==='edge' && (l.e.from===g.id || l.e.to===g.id)));
			}
			break;
		}
		case 'setGroup':
			for (const n of nodes(fig)) { if (op.ids.includes(n.id)) { n.group = op.group; } }
			for (const g of groups(fig)) { if (op.ids.includes(g.id) && g.id !== op.group) { g.parent = op.group; } }
   const target=groups(fig).find(g=>g.id===op.group);if(target && newDefaultGroups.has(target) && groups(fig).some(g=>g.parent===target.id && g.frame!=='none')) {target.frame='solid';target.fill='none';target.outline='solid';}
			break;
		case 'hide':
			for (const n of nodes(fig)) { if (op.ids.includes(n.id)) { n.hidden = op.hidden; } }
			break;
		case 'lock':
			for (const n of nodes(fig)) { if (op.ids.includes(n.id)) { n.locked = op.locked; } }
			break;
		case 'arrows': {
			const f = fig.lines.find(l => l.t === 'arrowsflag');
			if (f && f.t === 'arrowsflag') {
				f.style = op.style;
			} else {
				insert(fig, { t: 'arrowsflag', style: op.style });
			}
			break;
		}
		case 'legend': {
			const f = fig.lines.find(l => l.t === 'legendflag');
			if (f && f.t === 'legendflag') {
				f.on = op.on;
			} else {
				insert(fig, { t: 'legendflag', on: op.on });
			}
			break;
		}
	}
 settle(fig);
 for(const n of nodes(fig))normalizeWidth(fig,n);
	resolveAttachments(fig);
}

// A new figure: self-contained, everything it needs is defined inside the picture.
export const TEMPLATE = String.raw`% Sakuga figure
% sakuga style box work {this work} peach legend
% sakuga legend on
\begin{tikzpicture}[x=1mm, y=1mm, font=\sffamily\small]
\end{tikzpicture}
`;

// Operations that add the boxes, arrows and categories of a pasted TikZ snippet, with fresh ids,
// shifted by (dx, dy). Lines that are not Sakuga boxes or arrows are ignored.
export function pasteOps(fig: Figure, text: string, dx: number, dy: number): { ops: Op[]; ids: string[] } {
	const src = parse(text);
	const ops: Op[] = [];
	const have = new Set(styleDefs(fig).map(d => d.key));
	for (const d of styleDefs(src)) {
		if (!have.has(d.key)) {
			ops.push({ op: 'styleAdd', kind: d.kind, key: d.key, name: d.name, props: d.props, icon: d.icon, boxes: d.boxes, legend: d.legend });
			have.add(d.key);
		}
	}
	const used = new Set([...nodes(fig).map(n => n.id),...groups(fig).map(g=>g.id)]);
	let next = 1;
	const fresh = () => {
		while (used.has(`n${next}`)) { next++; }
		used.add(`n${next}`);
		return `n${next}`;
	};
	const map = new Map<string, string>();
 for(const g of groups(src)) map.set(g.id,fresh());
 for(const g of groups(src)) ops.push({op:'addGroup',...g,id:map.get(g.id)!,parent:map.get(g.parent)||'',titlePosition:g.titlePosition || 'legacy',titleBold:g.titleBold ?? false});
	for (const n of nodes(src)) {
		const id = fresh();
		map.set(n.id, id);
		ops.push({
			op: 'addNode', titlePosition:n.titlePosition, id, x: n.x + dx, y: n.y + dy, title: n.title, icon: n.icon, iconPosition: n.iconPosition, kind: n.kind, code: n.code,
			wantWidth:n.wantWidth, codeFont:n.codeFont, style: n.style, extra: n.extra, cat: have.has(n.cat) ? n.cat : '', width: n.width, minh: n.minh,
		});
	}
	for (const n of nodes(src)) { if(map.has(n.group)) ops.push({op:'setGroup',ids:[map.get(n.id)!],group:map.get(n.group)!}); }
	for (const n of nodes(src)) { if (n.attachment && map.has(n.attachment.parent)) { ops.push({op:'attach',id:map.get(n.id)!,attachment:{...n.attachment,parent:map.get(n.attachment.parent)!}}); } }
	for (const e of edges(src)) {
		const a = map.get(e.from), b = map.get(e.to);
		if (a && b) {
			ops.push({ op: 'addEdge', fromOffset:e.fromOffset,toOffset:e.toOffset,loopSide:e.loopSide,loopSize:e.loopSize,loopOut:e.loopOut,loopIn:e.loopIn,looseness:e.looseness,loopMax:e.loopMax,...(e.route==='fixed'?{waypoints:specialGeometry(src,e)?.pts.slice(1,-1).map((p:number[])=>[p[0]+dx,p[1]+dy])}:{}), fromAnchor:e.fromAnchor,toAnchor:e.toAnchor,lane:e.lane, styleKey: e.styleKey && have.has(e.styleKey) ? e.styleKey : undefined, labelStyle:e.labelStyle,labels:e.labels,style: e.style, extra: e.extra, from: a, to: b, kind: e.kind, route: e.route, mid: e.mid === null ? null : e.mid + (e.route==='hvh' || (e.route==='u' && /east|west/.test(e.fromAnchor || '')) ? dx : dy), bend: e.bend, head: e.head, label: e.label });
		}
	}
	return { ops, ids: nodes(src).map(n=>map.get(n.id)!) };
}
