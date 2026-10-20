import * as vscode from 'vscode';
import { exportSvg } from './export';
import { apply, Op, parse, pasteOps, serialize, setIcons, Icon, TEMPLATE } from './tikz';
import { statePayload } from './state';

const log = vscode.window.createOutputChannel('Sakuga');
const PREAMBLE = '\\usetikzlibrary{arrows.meta, fit, backgrounds, svg.path, shapes.geometric, patterns}';

export async function activate(context: vscode.ExtensionContext) {
	const icons: Icon[] = JSON.parse(
		Buffer.from(
			await vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, 'icons', 'icons.json')),
		).toString('utf8'),
	);
	setIcons(icons);
	const editor = new FigureEditor(context.extensionUri, icons);
	for (const command of [
		'left',
		'centerX',
		'right',
		'top',
		'centerY',
		'bottom',
		'distributeX',
		'distributeY',
		'sameW',
		'sameH',
		'tidy',
	]) {
		context.subscriptions.push(
			vscode.commands.registerCommand(`sakuga.sketch.${command}`, (args) => editor.sketch(command, !!args?.preview)),
		);
	}
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider('sakuga.figure', editor, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		vscode.commands.registerCommand('sakuga.newFigure', newFigure),
	);
}

async function newFigure() {
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
	const uri = folder
		? await nextFree(folder)
		: await vscode.window.showSaveDialog({ filters: { 'Sakuga figure': ['sakuga.tikz'] } });
	if (!uri) {
		return;
	}
	await vscode.workspace.fs.writeFile(uri, Buffer.from(serialize(parse(TEMPLATE))));
	await vscode.commands.executeCommand('vscode.openWith', uri, 'sakuga.figure');
}

async function nextFree(folder: vscode.Uri): Promise<vscode.Uri> {
	for (let i = 1; ; i++) {
		const uri = vscode.Uri.joinPath(folder, `figure${i}.sakuga.tikz`);
		try {
			await vscode.workspace.fs.stat(uri);
		} catch {
			return uri;
		}
	}
}

// Replace only the part of the document that changed, so the text editor keeps its place.
async function write(doc: vscode.TextDocument, text: string) {
	const old = doc.getText();
	if (old === text) {
		return;
	}
	let a = 0;
	while (a < old.length && a < text.length && old[a] === text[a]) {
		a++;
	}
	let b = 0;
	while (b < old.length - a && b < text.length - a && old[old.length - 1 - b] === text[text.length - 1 - b]) {
		b++;
	}
	const edit = new vscode.WorkspaceEdit();
	edit.replace(
		doc.uri,
		new vscode.Range(doc.positionAt(a), doc.positionAt(old.length - b)),
		text.slice(a, text.length - b),
	);
	await vscode.workspace.applyEdit(edit);
}

class FigureEditor implements vscode.CustomTextEditorProvider {
	private readonly panels = new Set<vscode.WebviewPanel>();
	sketch(command: string, preview = false) {
		const panel = [...this.panels].find((p) => p.active);
		if (panel) {
			panel.webview.postMessage({ type: 'sketch', command, preview });
		}
	}

	constructor(
		private readonly root: vscode.Uri,
		private readonly icons: Icon[],
	) {}

	async resolveCustomTextEditor(doc: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		this.panels.add(panel);
		panel.onDidDispose(() => this.panels.delete(panel));
		const media = vscode.Uri.joinPath(this.root, 'media');
		panel.webview.options = { enableScripts: true, localResourceRoots: [media] };
		panel.webview.html = page(panel.webview, media);

		const send = () => {
			panel.webview.postMessage(statePayload(doc.getText()));
		};
		const changed = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() === doc.uri.toString()) {
				send();
			}
		});
		panel.onDidDispose(() => changed.dispose());

		panel.webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case 'ready':
					panel.webview.postMessage({ type: 'icons', icons: this.icons });
					send();
					break;
				case 'op': {
					const fig = parse(doc.getText());
					apply(fig, msg.op as Op);
					await write(doc, serialize(fig));
					break;
				}
				case 'error':
					log.appendLine(`webview: ${msg.text}`);
					break;
				case 'exportSvg':
					await exportSvg(doc, serialize(parse(doc.getText())), PREAMBLE, vscode.Uri.joinPath(this.root, 'media'), log);
					break;
				case 'copyText':
					await vscode.env.clipboard.writeText(msg.text);
					vscode.window.setStatusBarMessage('Sakuga: preamble copied', 2000);
					break;
				case 'copy':
					await vscode.env.clipboard.writeText(serialize(parse(doc.getText())));
					vscode.window.setStatusBarMessage('Sakuga: TikZ copied', 2000);
					break;
				case 'text':
					await write(doc, msg.text);
					break;
				case 'paste': {
					const fig = parse(doc.getText());
					const { ops, ids } = pasteOps(fig, msg.text, msg.dx, msg.dy);
					if (ids.length) {
						apply(fig, { op: 'batch', ops: ops.map((op) => (op.op === 'addNode' ? { ...op, layer: msg.layer } : op)) });
						await write(doc, serialize(fig));
						panel.webview.postMessage({ type: 'select', ids });
					}
					break;
				}
			}
		});

		if (doc.getText().trim() === '') {
			await write(doc, serialize(parse(TEMPLATE)));
		}
	}
}

function page(webview: vscode.Webview, media: vscode.Uri): string {
	const uri = (f: string) => webview.asWebviewUri(vscode.Uri.joinPath(media, f));
	const nonce = Math.random().toString(36).slice(2);
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
@font-face { font-family: 'Sakuga Sans'; src: url('${uri('OpenSans-Regular.ttf')}'); }
@font-face { font-family: 'Sakuga Mono'; src: url('${uri('texgyrecursor-regular.otf')}'); }
</style>
<link rel="stylesheet" href="${uri('codicons.css')}">
<link rel="stylesheet" href="${uri('editor.css')}">
</head>
<body>
<header id="bar">
	<button id="drawerToggle" class="tbtn" aria-label="TikZ source and preamble" aria-pressed="false" aria-controls="drawer" title="TikZ source and preamble"><i class="ci ci-menu"></i></button>
	<span class="vsep"></span>
	<button id="addBox" class="tool" title="Place a box"><i class="ci ci-add"></i>Box</button>
	<button id="addLabel" class="tool" title="Place a free text label"><i class="ci ci-add"></i>Label</button>
	<span id="addIcon" class="tool" title="Place a free icon"><span class="lbl">Icon</span></span>
	<span class="grow"></span>
	<button id="help" class="tbtn" aria-label="Keyboard shortcuts" aria-controls="keys"><i class="ci ci-question"></i></button>
	<table id="keys"></table>
	<button id="exportSvg" title="Set the figure with LuaLaTeX in the look of your thesis and save it as SVG"><i class="ci ci-export"></i>Export SVG</button>
</header>
<div id="main">
	<aside id="drawer" aria-label="TikZ source">
		<div class="drawer-in">
			<div class="phead" title="The figure itself. Paste it where the figure goes, for example inside a figure environment.">
				<span>TikZ source</span><button id="copySrc"><i class="ci ci-copy"></i>Copy</button>
			</div>
			<textarea id="src" aria-label="TikZ source" spellcheck="false"></textarea>
			<details id="preamble">
				<summary title="Goes once into the preamble of your document, before \\begin{document}. Without these libraries the figure does not compile."><i class="ci ci-chevron-right"></i>Preamble</summary>
				<div class="pre-body"><pre id="pre">${PREAMBLE}</pre><button id="copyPre"><i class="ci ci-copy"></i>Copy</button></div>
			</details>
		</div>
	</aside>
	<div id="desk">
		<svg id="canvas" aria-label="Figure canvas"></svg>
		<div id="zoombar"><span id="zi-size"></span><span class="vsep"></span><span id="zi-zoom" title="100 % is true size on screen"></span><button id="fitw" title="Fit the whole figure">Fit</button></div>
	</div>
	<aside id="sidebar" data-tab="figure">
		<nav id="tabs" role="tablist"><button role="tab" data-tab="figure" aria-selected="true">Figure</button><button role="tab" data-tab="selection">Selection<span id="tab-count"></span></button></nav>
		<div id="inspector"></div>
		<div id="splitter" role="separator" tabindex="0" aria-label="Resize Layers panel" aria-orientation="horizontal" title="Drag to resize, double-click to reset"></div>
		<section id="layers"><header class="lhead"><h3>Layers</h3><div id="layer-tools"><button id="group">Group</button><button id="ungroup">Ungroup</button></div></header><div id="layer-list" role="tree" aria-label="Layers"></div></section>
	</aside>
</div>
<input id="edit" type="text" spellcheck="false">
<div id="etools"></div>
<script nonce="${nonce}" src="${uri('dist/shared.js')}"></script>
<script nonce="${nonce}" src="${uri('editor.js')}"></script>
</body>
</html>`;
}
