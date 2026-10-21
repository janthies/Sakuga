import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Session } from '../lib/session';

const source = String.raw`\begin{tikzpicture}[x=1mm,y=1mm]
\node[sg shape] (a) at (0,0) {Application};
\end{tikzpicture}`;
test('export preset updates font, figure environment, status and optional width band', () => {
	const s = new Session(source);
	assert.match(s.document.getElementById('zi-size').textContent, /export 146 mm · text 10 pt/);
	assert.equal(s.document.querySelector('[data-key="target-band"]'), null);
	const preset = s.inspector.querySelector('[aria-label="Export preset"]');
	preset.value = '180';
	preset.dispatchEvent(new s.window.Event('change'));
	assert.deepEqual(s.fig().export, { width: 180, font: 'footnotesize' });
	s.click(s.document.getElementById('copyFigure'));
	assert.match(s.sent.at(-1).text, /\\begin\{figure\*\}/);
	assert.match(s.document.getElementById('zi-size').textContent, /export 180 mm · text 8 pt/);
	const button = s.document.getElementById('target-band');
	s.click(button);
	assert.equal(button.getAttribute('aria-pressed'), 'true');
	assert.ok(s.document.querySelector('.grid rect[opacity="0.06"]'));
	s.click(button);
	assert.equal(button.getAttribute('aria-pressed'), 'false');
});
