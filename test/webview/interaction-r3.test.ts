import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { loadIcons } from '../lib/env';
import { arrangeRoutes } from '../../src/core/layout/arrange-routes';
import { geometryOf } from '../../src/core/geometry/figure-geometry';
const t = loadIcons();
const clickNode = (s: Session, id: string, x = 0) => {
	s.down(x, 0, s.node(id));
	s.up(x, 0);
};

test('selected press preserves the selection for dragging and narrows on release; Shift toggles', () => {
	const s = new Session(
		figure([
			['a', 0, 0],
			['b', 60, 0],
		]),
	);
	clickNode(s, 'a');
	s.down(60, 0, s.node('b'), { shiftKey: true });
	s.up(60, 0);
	s.down(0, 0, s.node('a'));
	assert.deepEqual(s.selection.nodes, ['a', 'b']);
	s.move(10, 5);
	s.up(10, 5);
	assert.deepEqual(s.selection.nodes, ['a', 'b']);
	assert.equal(s.lastOp.ops.length, 2);
	s.down(10, 5, s.node('a'));
	assert.deepEqual(s.selection.nodes, ['a', 'b']);
	s.up(10, 5);
	assert.deepEqual(s.selection.nodes, ['a']);
	s.down(10, 5, s.node('a'), { shiftKey: true });
	s.up(10, 5);
	assert.deepEqual(s.selection.nodes, []);
});

test('wheel opens without a document change, creates at the pointer, and Ctrl chords do not open it', () => {
	const s = new Session(figure([['a', 0, 0]]));
	s.dblclick(80, 40);
	assert.equal(s.ops.length, 0);
	const wheel = s.document.querySelector('.creation-wheel');
	assert.equal(wheel.hidden, false);
	assert.deepEqual(
		[...wheel.querySelectorAll('button')].map((b: any) => b.textContent),
		['Box', 'Label', 'Line', 'Icon'],
	);
	s.click(s.button('Line', wheel));
	assert.equal(s.lastOp.op, 'addLine');
	assert.deepEqual(Array.from(s.lastOp.start), [80, 40]);
	assert.equal(s.document.querySelector('#addBox'), null);
	s.key('Control', { ctrlKey: true });
	s.key('Control', {}, 'keyup');
	assert.equal(wheel.hidden, false);
	s.key('Escape');
	s.key('Control', { ctrlKey: true });
	s.key('c', { ctrlKey: true });
	s.key('Control', {}, 'keyup');
	assert.equal(wheel.hidden, true);
});

test('second click selects the centre Label; Escape selects its box; layer click selects its items', () => {
	const s = new Session(
		figure([
			['a', 0, 0],
			['b', 60, 0],
		]),
	);
	const title = () => s.svg.querySelector('[data-text][data-parent="a"]');
	s.down(0, 0, title());
	s.up(0, 0);
	assert.deepEqual(s.selection.nodes, ['a']);
	s.down(0, 0, title());
	s.up(0, 0);
	assert.deepEqual(s.selection.nodes, ['a-title']);
	s.key('Escape');
	assert.deepEqual(s.selection.nodes, ['a']);
	s.key('Escape');
	assert.deepEqual(s.selection.nodes, []);

	s.click(s.document.querySelector('.container-layer'));
	assert.ok(s.selection.nodes.includes('a') && s.selection.nodes.includes('b'));
});

test('Shift+Enter stores a TeX line break and Enter commits a canvas title', () => {
	const s = new Session(figure([['a', 0, 0]]));
	clickNode(s, 'a');
	s.key('Enter');
	const input = s.document.getElementById('edit');
	input.value = 'First';
	input.setSelectionRange(5, 5);
	input.dispatchEvent(
		new s.window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }),
	);
	input.value += 'Second';
	s.editKey('Enter');
	assert.equal(t.nodes(s.fig()).find((n) => n.id === 'a-title').title, 'First\\\\Second');
	assert.ok(s.doc.includes('align=center'));
});

test('arrange repairs a hand route crossing another shape in the same batch', () => {
	const fig = t.parse(
		figure(
			[
				['a', 0, 0],
				['b', 80, 0],
				['obstacle', 40, 40],
			],
			[{ from: 'a', to: 'b', route: 'straight' }],
		),
	);
	const plan = arrangeRoutes(fig, { op: 'move', id: 'obstacle', x: 40, y: 0 });
	assert.equal(plan.op, 'batch');
	assert.equal(plan.ops.length, 2);
	t.apply(fig, plan);
	assert.equal(t.edges(fig)[0].route, 'auto');
	const geo = geometryOf(fig),
		g = geo.edge(t.edges(fig)[0]);
	assert.ok(g.pts.some((p: number[]) => Math.abs(p[1]) > 5));
});

test('an attached icon selects immediately, moves independently, and Escape climbs once then clears', () => {
	const s = new Session(
		figure(
			[
				['parent', 0, 0],
				['child', 0, 0, { kind: 'icon', icon: 'board' }],
			],
			[],
			[
				{
					op: 'attach',
					id: 'child',
					attachment: { parent: 'parent', anchor: 'center', ownAnchor: 'center', dx: 0, dy: 0 },
				},
			],
		),
	);
	s.down(0, 0, s.node('child'));
	assert.deepEqual(s.selection.nodes, ['child']);
	s.move(8, 4, { ctrlKey: true });
	s.up(8, 4, { ctrlKey: true });
	const nodes = t.nodes(s.fig());
	assert.equal(nodes.find((n: any) => n.id === 'parent').x, 0);
	assert.equal(nodes.find((n: any) => n.id === 'child').slot, 'right');
	s.key('Escape');
	assert.deepEqual(s.selection.nodes, ['parent']);
	s.key('Escape');
	assert.deepEqual(s.selection.nodes, []);
});

test('a child selected before its parent moves once with the parent', () => {
	const s = new Session(
		figure(
			[
				['parent', 0, 0],
				['child', 0, 0, { kind: 'icon', icon: 'board' }],
			],
			[],
			[
				{
					op: 'attach',
					id: 'child',
					attachment: { parent: 'parent', anchor: 'center', ownAnchor: 'center', dx: 0, dy: 0 },
				},
			],
		),
	);
	clickNode(s, 'child');
	s.down(0, 0, s.node('parent'), { shiftKey: true });
	s.up(0, 0);
	s.down(0, 0, s.node('child'));
	s.move(12, 7, { ctrlKey: true });
	s.up(12, 7, { ctrlKey: true });
	const nodes = t.nodes(s.fig());
	assert.equal(nodes.find((n: any) => n.id === 'parent').x, 12);
	assert.equal(nodes.find((n: any) => n.id === 'child').x, 12);
	assert.equal(nodes.find((n: any) => n.id === 'child').slot, 'centre');
});

test('the context menu sends the selected box to the back with one command', () => {
	const s = new Session(
		figure([
			['a', 0, 0],
			['b', 60, 0],
		]),
	);
	clickNode(s, 'b', 60);
	s.node('b').dispatchEvent(
		new s.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...s.client(60, 0) }),
	);
	s.click(s.button('Send to back', s.document.querySelector('.canvas-menu')));
	assert.equal(s.lastOp.op, 'batch');
	assert.equal(s.lastOp.ops[0].id, 'b');
	assert.equal(s.lastOp.ops[0].index, 0);
});
