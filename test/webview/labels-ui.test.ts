import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { BOX_SLOTS } from '../../src/core/model/slots';
import { nodes, itemById, parse } from '../../src/core';

const source = () =>
	figure(
		[
			['parent', 0, 0, { width: 80, minh: 60 }],
			['label', 100, 80, { kind: 'label', width: 10 }],
		],
		[],
		[
			{ op: 'reparent', id: 'label', newParent: 'parent' },
			{ op: 'slot', id: 'label', slot: 'above' },
		],
	);
test('drag a child through all 25 zones; each drop commits a slot, never detaches', () => {
	const s = new Session(source());
	for (const [j, slot] of BOX_SLOTS.entries()) {
		const n = s.hook.state().nodes.find((n) => n.id === 'label'),
			p = s.hook.state().nodes.find((n) => n.id === 'parent'),
			size = s.hook.layout(p);
		const x = p.x + (((j % 5) - 2) * size.w) / 3,
			y = p.y + ((2 - Math.floor(j / 5)) * size.h) / 3;
		s.down(n.x, n.y, s.node('label'));
		s.move(x, y);
		assert.equal(s.hook.drag().slots.slot, slot);
		assert.equal(
			s.svg.querySelectorAll('[data-overlay] rect').length >= 25 || s.svg.querySelectorAll('rect').length >= 25,
			true,
		);
		s.up(x, y);
		assert.equal(s.lastOp.op, 'slot');
		assert.equal(s.lastOp.slot, slot);
		assert.equal(itemById(s.fig(), 'label')?.parent, 'parent');
	}
	const n = nodes(s.fig()).find((n) => n.id === 'label')!;
	s.down(n.x, n.y, s.node('label'));
	s.move(300, 300);
	s.up(300, 300);
	assert.equal(itemById(s.fig(), 'label')?.parent, 'parent');
});
test('slot picker, detach, subtree clipboard and parent previews', () => {
	const s = new Session(source()),
		label = () => s.hook.state().nodes.find((n) => n.id === 'label');
	let n = label();
	s.down(n.x, n.y, s.node('label'));
	s.up(n.x, n.y);
	const picker = s.inspector.querySelector('.box-slots');
	assert.ok(picker);
	assert.equal(picker.querySelectorAll('button').length, 25);
	s.click(picker.querySelector('button[aria-label="below right"]'));
	assert.equal(itemById(s.fig(), 'label')?.slot, 'below-right');
	const clip = parse(s.clipboard('copy').text);
	assert.deepEqual(
		nodes(clip).map((n) => n.id),
		['label'],
	);
	const old = label().x;
	s.down(0, 0, s.node('parent'));
	s.move(5, 4, { ctrlKey: true });
	assert.equal(label().x, old + 5);
	s.up(5, 4, { ctrlKey: true });
	n = label();
	s.down(n.x, n.y, s.node('label'));
	s.move(200, 200, { altKey: true });
	s.up(200, 200, { altKey: true });
	assert.equal(s.lastOp.ops[0].op, 'detach');
	assert.equal(itemById(s.fig(), 'label')?.slot, undefined);
});
test('parent is painted before its children even when payload order is reversed', () => {
	const s = new Session(source());
	const order = s.all('[data-node]').map((e) => e.getAttribute('data-node'));
	assert.ok(order.indexOf('parent') < order.indexOf('label'));
});
