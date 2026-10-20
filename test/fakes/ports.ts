// In-memory fakes of the host ports, for tests of the provider, the document sync and the export service.
import type { ToHost, ToWebview } from '../../src/bridge/protocol';

export class FakeDocument {
	path = '/work/fig.sakuga.tikz';
	edits: { start: number; end: number; text: string }[] = [];
	private listeners: (() => void)[] = [];
	private v = 1;
	constructor(private content: string) {}
	text = () => this.content;
	version = () => this.v;
	async replace(start: number, end: number, text: string) {
		this.edits.push({ start, end, text });
		this.content = this.content.slice(0, start) + text + this.content.slice(end);
		this.v++;
		this.listeners.forEach((f) => f());
	}
	onChange(f: () => void) {
		this.listeners.push(f);
		return { dispose: () => (this.listeners = this.listeners.filter((g) => g !== f)) };
	}
}

export class FakeWebview {
	posted: ToWebview[] = [];
	private listeners: ((m: ToHost) => void)[] = [];
	post = (m: ToWebview) => void this.posted.push(m);
	onMessage(f: (m: ToHost) => void) {
		this.listeners.push(f);
		return { dispose: () => (this.listeners = this.listeners.filter((g) => g !== f)) };
	}
	/** The webview sends a message; resolves after the host's async handling has had time to finish. */
	async send(m: ToHost) {
		this.listeners.forEach((f) => f(m));
		await new Promise((r) => setTimeout(r, 10));
	}
}

export class FakeClipboard {
	written: string[] = [];
	writeText = async (t: string) => void this.written.push(t);
}

export class FakeSettings {
	constructor(private values: object = {}) {}
	get = (k: string) => (this.values as any)[k];
	onChange = () => ({ dispose() {} });
}

export class FakeUi {
	statuses: string[] = [];
	errors: string[] = [];
	logs: string[] = [];
	saveTarget: string | undefined = '/out/fig.svg';
	saveRequests: [string, string][] = [];
	status = (m: string) => void this.statuses.push(m);
	error = (m: string) => void this.errors.push(m);
	log = (l: string) => void this.logs.push(l);
	progress = <T>(_title: string, task: () => Promise<T>) => task();
	saveAs = async (p: string, ext: string) => (this.saveRequests.push([p, ext]), this.saveTarget);
}

export class FakeFiles {
	written = new Map<string, Uint8Array>();
	write = async (p: string, b: Uint8Array) => void this.written.set(p, b);
}

export class FakeTex {
	jobs: any[] = [];
	result: any = { ok: true, file: new TextEncoder().encode('<svg/>') };
	run = async (job: any) => (this.jobs.push(job), this.result);
}
