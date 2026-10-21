import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parse } from '../src/core/codec/parse';
import { serialize } from '../src/core/codec/serialize';
import { apply } from '../src/core/ops/apply';
import { exportTarget, exportTextPt } from '../src/core/model/export';
import { buildTex } from '../src/host/exportService';
import { scaleGeometry } from '../src/core/codec/export';
import { nodes } from '../src/core/model/queries';
import { fontSize } from '../src/core/model/queries';

const source = String.raw`\begin{tikzpicture}[x=1mm, y=1mm]
\node[sg shape, text width=26mm] (a) at (0,0) {Application};
\node[sg shape, text width=26mm] (b) at (180,0) {System};
\end{tikzpicture}`;

test('export settings migrate, follow configured defaults, and survive repeated edits', () => {
	const fig = parse('% sakuga sheet 88\n' + source);
	assert.equal(exportTarget(fig).width, 88);
	apply(fig, { op: 'export', width: 180, font: 'footnotesize' });
	const text = serialize(fig);
	assert.match(text, /^% sakuga export width=180 font=footnotesize/);
	assert.doesNotMatch(text, /sakuga sheet/);
	assert.equal(fontSize(parse(text)), 'footnotesize');
	assert.equal(nodes(fig).find((n) => n.kind === 'label')?.style?.font, 'footnotesize');
	assert.equal(serialize(parse(text)), text);
	const defaults = { width: 88, font: 'footnotesize' };
	const inherited = parse(source, defaults);
	assert.equal(fontSize(inherited), 'footnotesize');
	assert.doesNotMatch(serialize(inherited), /% sakuga export/);
	assert.deepEqual(exportTarget(inherited), defaults);
});

test('adaptive output uses a clamped geometry unit and shrink-only safety net', () => {
	const text = serialize(parse(source));
	assert.match(text, /max\(0.8,min\(1,\\linewidth\//);
	assert.match(text, /x=\\sgu, y=\\sgu/);
	assert.match(text, /text width=26\\sgu/);
	assert.match(text, /\\ifdim\\wd0>\\linewidth\\resizebox/);
	assert.match(text, /Latex\[length=1.5mm, width=1.2mm\]/);
	assert.match(text, /inner xsep=3pt/);
	assert.doesNotMatch(text, /f@size/);
	assert.match(text, /\\def\\sgcode#1\{\{\\footnotesize/);
	assert.equal(
		scaleGeometry(
			String.raw`\node[xshift=2mm,minimum height=6mm,line width=0.4mm,inner sep=1mm,-{Latex[length=2mm]}] {};`,
		),
		String.raw`\node[xshift=2\sgu,minimum height=6\sgu,line width=0.4mm,inner sep=1mm,-{Latex[length=2mm]}] {};`,
	);
});

test('standalone export chooses document size and linewidth from the target', () => {
	const fig = parse(source);
	apply(fig, { op: 'export', width: 180, font: 'footnotesize' });
	const tex = buildTex(serialize(fig), '', '/fonts');
	assert.match(tex, /documentclass\[10pt/);
	assert.match(tex, /setlength\{\\linewidth\}\{180mm\}/);
	assert.match(tex, /usepackage\{graphicx\}/);
	assert.equal(exportTextPt({ width: 146, font: 'small' }, 100), 10);
	assert.equal(exportTextPt({ width: 88, font: 'footnotesize' }, 88), 8);
	assert.ok(exportTextPt({ width: 88, font: 'footnotesize' }, 200) < 7);
});
