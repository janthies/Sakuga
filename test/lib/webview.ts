import { page } from '../../src/host/page';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { JSDOM } from 'jsdom';
import { ROOT, read } from './env';

const BODY = page({ cspSource: '', nonce: 'test', uri: (f) => f }, { preamble: '' })
	.split('<body>')[1]
	.split('<script')[0]
	.replace(' aria-label="Figure canvas"', '');

// Scripts in the order page() loads them.
const SCRIPTS = ['dist/webview.js'];

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
	// jsdom's window has no TextEncoder; a browser does (the codec's hex helpers use it).
	w.TextEncoder = TextEncoder;
	w.TextDecoder = TextDecoder;
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
