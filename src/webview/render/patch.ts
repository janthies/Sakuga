// Patches an SVG element's children to match a list of keyed primitives: create what is new, update the attributes and
// text that differ, move what changed place, remove what is gone. Elements whose primitive did not change are not touched.
import type { Prim, PrimKind } from '../../core/scene';
import { hitAttrs } from './hit';

const NS = 'http://www.w3.org/2000/svg';

interface Rec {
	el: Element;
	kind: PrimKind;
	attrs: Map<string, string>;
	text: string;
	kids: Map<string, Rec>;
}

export class Patcher {
	private kids = new Map<string, Rec>();
	constructor(readonly root: Element) {}

	patch(prims: Prim[]): void {
		this.sync(this.root, this.kids, prims);
	}

	private sync(parent: Element, kids: Map<string, Rec>, prims: Prim[]): void {
		const wanted = new Map(prims.map((p) => [p.key, p.kind]));
		for (const [key, rec] of kids) {
			if (wanted.get(key) !== rec.kind) {
				rec.el.remove();
				kids.delete(key);
			}
		}
		let cursor: ChildNode | null = parent.firstChild;
		for (const p of prims) {
			let rec = kids.get(p.key);
			if (!rec) {
				rec = { el: document.createElementNS(NS, p.kind), kind: p.kind, attrs: new Map(), text: '', kids: new Map() };
				kids.set(p.key, rec);
			}
			this.update(rec, p);
			if (rec.el === cursor) cursor = cursor.nextSibling;
			else parent.insertBefore(rec.el, cursor);
		}
	}

	private update(rec: Rec, p: Prim): void {
		const next: Record<string, string> = { ...hitAttrsOf(p) };
		for (const k in p.attrs) next[k] = String(p.attrs[k]);
		for (const k in next) {
			if (rec.attrs.get(k) !== next[k]) {
				rec.el.setAttribute(k, next[k]);
				rec.attrs.set(k, next[k]);
			}
		}
		for (const k of [...rec.attrs.keys()]) {
			if (!(k in next)) {
				rec.el.removeAttribute(k);
				rec.attrs.delete(k);
			}
		}
		if (p.kind === 'text') {
			const t = p.text ?? '';
			if (rec.text !== t || (!rec.el.firstChild && t)) {
				rec.el.textContent = t;
				rec.text = t;
			}
		}
		if (p.children || rec.kids.size) this.sync(rec.el, rec.kids, p.children ?? []);
	}
}

const hitAttrsOf = (p: Prim) => hitAttrs(p.hit);
