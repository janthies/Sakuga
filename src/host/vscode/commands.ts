import * as vscode from 'vscode';
import { parse, serialize, TEMPLATE } from '../../tikz';

export const SKETCH_COMMANDS = [
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
];

export async function newFigure() {
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
