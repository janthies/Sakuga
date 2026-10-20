import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';

// Mixed values, custom colours, decorations and style copy/paste of boxes (ported from scripts/check-boxdeco-ui.cjs).
const PALETTE = { blue: { hex: 'BBCCEE', mix: 85 }, black: { hex: '000000', mix: 100 } };
const select = (s: Session, ...ids: string[]) => {
	ids.forEach((id, i) => {
		s.down(0, 0, s.node(id), { ctrlKey: i > 0 });
		s.up(0, 0, { ctrlKey: i > 0 });
	});
};
const change = (s: Session, el: any, value: string) => {
	el.value = value;
	el.dispatchEvent(new s.window.Event('change', { bubbles: true }));
};
const colourRow = (s: Session, index = 0) =>
	s.all('#inspector .row').filter((r) => r.children[0].textContent === 'Colour')[index];

test('mixed values, custom hex colours, recent colours and swatches', () => {
	const s = new Session(
		figure([
			['p', 0, 0, { style: { fill: 'blue' } }],
			['q', 40, 0, { style: { fill: '#112233', border: 'double' } }],
		]),
		{ palette: PALETTE, saved: { grid: 2, other: 'preserved' } },
	);
	select(s, 'p', 'q');
	const fill = () => colourRow(s);
	assert.equal(fill().querySelector('.colour-swatches').value, '*');
	assert.equal(s.row('Line').querySelector('.segments').value, '*');
	const ops = s.ops.length;
	const hex = () => fill().querySelector('input[type="color"]'),
		text = () => fill().querySelector('input[type="text"]');
	change(s, hex(), '#abcdef');
	assert.equal(s.lastOp.ops[0].style.fill, '#ABCDEF');
	assert.equal(s.saved.recentColors[0], '#ABCDEF');
	assert.equal(s.saved.grid, 2);
	assert.equal(s.saved.other, 'preserved');
	change(s, text(), 'bad');
	assert.equal(s.ops.length, ops + 1, 'Invalid hex must not change the style');
	change(s, text(), '2468ac');
	assert.equal(s.lastOp.ops[0].style.fill, '#2468AC');
	// A second colour control offers the recent colours and applies a swatch.
	const outline = colourRow(s, 1);
	assert.ok(outline.querySelector('button[aria-label="#ABCDEF"]'), 'Recent colour offered as a swatch');
	s.click(outline.querySelector('button[aria-label="blue"]'));
	assert.equal(s.lastOp.ops[0].style.color, 'blue');
	assert.equal(
		outline.querySelector('button[aria-label="blue"]').style.getPropertyValue('--swatch'),
		'rgb(197,212,241)',
	);
	// Visual buttons keep the same operations.
	s.key('Escape');
	select(s, 'p');
	s.apply({ op: 'style', ids: ['p'], style: { shape: 'ellipse', text: 'bold' } });
	s.click(s.row('Shape').querySelector('button[aria-label="rectangle"]'));
	assert.equal(s.lastOp.ops[0].style.shape, 'rectangle');
	s.apply({ op: 'style', ids: ['p'], style: { shape: 'ellipse' } });
	assert.equal(s.row('Shape').querySelector('button[aria-label="ellipse"]').getAttribute('aria-pressed'), 'true');
	s.click(s.row('Text').querySelector('button[aria-label="italic"]'));
	assert.equal(s.lastOp.ops[0].style.text, 'bold-italic');
	// The custom hex field starts collapsed and opens focused.
	assert.equal(text().hidden, true, 'Custom hex field starts collapsed');
	s.click(fill().querySelector('button[aria-label="Custom hex colour"]'));
	assert.equal(text().hidden, false);
	assert.equal(s.document.activeElement, text());
});

test('canvas patterns, marks and double borders', () => {
	const s = new Session(
		figure([
			[
				'test',
				0,
				0,
				{
					width: 30,
					minh: 10,
					style: { pattern: 'crosshatch', mark: 'triangle', markCorner: 'sw', markSize: 'medium', border: 'double' },
				},
			],
		]),
	);
	assert.equal(s.svg.querySelector('#sg-pattern-test').getAttribute('width'), String(((3 * 25.4) / 72.27) * 4));
	const clipped = s.svg.querySelector('g[clip-path="url(#sg-clip-test)"]');
	assert.ok(clipped, 'Pattern and mark are clipped to the box outline');
	assert.equal(clipped.children[0].tagName, 'path');
	assert.equal(clipped.children[1].tagName, 'rect', 'Pattern overlays the mark, as in TikZ');
});

test('style copy and paste carry and clear decorations', () => {
	const style = {
		pattern: 'dots',
		patternColor: '#112233',
		mark: 'circle',
		markCorner: 'sw',
		markSize: 'medium',
		markColor: '#ABCDEF',
		border: 'double',
	};
	const s = new Session(
		figure([
			['source', 0, 0, { style }],
			['target', 40, 0, {}],
		]),
	);
	const copyPaste = () => {
		select(s, 'source');
		s.key('c', { ctrlKey: true, altKey: true, code: 'KeyC' });
		select(s, 'target');
		s.key('v', { ctrlKey: true, altKey: true, code: 'KeyV' });
	};
	copyPaste();
	const posted = s.lastOp.ops.find((o: any) => o.op === 'style').style;
	for (const key of Object.keys(style)) {
		assert.equal(posted[key], (style as any)[key], key);
	}
	s.apply({ op: 'style', ids: ['source'], style: Object.fromEntries(Object.keys(style).map((k) => [k, ''])) });
	copyPaste();
	assert.equal(s.lastOp.ops.find((o: any) => o.op === 'style').style.mark, '');
});
