import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { itemById, nodes, items, resolveLook } from '../../src/core';

const source = () =>
	figure([
		['a', 0, 0, { cat: 'work' }],
		['b', 60, 0, {}],
	]);
const select = (s: Session, id: string) => {
	s.down(0, 0, s.node(id));
	s.up(0, 0);
};

test('selection rows are flat, More remembers its state, and groups only show name and count', () => {
	const s = new Session(source());
	select(s, 'a');
	assert.deepEqual(
		s.all('#inspector summary').map((e) => e.textContent),
		['More'],
	);
	const more = s.inspector.querySelector('details');
	assert.equal(more.open, false);
	more.open = true;
	more.dispatchEvent(new s.window.Event('toggle'));
	select(s, 'b');
	assert.equal(s.inspector.querySelector('details').open, true);
	assert.equal(s.row('Category').children[0].textContent, 'Category');
	assert.equal(/title/i.test(s.inspector.textContent), false);
	s.apply({ op: 'addGroup', id: 'g', name: 'Things' });
	s.apply({ op: 'setGroup', ids: ['a'], group: 'g' });
	s.click(s.document.querySelector('[data-id="g"]'));
	assert.match(s.inspector.querySelector('.insp-head').textContent, /^Group · Things/);
	assert.deepEqual(
		s.all('#inspector .row').map((e) => e.children[0].textContent),
		['Name', 'Members'],
	);
});

test('line widths commit on Enter and blur, retain categories and reset through the cascade', () => {
	const s = new Session(source());
	select(s, 'a');
	const width = () => s.row('Line width').querySelector('input');
	const before = s.ops.length;
	width().value = '1.35';
	width().dispatchEvent(new s.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	assert.equal(nodes(s.fig()).find((n) => n.id === 'a')!.style!.lineWidth, 1.35);
	assert.equal(nodes(s.fig()).find((n) => n.id === 'a')!.cat, 'work');
	assert.equal(s.ops.length, before + 1);
	width().dispatchEvent(new s.window.Event('blur'));
	assert.equal(s.ops.length, before + 1, 'Enter followed by blur commits once');
	width().value = '0.9';
	width().dispatchEvent(new s.window.Event('blur'));
	assert.equal(resolveLook(s.fig(), 'a').lineWidth.value, 0.9);
	s.click(s.row('Line width').querySelector('.reset-prop'));
	assert.equal(resolveLook(s.fig(), 'a').lineWidth.source, 'theme');
	assert.ok(s.row('Line width').querySelector('.inherited'));
	assert.equal(s.row('Line width').querySelector('.num').title, 'Theme');
});

test('Line inspector and six-slot labels edit the tree in one operation', () => {
	const s = new Session(source());
	s.apply({
		op: 'addLine',
		id: 'l',
		start: [0, 30],
		end: [50, 30],
		labels: [{ text: 'Above', style: { side: 'above' } }],
	});
	s.down(25, 30, '[data-line="l"]');
	s.up(25, 30);
	assert.match(s.inspector.querySelector('.insp-head').textContent, /^Line/);
	const width = s.row('Width').querySelector('input');
	width.value = '1.1';
	width.dispatchEvent(new s.window.Event('blur'));
	assert.equal(resolveLook(s.fig(), 'l').lineWidth.value, 1.1);
	const child = items(s.fig()).find((i) => i.parent === 'l' && i.kind === 'Text');
	s.click(s.document.querySelector(`[data-id="${child.id}"]`));
	const picker = s.inspector.querySelector('.line-slots');
	assert.equal(picker.querySelectorAll('button').length, 6);
	const before = s.ops.length;
	s.click(picker.querySelector('[aria-label="end below"]'));
	assert.equal(s.ops.length, before + 1);
	assert.equal(s.lastOp.op, 'slot');
	assert.equal(itemById(s.fig(), child.id)!.slot, 'end-below');
});

test('figure settings, category rows, and editable figure source', () => {
	const s = new Session(source());
	assert.deepEqual(
		s.all('#inspector summary').map((e) => e.textContent),
		['Figure settings'],
	);
	assert.equal(s.inspector.querySelector('details').open, false);
	assert.ok(s.inspector.querySelector('.categories'));
	assert.ok(s.inspector.querySelector('.category-delete'));
	s.click(s.inspector.querySelector('.category-delete'));
	assert.equal(s.sent.at(-1).type, 'deleteCategory');
	const grid = s.row('Grid').querySelector('input');
	grid.value = '0';
	grid.dispatchEvent(new s.window.Event('blur'));
	assert.equal(s.saved.grid, 0);
	select(s, 'a');
	s.down(0, 0, s.node('a'));
	s.move(1.25, 0);
	s.up(1.25, 0);
	assert.ok(Math.abs(nodes(s.fig()).find((n) => n.id === 'a')!.x - 1.25) < 1e-8);
	const caption = s.document.querySelector('#figure-env input[aria-label="Caption"]');
	caption.value = 'A useful figure';
	caption.dispatchEvent(new s.window.Event('change'));
	assert.equal(s.fig().figure!.caption, 'A useful figure');
	s.click(s.document.getElementById('copyFigure'));
	assert.match(s.sent.at(-1).text, /\\caption\{A useful figure\}/);
	assert.equal(s.document.getElementById('preview').disabled, true);
});

test('Label and Icon numeric widths commit on blur; path Label look changes reach the canvas', () => {
	for (const kind of ['label', 'icon']) {
		const s = new Session(figure([['n', 0, 0, { kind, icon: kind === 'icon' ? 'board' : '' }]]));
		select(s, 'n');
		const width = s.row('Line width').querySelector('input');
		width.value = '0.85';
		width.dispatchEvent(new s.window.Event('blur'));
		assert.equal(resolveLook(s.fig(), 'n').lineWidth.value, 0.85);
	}
	const s = new Session(source());
	s.apply({ op: 'addLine', id: 'path', start: [0, 40], end: [40, 40], labels: [{ text: 'Note' }] });
	s.down(20, 40, '[data-line="path"]');
	s.up(20, 40);
	const child = items(s.fig()).find((i) => i.parent === 'path' && i.kind === 'Text')!;
	s.click(s.document.querySelector(`[data-id="${child.id}"]`));
	const colour = s.row('Colour');
	s.click(colour.querySelector('[aria-label="blue"]'));
	const label = items(s.fig()).find((i) => i.id === child.id)!;
	assert.equal(label.kind === 'Text' && label.placement!.color, 'blue');
	assert.ok(s.svg.querySelector('[data-text]'));
});
