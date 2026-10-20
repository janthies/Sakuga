import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadIcons } from '../lib/env';

// LuaLaTeX probe of Tidy up (ported from the end of scripts/check-tidy.cjs): the widened line fits and a wrapped box retains frame padding.
const t = loadIcons();
const text = require('../../src/shared').text;
const near = (a, b, tol = 0.03) => assert(Math.abs(a - b) < tol, `${a} != ${b}`);
const fresh = () => t.parse(t.TEMPLATE),
	add = (f, id, x, y, more = {}) => t.apply(f, { op: 'addNode', id, x, y, title: id, cat: '', width: 26, ...more });
test('LuaLaTeX: tiny code advance agrees within 0.01 mm; wrapped box keeps frame padding', () => {
	{
		const { execFileSync } = require('node:child_process'),
			dir = path.resolve(__dirname, '../../work/tidy/check-tex'),
			media = path.resolve(__dirname, '../../media');
		fs.mkdirSync(dir, { recursive: true });
		const f = fresh();
		add(f, 'wrapped', 0, 0, { title: 'Several words wrap into many lines', width: 16 });
		add(f, 'code', 70, 0, { title: 'Code', code: 'tee\\_attest\\_get\\_token', codeFont: 'tiny' });
		t.apply(f, { op: 'addGroup', id: 'frame', name: '', frame: 'dashed', padding: 3 });
		t.apply(f, { op: 'setGroup', ids: ['wrapped'], group: 'frame' });
		const probe = String.raw`\path (wrapped.north) \pgfextra{\pgfgetlastxy{\x}{\y}\typeout{SGNORTH=\y}};
\path (wrapped.south) \pgfextra{\pgfgetlastxy{\x}{\y}\typeout{SGSOUTH=\y}};
`;
		const body =
			t
				.serialize(f)
				.replace(
					String.raw`\sgcode{tee\_attest\_get\_token}`,
					String.raw`\sgcode{\typeout{SGCODEFONT=\csname f@size\endcsname}tee\_attest\_get\_token}`,
				)
				.replace('\\end{tikzpicture}', probe + '\n\\end{tikzpicture}') +
			String.raw`\newsavebox{\sgmeasure}\sbox{\sgmeasure}{\tiny\ttfamily tee\_attest\_get\_token}\typeout{SGCODE=\the\wd\sgmeasure}`;
		fs.writeFileSync(
			dir + '/fig.tex',
			[
				String.raw`\documentclass[11pt,border=1mm]{standalone}\usepackage{fontspec}`,
				`\\setsansfont{OpenSans-Regular.ttf}[Path=${media}/,AutoFakeBold=2,AutoFakeSlant=0.2]`,
				`\\setmonofont{texgyrecursor-regular.otf}[Path=${media}/]`,
				String.raw`\usepackage{tikz}\usetikzlibrary{arrows.meta,fit,backgrounds,svg.path,shapes.geometric,patterns}\begin{document}`,
				body,
				'\\end{document}',
			].join('\n'),
		);
		const cache = path.join(dir, 'cache');
		fs.mkdirSync(cache, { recursive: true });
		execFileSync('nice', ['-n', '19', 'lualatex', '-interaction=batchmode', '-halt-on-error', 'fig.tex'], {
			cwd: dir,
			env: { ...process.env, TEXMFVAR: cache, TEXMFCACHE: cache },
			stdio: 'inherit',
			timeout: 120000,
		});
		const log = fs.readFileSync(dir + '/fig.log', 'utf8'),
			value = (key) => (+new RegExp(key + '=(-?[\\d.]+)pt').exec(log)[1] * 25.4) / 72.27;
		const b = t.routeObjects(f).find((n) => n.id === 'frame');
		assert(b.y + b.h / 2 - value('SGNORTH') > 2.9);
		assert(value('SGSOUTH') - (b.y - b.h / 2) > 2.9);
		assert(/SGCODEFONT=6(?:\.0)?\s/.test(log), 'Per-box code size reaches TeX');
		near(value('SGCODE'), text.mm('tee_attest_get_token', 6, 'mono'), 0.01);
		assert(value('SGCODE') <= t.nodes(f).find((n) => n.id === 'code').width);
		console.log('LuaLaTeX: tiny code advance agrees within 0.01 mm; wrapped box keeps frame padding.');
	}
});
