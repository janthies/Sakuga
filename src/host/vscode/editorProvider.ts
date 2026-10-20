import * as vscode from 'vscode';
import type { Icon } from '../../core/model/figure';
import { page } from '../page';
import { nodeTexRunner } from '../node/texRunner';
import { openFigure } from '../provider';
import { clipboardPort, documentPort, filePort, settingsPort, uiPort, webviewPort } from './adapters';

// The CustomTextEditorProvider: builds the page and wires one document and one webview into openFigure().
export class FigureEditorProvider implements vscode.CustomTextEditorProvider {
	private readonly panels = new Set<vscode.WebviewPanel>();
	private readonly ui;

	constructor(
		private readonly root: vscode.Uri,
		private readonly icons: Icon[],
		log: vscode.OutputChannel,
	) {
		this.ui = uiPort(log);
	}

	sketch(command: string, preview = false) {
		const panel = [...this.panels].find((p) => p.active);
		if (panel) {
			panel.webview.postMessage({ type: 'sketch', command, preview });
		}
	}

	async resolveCustomTextEditor(doc: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		this.panels.add(panel);
		const media = vscode.Uri.joinPath(this.root, 'media');
		const webview = panel.webview;
		webview.options = { enableScripts: true, localResourceRoots: [media] };
		webview.html = page(
			{
				cspSource: webview.cspSource,
				uri: (f) => webview.asWebviewUri(vscode.Uri.joinPath(media, f)).toString(),
				nonce: Math.random().toString(36).slice(2),
			},
			{ preamble: settingsPort.get('preamble') },
		);
		const session = openFigure({
			doc: documentPort(doc),
			view: webviewPort(webview),
			clipboard: clipboardPort,
			ui: this.ui,
			icons: this.icons,
			tex: nodeTexRunner,
			files: filePort,
			settings: settingsPort,
			fontsDir: media.fsPath,
		});
		panel.onDidDispose(() => {
			this.panels.delete(panel);
			session.dispose();
		});
	}
}
