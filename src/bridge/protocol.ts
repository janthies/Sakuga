// The messages between the extension host and the webview, exactly as they travel today (discriminated by `type`).
// Only types and one constant: this module imports nothing but core/model types, so both sides may share it.
// TODO(S10 and later): replace the derived 'state' snapshot by { t: 'doc'; text; version } and the webview parsing the text
// itself (docs/architecture.md section 2, ADR-2). Until then these types must describe today's traffic and nothing more.

/** Bumped whenever a message changes shape. The webview announces it in 'ready'. */
export const PROTOCOL = 1;

/** The derived snapshot of the document (see core/view/viewModel.ts); object shapes stay loose until core/model types them. */
export interface StateMessage {
	type: 'state';
	text: string;
	nodes: Record<string, any>[];
	edges: Record<string, any>[];
	categories: Record<string, any>[];
	styles: Record<string, any>[];
	shared: Record<string, any>[];
	groups: Record<string, any>[];
	layers: Record<string, any>[];
	font: string;
	legend: boolean;
	arrows: string;
	palette: Record<string, { name: string; hex: string; mix: number }>;
	defaultWidth: number;
}

/** Host to webview. `I` is the icon type, `S` the sketch command names. */
export type ToWebview<I = unknown> =
	| StateMessage
	| { type: 'icons'; icons: I[] }
	| { type: 'select'; ids: string[] }
	| { type: 'sketch'; command: string; preview: boolean };

/** Webview to host. `O` is the op type of core/ops. `protocol` is optional because webviews before S7 do not send it. */
export type ToHost<O = unknown> =
	| { type: 'ready'; protocol?: number }
	| { type: 'op'; op: O }
	| { type: 'text'; text: string }
	| { type: 'paste'; text: string; dx: number; dy: number; layer: string }
	| { type: 'copy' }
	| { type: 'copyText'; text: string }
	| { type: 'exportSvg' }
	| { type: 'error'; text: string };

/** True when the webview speaks this protocol; a 'ready' without a number is a pre-S7 webview and passes. */
export const compatible = (ready: { protocol?: number }): boolean =>
	ready.protocol === undefined || ready.protocol === PROTOCOL;
