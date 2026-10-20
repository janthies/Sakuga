// The contract of every control in the kit: show a value (or the mixed state), report what the user commits.
export const MIXED = Symbol('mixed');
export type Mixed = typeof MIXED;
export const isMixed = (v: unknown): v is Mixed => v === MIXED;

export interface ControlState {
	// The shown value comes from the object's style, not from the object itself.
	inherited: boolean;
}

export interface Control<V> {
	readonly el: HTMLElement;
	set(value: V | Mixed, state?: ControlState): void;
	// null means the user cleared the control.
	onCommit(f: (value: V | null) => void): void;
}

// Shared plumbing: listeners and the inherited marker.
export abstract class Field<V> implements Control<V> {
	abstract readonly el: HTMLElement;
	private listeners: ((value: V | null) => void)[] = [];
	abstract set(value: V | Mixed, state?: ControlState): void;
	onCommit(f: (value: V | null) => void): void {
		this.listeners.push(f);
	}
	protected commit(value: V | null): void {
		for (const f of this.listeners) f(value);
	}
	protected mark(state?: ControlState): void {
		this.el.classList.toggle('inherited', !!state?.inherited);
	}
}

type Attr = string | number | boolean | undefined;

// A small element builder: `h('button', 'icon', { title: 'Close' }, 'x')`.
export function h<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className = '',
	attrs: Record<string, Attr> = {},
	...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
	const e = document.createElement(tag);
	if (className) e.className = className;
	for (const [k, v] of Object.entries(attrs)) {
		if (v === undefined || v === false) continue;
		e.setAttribute(k, v === true ? '' : String(v));
	}
	e.append(...children);
	return e;
}

// An element that also carries its value for tests and keyboard code (the old `.segments.value`).
export type ValueEl = HTMLElement & { value: string };
export const valueEl = (e: HTMLElement): ValueEl => Object.assign(e, { value: '' });

// A loose bag of style properties, as the ops carry them.
export type Style = Record<string, any>;
