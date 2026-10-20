import * as vscode from 'vscode';
import { setIcons, Icon } from './tikz';
import { newFigure, SKETCH_COMMANDS } from './host/vscode/commands';
import { FigureEditorProvider } from './host/vscode/editorProvider';

export async function activate(context: vscode.ExtensionContext) {
	const log = vscode.window.createOutputChannel('Sakuga');
	const file = vscode.Uri.joinPath(context.extensionUri, 'icons', 'icons.json');
	const icons: Icon[] = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf8'));
	setIcons(icons);
	const editor = new FigureEditorProvider(context.extensionUri, icons, log);
	for (const command of SKETCH_COMMANDS) {
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

export function deactivate() {}
