import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

const run = promisify(execFile);

// Sets the figure with LuaLaTeX in the look of the thesis (Open Sans, Courier, 11 pt) and converts
// the PDF to SVG, so the SVG shows exactly what the PDF in Overleaf will show.
export async function exportSvg(
	doc: vscode.TextDocument,
	tikz: string,
	preamble: string,
	media: vscode.Uri,
	log: vscode.OutputChannel,
) {
	const base = doc.uri.path.replace(/\.sakuga\.tikz$/, '').replace(/\.tikz$/, '');
	const target = await vscode.window.showSaveDialog({
		defaultUri: doc.uri.with({ path: `${base}.svg` }),
		filters: { SVG: ['svg'] },
	});
	if (!target) {
		return;
	}
	const fonts = media.fsPath.replace(/\\/g, '/');
	const tex = [
		'\\documentclass[11pt, border=1mm]{standalone}',
		'\\usepackage{fontspec}',
		`\\setsansfont{OpenSans-Regular.ttf}[Path=${fonts}/, AutoFakeBold=2, AutoFakeSlant=0.2]`,
		`\\setmonofont{texgyrecursor-regular.otf}[Path=${fonts}/]`,
		'\\usepackage{tikz}',
		preamble,
		'\\begin{document}',
		tikz,
		'\\end{document}',
		'',
	].join('\n');
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sakuga-'));
	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Window, title: 'Sakuga: exporting SVG' },
		async () => {
			await fs.writeFile(path.join(dir, 'fig.tex'), tex);
			try {
				await run('nice', ['-n', '19', 'lualatex', '-interaction=nonstopmode', '-halt-on-error', 'fig.tex'], {
					cwd: dir,
					timeout: 120000,
				});
			} catch {
				const out = await fs.readFile(path.join(dir, 'fig.log'), 'utf8').catch(() => '');
				const err = out.split('\n').find((l) => l.startsWith('!')) ?? 'LuaLaTeX failed';
				log.appendLine(`export: ${err} (files in ${dir})`);
				vscode.window.showErrorMessage(`Sakuga: SVG export failed: ${err}`);
				return;
			}
			await run('pdftocairo', ['-svg', 'fig.pdf', 'fig.svg'], { cwd: dir });
			await vscode.workspace.fs.writeFile(target, await fs.readFile(path.join(dir, 'fig.svg')));
			await fs.rm(dir, { recursive: true, force: true });
			vscode.window.setStatusBarMessage(`Sakuga: saved ${path.basename(target.fsPath)}`, 3000);
		},
	);
}
