import * as assert from 'node:assert/strict';
import { boot, VIEW, Canvas } from './webview';
import { loadIcons, read } from './env';

const t = loadIcons();
const { viewModel: statePayload } = require('../../src/core/view/viewModel');
const ICONS = JSON.parse(read('icons/icons.json'));

export type Mods = { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean };

// An interactive webview: the real media scripts in jsdom, answered by a host that applies every posted op to the document
// text and sends the new state back, as src/extension.ts does. Tests drive it with DOM events and read the DOM, the posted
// messages, the document text and the read-only accessors of window.__sakugaTest.
export class Session {
	doc: string;
	canvas: Canvas;
	/** Every message the webview sent, in order (ready, op, paste, ...). */
	readonly sent: any[];
	/** Ops the webview posted; the host has already applied them when the call returns. */
	readonly ops: any[] = [];
	readonly window: any;
	readonly hook: any;
	readonly document: any;
	readonly svg: any;
	private palette: unknown;
	/** `palette` replaces the colour table in every state the host sends; `saved` is the webview's persisted state (vscode.getState). */
	constructor(text: string = t.serialize(t.parse(t.TEMPLATE)), opts: { palette?: unknown; saved?: unknown } = {}) {
		this.doc = text;
		this.palette = opts.palette;
		this.canvas = boot(this.payload(text), ICONS, (m) => this.host(m), opts.saved);
		this.sent = this.canvas.sent;
		this.window = this.canvas.window;
		this.hook = this.canvas.hook;
		this.document = this.window.document;
		this.svg = this.document.getElementById('canvas');
	}
	private host(m: any) {
		if (m.type === 'op') {
			this.ops.push(m.op);
			const fig = t.parse(this.doc);
			t.apply(fig, m.op);
			this.write(t.serialize(fig));
		} else if (m.type === 'paste') {
			const fig = t.parse(this.doc);
			const { ops, ids } = t.pasteOps(fig, m.text, m.dx, m.dy, m.layer);
			if (ids.length) {
				t.apply(fig, {
					op: 'batch',
					ops: ops.map((op: any) => (op.op === 'addNode' ? { ...op, layer: m.layer } : op)),
				});
				this.write(t.serialize(fig));
				this.message({ type: 'select', ids });
			}
		}
	}
	private payload(text: string) {
		const p = statePayload(text);
		return this.palette ? { ...p, palette: this.palette } : p;
	}
	private write(text: string) {
		this.doc = text;
		this.message(this.payload(text));
	}
	/** What the webview stored with vscode.setState. */
	get saved() {
		return this.canvas.saved();
	}
	/** Deliver a message to the webview like the host's postMessage. */
	message(data: unknown) {
		this.window.dispatchEvent(new this.window.MessageEvent('message', { data: JSON.parse(JSON.stringify(data)) }));
	}
	/** Replace the document (an undo or an edit of the file elsewhere) and send the new state. */
	setDoc(text: string) {
		this.write(text);
	}
	/** Apply an op on the host side (as an edit of the file) and send the new state. */
	apply(op: any) {
		const fig = t.parse(this.doc);
		t.apply(fig, op);
		this.write(t.serialize(fig));
	}
	/** The document as a model. */
	fig() {
		return t.parse(this.doc);
	}
	/** Assert that the document is canonical (parse and serialize reproduce it) and return it. */
	canonical() {
		assert.equal(t.serialize(t.parse(this.doc)), this.doc);
		return this.doc;
	}
	/** The last op the webview posted. */
	get lastOp() {
		return this.ops[this.ops.length - 1];
	}
	popOp() {
		return this.ops.pop();
	}
	get selection(): { nodes: string[]; edges: number[]; group: string | null; label: any; key: string | null } {
		return JSON.parse(JSON.stringify(this.hook.selection()));
	}
	get inspector() {
		return this.document.getElementById('inspector');
	}

	/** Client coordinates of a point in mm under the fixed test view. */
	client(x: number, y: number) {
		return { clientX: VIEW.ox + x * VIEW.s, clientY: VIEW.oy - y * VIEW.s };
	}
	private fire(target: any, type: string, init: any = {}) {
		const w = this.window;
		const ev = new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
		Object.defineProperty(ev, 'pointerId', { value: 1 });
		target.dispatchEvent(ev);
		return ev;
	}
	/** A pointer event at (x, y) mm on `target` (an element, a selector inside the canvas, or the bare canvas). */
	pointer(
		type: 'pointerdown' | 'pointermove' | 'pointerup',
		x: number,
		y: number,
		target: any = this.svg,
		mods: Mods & { button?: number } = {},
	) {
		const el = typeof target === 'string' ? this.svg.querySelector(target) : target;
		assert.ok(el, `no element ${target}`);
		return this.fire(el, type, { ...this.client(x, y), ...mods });
	}
	down(x: number, y: number, target?: any, mods?: Mods) {
		return this.pointer('pointerdown', x, y, target, mods);
	}
	move(x: number, y: number, mods?: Mods) {
		return this.pointer('pointermove', x, y, this.svg, mods);
	}
	up(x: number, y: number, mods?: Mods) {
		return this.pointer('pointerup', x, y, this.svg, mods);
	}
	dblclick(x: number, y: number, target: any = this.svg, mods: Mods = {}) {
		const el = typeof target === 'string' ? this.svg.querySelector(target) : target;
		assert.ok(el, `no element ${target}`);
		return this.fire(el, 'dblclick', { ...this.client(x, y), ...mods });
	}
	/** Drag from (x0, y0) on `target` to (x1, y1); the pointer-up carries `upMods`. */
	drag(x0: number, y0: number, target: any, x1: number, y1: number, mods: Mods = {}, upMods: Mods = mods) {
		this.down(x0, y0, target, mods);
		this.move(x1, y1, mods);
		return this.up(x1, y1, upMods);
	}
	/** A key on the document; returns whether the editor handled it (preventDefault). */
	key(key: string, mods: Mods & { code?: string; isComposing?: boolean } = {}, type: 'keydown' | 'keyup' = 'keydown') {
		const ev = new this.window.KeyboardEvent(type, {
			key,
			code: mods.code ?? (key.length === 1 ? 'Key' + key.toUpperCase() : key),
			bubbles: true,
			cancelable: true,
			...mods,
		});
		this.document.dispatchEvent(ev);
		return ev.defaultPrevented;
	}
	/** A key in the in-canvas text field (#edit). */
	editKey(key: string) {
		const ev = new this.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
		const input = this.document.getElementById('edit');
		input.dispatchEvent(ev);
		// A browser drops focus from an element that gets hidden; jsdom does not.
		if (input.style.display === 'none' && this.document.activeElement === input) {
			input.blur();
		}
		return ev;
	}
	/** A clipboard event on the document with a fake DataTransfer; returns what the editor put on it. */
	clipboard(type: 'copy' | 'cut' | 'paste', text = '') {
		const ev = new this.window.Event(type, { bubbles: true, cancelable: true });
		const data: Record<string, string> = { 'text/plain': text };
		(ev as any).clipboardData = {
			setData: (k: string, v: string) => {
				data[k] = v;
			},
			getData: (k: string) => data[k] ?? '',
		};
		this.document.dispatchEvent(ev);
		return { text: data['text/plain'], handled: ev.defaultPrevented };
	}
	click(el: any, mods: Mods = {}) {
		return this.fire(el, 'click', mods);
	}
	/** The canvas element of an object. */
	node(id: string) {
		return this.svg.querySelector(`[data-node="${id}"],[data-text="${id}"]`);
	}
	/** All elements in the document matching a selector. */
	all(sel: string): any[] {
		return [...this.document.querySelectorAll(sel)];
	}
	/** The inspector row with this label (the text of its first element). */
	row(name: string): any {
		const r = this.all('#inspector .row').find((r) => r.children[0].textContent === name);
		assert.ok(r, `no inspector row ${name}`);
		return r;
	}
	button(label: string, root: any = this.document): any {
		return [...root.querySelectorAll('button')].find(
			(b: any) => b.textContent === label || b.title === label || b.getAttribute('aria-label') === label,
		);
	}
}
