import { parse } from '../core/codec/parse';
import { exportTarget, documentPt } from '../core/model/export';
import type { DocumentPort, FilePort, SettingsPort, TexRunner, UiPort } from './ports';

// The LaTeX file for the export: the look of the thesis (Open Sans, Courier, 11 pt).
export function buildTex(
	tikz: string,
	preamble: string,
	fontsDir: string,
	defaults?: import('../core/model/export').ExportTarget,
): string {
	const target = exportTarget(parse(tikz, defaults));
	const fonts = fontsDir.replace(/\\/g, '/');
	return [
		`\\documentclass[${documentPt(target.width)}pt, border=1mm]{standalone}`,
		'\\usepackage{fontspec}',
		`\\setsansfont{OpenSans-Regular.ttf}[Path=${fonts}/, AutoFakeBold=2, AutoFakeSlant=0.2]`,
		`\\setmonofont{texgyrecursor-regular.otf}[Path=${fonts}/]`,
		'\\usepackage{tikz}',
		'\\usepackage{graphicx}',
		preamble,
		'\\begin{document}',
		`\\setlength{\\linewidth}{${target.width}mm}`,
		tikz,
		'\\end{document}',
		'',
	].join('\n');
}

export interface ExportDeps {
	tex: TexRunner;
	ui: UiPort;
	files: FilePort;
	settings: SettingsPort;
	fontsDir: string;
}

// Sets the figure with LuaLaTeX and converts the PDF to SVG, so the SVG shows exactly what the PDF in Overleaf will show.
export async function exportSvg(deps: ExportDeps, doc: DocumentPort, tikz: string): Promise<void> {
	const base = doc.path.replace(/\.sakuga\.tikz$/, '').replace(/\.tikz$/, '');
	const target = await deps.ui.saveAs(base, 'svg', 'SVG');
	if (!target) {
		return;
	}
	const tex = buildTex(tikz, deps.settings.get('preamble'), deps.fontsDir, {
		width: deps.settings.get('export.width'),
		font: deps.settings.get('export.font'),
	});
	await deps.ui.progress('Sakuga: exporting SVG', async () => {
		const result = await deps.tex.run({
			tex,
			fontsDir: deps.fontsDir,
			output: 'svg-pdftocairo',
			timeoutMs: deps.settings.get('exportTimeoutMs'),
		});
		if (!result.ok) {
			deps.ui.log(`export: ${result.error} (${result.log})`);
			deps.ui.error(`Sakuga: SVG export failed: ${result.error}`);
			return;
		}
		await deps.files.write(target, result.file);
		deps.ui.status(`Sakuga: saved ${target.split(/[\\/]/).pop()}`, 3000);
	});
}
