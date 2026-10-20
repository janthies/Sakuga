import * as fs from 'node:fs';
import * as path from 'node:path';
import { JSDOM } from 'jsdom';
import { ROOT, read } from './env';

// The body of page() in src/extension.ts (copied; the CSP, fonts and stylesheets do not matter here).
const BODY = `<header id="bar"><button id="drawerToggle" class="tbtn"></button><button id="addBox" class="tool"></button><button id="addLabel" class="tool"></button><span id="addIcon" class="tool"><span class="lbl">Icon</span></span><button id="help"></button><table id="keys"></table><button id="exportSvg"></button></header>
<div id="main"><aside id="drawer"><div class="drawer-in"><textarea id="src"></textarea><details id="preamble"><summary></summary><div class="pre-body"><pre id="pre"></pre><button id="copyPre"></button></div></details><button id="copySrc"></button></div></aside>
<div id="desk"><svg id="canvas"></svg><div id="zoombar"><span id="zi-size"></span><span id="zi-zoom"></span><button id="fitw"></button></div></div>
<aside id="sidebar" data-tab="figure"><nav id="tabs"><button data-tab="figure" role="tab">Figure</button><button data-tab="selection" role="tab">Selection<span id="tab-count"></span></button></nav><div id="inspector"></div><div id="splitter"></div><section id="layers"><header class="lhead"><div id="layer-tools"><button id="group"></button><button id="ungroup"></button></div></header><div id="layer-list"></div></section></aside></div>
<input id="edit" type="text"><div id="etools"></div>`;

// Scripts in the order page() loads them.
const SCRIPTS = ['routes.js', 'text.js', 'sketch.js', 'editor.js'];

export const VIEWPORT = { width: 1200, height: 800 };
export const VIEW = { s: 4, ox: 100, oy: 400 };

export interface Canvas {
	window: any;
	hook: any;
	svg: string;
	sent: any[];
	frames: Map<number, () => void>;
	saved: () => any;
}

// Deterministic stand-in for canvas measureText: the advance tables of media/text.js, so widths do not depend on a font.
function measureWidth(text: any, font: string, SakugaText: any): number {
	const m = /([\d.]+)px '([^']+)'/.exec(font)!;
	const pt = (parseFloat(m[1]) * 72.27) / 96;
	return (SakugaText.mm(text, pt, m[2] === 'Sakuga Mono' ? 'mono' : 'sans') * 96) / 25.4;
}

// Boot the real media scripts in jsdom, post the icons and state messages the host would send, and return the canvas.
// onPost sees every message the webview sends to the host (the interactive tests answer ops with a new state).
export function boot(
	state: any,
	icons: unknown[],
	onPost?: (m: any, canvas: Canvas) => void,
	initialSaved?: unknown,
): Canvas {
	const dom = new JSDOM(`<!DOCTYPE html><html><body>${BODY}</body></html>`, { runScripts: 'outside-only' });
	const w: any = dom.window;
	const sent: any[] = [];
	w.__sakugaTestHook = true;
	let saved: any = initialSaved;
	const frames = new Map<number, () => void>();
	let frame = 0;
	w.requestAnimationFrame = (fn: () => void) => {
		frames.set(++frame, fn);
		return frame;
	};
	w.cancelAnimationFrame = (id: number) => {
		frames.delete(id);
	};
	w.Element.prototype.setPointerCapture = () => {};
	w.Element.prototype.scrollIntoView = () => {};
	let canvas: Canvas;
	w.acquireVsCodeApi = () => ({
		postMessage: (m: any) => {
			sent.push(m);
			onPost?.(m, canvas);
		},
		getState: () => saved,
		setState: (s: any) => {
			saved = s;
		},
	});
	w.document.fonts = { load: () => Promise.resolve([]) };
	w.ResizeObserver = class {
		observe() {}
		disconnect() {}
	};
	const rect = { x: 0, y: 0, left: 0, top: 0, right: VIEWPORT.width, bottom: VIEWPORT.height, ...VIEWPORT };
	const none = { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
	w.Element.prototype.getBoundingClientRect = function () {
		return this.id === 'canvas' || this.id === 'desk' ? rect : none;
	};
	const context = {
		font: '',
		measureText(t: string) {
			return { width: measureWidth(t, this.font, w.SakugaText) };
		},
	};
	w.HTMLCanvasElement.prototype.getContext = () => context;
	for (const f of SCRIPTS) {
		w.eval(read(`media/${f}`));
	}
	const post = (data: unknown) =>
		w.dispatchEvent(new w.MessageEvent('message', { data: JSON.parse(JSON.stringify(data)) }));
	post({ type: 'icons', icons });
	post(state);
	const hook = w.__sakugaTest;
	hook.setView(VIEW);
	hook.render();
	canvas = { window: w, hook, svg: w.document.getElementById('canvas').outerHTML, sent, frames, saved: () => saved };
	return canvas;
}
