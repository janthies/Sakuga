// What the host needs from its environment. VS Code adapters live in ./vscode and ./node, fakes in test/fakes.
import type { Settings } from './settings';
import type { ToHost, ToWebview } from '../bridge/protocol';

export interface Disposable {
	dispose(): void;
}

/** One text document. `replace` swaps the characters [start, end) for `text`, so callers can write minimal diffs. */
export interface DocumentPort {
	/** Path of the file, without a scheme; used to name exports. */
	readonly path: string;
	text(): string;
	version(): number;
	replace(start: number, end: number, text: string): Promise<void>;
	onChange(f: () => void): Disposable;
}

export interface TexJob {
	tex: string;
	fontsDir: string;
	output: 'pdf' | 'svg-pdftocairo' | 'svg-dvisvgm';
	timeoutMs: number;
}
export type TexResult = { ok: true; file: Uint8Array } | { ok: false; error: string; log: string };
export interface TexRunner {
	run(job: TexJob): Promise<TexResult>;
}

export interface ClipboardPort {
	writeText(text: string): Promise<void>;
}

export interface SettingsPort {
	get<K extends keyof Settings>(key: K): Settings[K];
	onChange(f: () => void): Disposable;
}

export interface UiPort {
	status(message: string, ms?: number): void;
	error(message: string): void;
	log(line: string): void;
	/** Shows progress while `task` runs. */
	progress<T>(title: string, task: () => Promise<T>): Promise<T>;
	/** Asks where to save; `defaultPath` is the suggested path without extension. Undefined when cancelled. */
	saveAs(defaultPath: string, extension: string, label: string): Promise<string | undefined>;
}

export interface FilePort {
	write(path: string, bytes: Uint8Array): Promise<void>;
}

/** The channel to one webview, typed by the bridge. */
export interface WebviewPort {
	post(message: ToWebview): void;
	onMessage(f: (message: ToHost) => void): Disposable;
}
