import * as vscode from 'vscode';
import { DEFAULT_SETTINGS, Settings } from '../settings';
import type { ClipboardPort, DocumentPort, FilePort, SettingsPort, UiPort, WebviewPort } from '../ports';
import type { ToHost, ToWebview } from '../../bridge/protocol';

export function documentPort(doc: vscode.TextDocument): DocumentPort {
	return {
		path: doc.uri.path,
		text: () => doc.getText(),
		version: () => doc.version,
		async replace(start, end, text) {
			const edit = new vscode.WorkspaceEdit();
			edit.replace(doc.uri, new vscode.Range(doc.positionAt(start), doc.positionAt(end)), text);
			await vscode.workspace.applyEdit(edit);
		},
		onChange(f) {
			return vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document.uri.toString() === doc.uri.toString()) {
					f();
				}
			});
		},
	};
}

export function webviewPort(webview: vscode.Webview): WebviewPort {
	return {
		post: (message: ToWebview) => void webview.postMessage(message),
		onMessage: (f) => webview.onDidReceiveMessage((m: ToHost) => f(m)),
	};
}

export const clipboardPort: ClipboardPort = {
	writeText: async (text) => {
		await vscode.env.clipboard.writeText(text);
	},
};

// No configuration is contributed yet; the section lookup falls back to the defaults.
export const settingsPort: SettingsPort = {
	get: <K extends keyof Settings>(key: K): Settings[K] =>
		vscode.workspace.getConfiguration('sakuga').get<Settings[K]>(key, DEFAULT_SETTINGS[key]),
	onChange: (f) => vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('sakuga') && f()),
};

export function uiPort(log: vscode.OutputChannel): UiPort {
	return {
		status: (message, ms) =>
			void (ms === undefined
				? vscode.window.setStatusBarMessage(message)
				: vscode.window.setStatusBarMessage(message, ms)),
		error: (message) => void vscode.window.showErrorMessage(message),
		log: (line) => log.appendLine(line),
		progress: (title, task) =>
			Promise.resolve(vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title }, task)),
		async saveAs(defaultPath, extension, label) {
			const target = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(`${defaultPath}.${extension}`),
				filters: { [label]: [extension] },
			});
			return target?.fsPath;
		},
	};
}

export const filePort: FilePort = {
	write: (path, bytes) => Promise.resolve(vscode.workspace.fs.writeFile(vscode.Uri.file(path), bytes)),
};
