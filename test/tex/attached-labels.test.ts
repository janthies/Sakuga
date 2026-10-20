import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { start, sequence } from '../lib/attached-labels';
import { ROOT } from '../lib/env';

// Measured TikZ label positions (ported from the end of scripts/check-attached-labels.cjs): LuaLaTeX places the attached
// label and the frame title where the canvas of the real editor draws them.
test('LuaLaTeX: attached label and frame title sit where the canvas draws them', () => {
	const root = ROOT,
		work = path.join(root, 'work/attached-labels');
	fs.mkdirSync(work, { recursive: true });
	const s = start();
	const { expected, frame } = sequence(s);
	// Name generated native nodes only for probing; editor files retain their normal dialect.
	let output = s
		.canonical()
		.replace('node[sg elabel', 'node[name=probe, sg elabel')
		.replace('node[sg glabel', 'node[name=frameprobe, sg glabel');
	const probes = String.raw`\path (probe.center) \pgfextra{\pgfgetlastxy{\sgx}{\sgy}\typeout{LABEL=\sgx,\sgy}};
\path (frameprobe.south west) \pgfextra{\pgfgetlastxy{\sgx}{\sgy}\typeout{TITLE=\sgx,\sgy}};`;
	output = output.replace('\\end{tikzpicture}', probes + '\n\\end{tikzpicture}');
	fs.writeFileSync(
		path.join(work, 'figure.tex'),
		String.raw`\documentclass[11pt,border=1mm]{standalone}
\usepackage{fontspec}
\setsansfont{OpenSans-Regular.ttf}[Path=${root}/media/,AutoFakeBold=2,AutoFakeSlant=0.2]
\usepackage{tikz}
\usetikzlibrary{arrows.meta,fit,backgrounds,svg.path,shapes.geometric,patterns}
\begin{document}
` +
			output +
			'\n\\end{document}\n',
	);
	const cache = path.join(root, 'work/tex-cache');
	fs.mkdirSync(cache, { recursive: true });
	execFileSync('nice', ['-n', '19', 'lualatex', '-interaction=batchmode', '-halt-on-error', 'figure.tex'], {
		cwd: work,
		env: { ...process.env, TEXMFVAR: cache, TEXMFCACHE: cache },
		stdio: 'inherit',
		timeout: 120000,
	});
	const log = fs.readFileSync(path.join(work, 'figure.log'), 'utf8');
	for (const [key, point] of [
		['LABEL', expected],
		['TITLE', [frame.anchor[0] + 2, frame.anchor[1] + 3]],
	] as [string, number[]][]) {
		const m = new RegExp(`${key}=(-?[\\d.]+)pt,(-?[\\d.]+)pt`).exec(log);
		assert.ok(m, key);
		for (let k = 0; k < 2; k++)
			assert.ok(
				Math.abs((+m![k + 1] * 25.4) / 72.27 - point[k]) < 0.035,
				`${key} ${k}: ${(+m![k + 1] * 25.4) / 72.27} != ${point[k]}`,
			);
	}
});
