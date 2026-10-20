declare function acquireVsCodeApi(): { postMessage(m: unknown): void; getState(): any; setState(s: unknown): void };
export const vscode = acquireVsCodeApi();

export function initPlatformHost() {
	window.addEventListener('error', (e) =>
		vscode.postMessage({ type: 'error', text: `${e.message} (${e.lineno}:${e.colno})` }),
	);
}
