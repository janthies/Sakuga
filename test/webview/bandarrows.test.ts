import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { loadIcons } from '../lib/env';

// Canvas selection and clipboard regression checks (ported from scripts/check-bandarrows.cjs), driven through DOM events.
const t = loadIcons();
const box = { width: 10, minh: 6 };
const make = () =>
	new Session(
		figure(
			[
				['a', 0, 0, { ...box, title: 'A' }],
				['b', 100, 0, { ...box, title: 'B' }],
				['c', 200, 0, { ...box, title: 'C' }],
			],
			[
				{ from: 'a', to: 'b', route: 'straight', head: 'end', kind: 'arr', style: { color: 'blue' } },
				{ from: 'b', to: 'c', route: 'straight', head: 'both', kind: 'arr-dashed', style: { color: 'red' } },
			],
		),
	);

// Drag a rectangle on the empty canvas and return the selection (Ctrl keeps the old one).
const band = (s: Session, x0: number, x1: number, y0: number, y1: number, ctrl = false) => {
	s.down(x0, y0, s.svg, { ctrlKey: ctrl });
	s.move(x1, y1, { ctrlKey: ctrl });
	s.up(x1, y1, { ctrlKey: ctrl });
	return s.selection;
};
const hits = (s: Session, x0: number, x1: number, y0: number, y1: number) => band(s, x0, x1, y0, y1).edges.includes(0);
const pick = (s: Session, ids: string[]) => {
	ids.forEach((id, i) => {
		s.down(0, 0, s.node(id), { ctrlKey: i > 0 });
		s.up(0, 0);
	});
};

test('rectangle path intersection', () => {
	const s = make();
	assert.ok(hits(s, 49, 51, -1, 1), 'Crossing line with both endpoints outside');
	assert.ok(!hits(s, 49, 51, 1, 2), 'Disjoint line');
	assert.ok(hits(s, 5, 95, 0, 0), 'Boundary contact and zero-height band');
	s.apply({ op: 'arrow', index: 0, route: 'hvh', mid: 50 });
	s.apply({ op: 'move', id: 'b', x: 100, y: 40 });
	assert.ok(hits(s, 49, 51, 19, 21), 'Orthogonal middle segment');
	assert.ok(hits(s, 20, 21, -1, 1), 'Orthogonal first segment');
	assert.ok(hits(s, 70, 71, 39, 41), 'Orthogonal last segment');
	assert.ok(!hits(s, 20, 21, 19, 21), 'Orthogonal bounding box is insufficient');
	s.apply({ op: 'arrow', index: 0, route: 'bend', bend: 60 });
	s.apply({ op: 'move', id: 'b', x: 100, y: 0 });
	const midpoint = s.hook.edgeGeom(s.hook.state().edges[0]).label;
	assert.ok(
		hits(s, midpoint[0] - 0.00001, midpoint[0] + 0.00001, midpoint[1] - 0.00001, midpoint[1] + 0.00001),
		'Tiny band crossing actual cubic',
	);
	assert.ok(hits(s, 49, 51, midpoint[1], midpoint[1] + 1), 'Cubic tangent at band boundary');
	assert.ok(!hits(s, 49, 51, midpoint[1] + 1, midpoint[1] + 2), 'Disjoint cubic control hull overlap');
	pick(s, ['a', 'b']);
	assert.deepEqual(s.selection.nodes, ['a', 'b']);
	assert.ok(band(s, 0, 1, 100, 101, true).edges.includes(0), 'Both selected boxes include their bent arrow');
	s.apply({ op: 'lock', ids: ['a'], locked: true });
	assert.ok(!hits(s, -100, 200, -100, 200), 'Locked endpoint excluded');
	s.apply({ op: 'lock', ids: ['a'], locked: false });
	s.apply({ op: 'hide', ids: ['a'], hidden: true });
	assert.ok(!hits(s, -100, 200, -100, 200), 'Hidden endpoint excluded');
});

test('selection, movement, styles and clipboard', () => {
	const s = make();
	s.down(49, -1);
	s.move(51, 1);
	assert.deepEqual(s.selection.edges, [0]);
	assert.equal(s.selection.nodes.length, 0);
	s.up(51, 1);
	// Ctrl band adds arrows and keeps the box selected before it.
	s.down(200, 0, s.node('c'), { ctrlKey: true });
	s.up(200, 0, { ctrlKey: true });
	s.down(149, -1, s.svg, { ctrlKey: true });
	s.move(151, 1, { ctrlKey: true });
	assert.deepEqual(s.selection.edges, [0, 1], 'Ctrl band adds arrows');
	assert.deepEqual(s.selection.nodes, ['c'], 'Ctrl band preserves boxes');
	s.move(148, -2, { ctrlKey: true });
	assert.deepEqual(s.selection.edges, [0], 'Shrinking band removes only new arrows');
	s.up(148, -2, { ctrlKey: true });
	s.down(-7, -4);
	s.move(107, 4);
	assert.deepEqual(s.selection.nodes, ['a', 'b']);
	assert.deepEqual(s.selection.edges, [0, 1], 'Band also catches the start of the outgoing arrow');
	s.up(107, 4);
	// Moving a selected box moves the whole selection and keeps the arrow selection.
	const a = s.hook.state().nodes.find((n: any) => n.id === 'a'),
		b = s.hook.state().nodes.find((n: any) => n.id === 'b');
	s.down(0, 0, s.node('a'));
	s.move(10, 5);
	assert.equal(a.x, 10);
	assert.equal(b.x, 110);
	assert.deepEqual(s.selection.edges, [0, 1], 'Moving boxes preserves arrow selection');
	assert.equal(
		s.hook.edgeGeom(s.hook.state().edges[0]).pts[0][0],
		10 + s.hook.layout(a).w / 2,
		'Arrow follows moved boxes',
	);
	s.up(10, 5);

	// Two arrows selected: mixed values show as such, and a choice applies to both.
	s.apply({ op: 'style', indices: [0], style: { color: 'blue' } });
	s.apply({ op: 'style', indices: [1], style: { color: 'red' } });
	s.down(60, 0, '[data-edge="0"]');
	s.up(60, 0);
	s.down(160, 0, '[data-edge="1"]', { ctrlKey: true });
	s.up(160, 0, { ctrlKey: true });
	assert.deepEqual(s.selection.edges, [0, 1]);
	const row = (name: string) => s.row(name);
	assert.equal(row('Colour').querySelector('.colour-swatches').value, '*', 'Mixed arrow style');
	assert.equal(row('Line').querySelector('.segments').value, '*', 'Mixed solid/dashed arrow kinds');
	s.click(row('Colour').querySelector('button[aria-label="blue"]'));
	assert.deepEqual(JSON.parse(JSON.stringify(s.lastOp)), {
		op: 'batch',
		ops: [{ op: 'style', indices: [0, 1], style: { color: 'blue' } }],
	});
	s.apply({ op: 'style', indices: [1], style: { color: 'red' } });
	s.down(60, 0, '[data-edge="0"]');
	s.up(60, 0);
	s.key('c', { ctrlKey: true, altKey: true, code: 'KeyC' });
	s.down(160, 0, '[data-edge="1"]');
	s.up(160, 0);
	s.key('v', { ctrlKey: true, altKey: true, code: 'KeyV' });
	assert.ok(s.lastOp.ops.some((op: any) => op.op === 'style' && op.indices[0] === 1 && op.style.color === 'blue'));

	s.down(60, 0, '[data-edge="0"]');
	s.up(60, 0);
	const clipboard = s.clipboard('copy').text;
	assert.equal((clipboard.match(/\\node\[/g) || []).length, 2, 'Arrow-only copy includes endpoint boxes');
	assert.equal((clipboard.match(/\\draw\[/g) || []).length, 1, 'Only the selected arrow is copied');
	const target = new Session();
	target.clipboard('paste', clipboard);
	assert.equal(t.edges(target.fig()).length, 1, 'Copied arrow pastes with valid endpoints');
	assert.equal(t.nodes(target.fig()).length, 2);
	s.down(0, 0, s.node('a'));
	s.up(0, 0);
	s.down(160, 0, '[data-edge="1"]', { ctrlKey: true });
	s.up(160, 0, { ctrlKey: true });
	assert.deepEqual([s.selection.nodes, s.selection.edges], [['a'], [1]]);
	assert.equal(
		(s.clipboard('copy').text.match(/\\draw\[/g) || []).length,
		1,
		'Including endpoint boxes does not copy additional edges',
	);
	s.down(60, 0, '[data-edge="0"]');
	s.up(60, 0);
	s.down(160, 0, '[data-edge="1"]', { ctrlKey: true });
	s.up(160, 0, { ctrlKey: true });
	assert.deepEqual([s.selection.nodes, s.selection.edges], [[], [0, 1]]);
	s.key('Delete');
	assert.deepEqual(JSON.parse(JSON.stringify(s.lastOp.ops)), [
		{ op: 'deleteItem', id: 'connector' },
		{ op: 'deleteItem', id: 'connector-2' },
	]);
	assert.equal(s.selection.edges.length, 0);
});

test('shared-router segment drags, loops and snapped endpoints', () => {
	const s = new Session(
		figure(
			[
				['a', 0, 0, { width: 14, minh: 14, title: 'A' }],
				['b', 70, 20, { width: 14, minh: 14, title: 'B' }],
			],
			[
				{
					from: 'a',
					to: 'b',
					route: 'fixed',
					fromAnchor: 'east',
					toAnchor: 'west',
					waypoints: [
						[35, 0],
						[35, 20],
					],
					kind: 'arr',
					head: 'end',
				},
			],
		),
	);
	s.down(35, 10, '[data-edge="0"]');
	s.up(35, 10);
	s.down(35, 10, '[data-segment="0:1"]');
	s.move(45, 10);
	s.up(45, 10);
	assert.equal(s.lastOp.waypoints[0][0], 45, 'Interior segment moves its free level');
	assert.equal(s.lastOp.waypoints[1][0], 45);
	assert.equal(s.lastOp.fromAnchor, 'east');
	s.apply({ op: 'arrow', index: 0, route: 'auto', resetAuto: true });
	s.apply({ op: 'move', id: 'b', x: 70, y: 0 });
	s.down(35, 0, '[data-segment="0:0"]', { altKey: true });
	s.move(35, 15, { altKey: true });
	s.up(35, 15, { altKey: true });
	assert.equal(s.lastOp.route, 'fixed');
	assert.ok(s.lastOp.waypoints.length >= 4, 'Alt drag creates a jog');
	s.apply({ op: 'addEdge', from: 'b', to: 'a', route: 'straight' });
	s.down(60, 0, '[data-edge="0"]');
	s.up(60, 0);
	s.down(20, 0, '[data-edge="1"]', { ctrlKey: true });
	s.up(20, 0, { ctrlKey: true });
	assert.deepEqual(s.selection.edges, [0, 1]);
	s.click(s.button('Reset to auto', s.inspector));
	assert.equal(s.lastOp.ops.length, 2);
	assert.ok(s.lastOp.ops.every((o: any) => o.resetAuto));
	// A release on the originating node creates a loop on the release side.
	s.down(0, 0, s.node('a'));
	s.up(0, 0);
	s.down(0, 7, '[data-handle="a"]');
	s.move(7, 0);
	s.up(7, 0);
	assert.equal(s.lastOp.route, 'loop');
	assert.equal(s.lastOp.from, 'a');
	assert.equal(s.lastOp.to, 'a');
	assert.equal(s.lastOp.loopSide, 'east');
	s.down(35, 0, '[data-edge="0"]');
	s.up(35, 0);
	s.down(63, 0, '[data-endpoint="0:to"]');
	s.move(70 + 7, 3.5);
	s.up(70 + 7, 3.5);
	assert.equal(s.lastOp.toOffset, 3.5, 'Endpoint drop snaps along the side');
});
