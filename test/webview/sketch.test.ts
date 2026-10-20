import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { loadIcons } from '../lib/env';

// Alignment, distribution, Tab placement and the sketch keys of the real editor (ported from scripts/check-sketch.cjs).
const t = loadIcons();
const sketch = require('../../src/shared').sketch;
const pkg = require('../../package.json');

test('sketch geometry: alignment, equal edge gaps, key objects, sizes, rigid groups, locks and Tab placement', () => {
	const layout = (n) => {
		const [w, h] = t.boxHalf(n);
		return { w: w * 2, h: h * 2, lines: [n.title] };
	};
	const fig = t.parse(t.TEMPLATE);
	const add = (id, x, y, width = 20, minh = 10, extra = {}) =>
		t.apply(fig, { op: 'addNode', id, title: id, cat: '', x, y, width, minh, ...extra });
	const near = (a, b) => assert(Math.abs(a - b) < 0.001, `${a} != ${b}`);
	add('a', 0, 0, 10);
	add('b', 30, 12, 20);
	add('c', 90, -10, 30);
	const ns = () => t.nodes(fig),
		ids = ['a', 'b', 'c'];
	const apply = (batch) => {
		assert.equal(batch.op, 'batch');
		t.apply(fig, batch);
	};
	apply(sketch.arrange(ns(), [], ids, null, 'left', layout));
	const left = ns()[0].x - layout(ns()[0]).w / 2;
	ns().forEach((n) => near(n.x - layout(n).w / 2, left));
	// Restore an unequal-gap row with unequal sizes, then distribute its edge gaps.
	ns().forEach((n, i) => {
		n.x = [0, 30, 90][i];
		n.y = 0;
	});
	apply(sketch.arrange(ns(), [], ids, null, 'distributeX', layout));
	const gap = (a, b) => b.x - a.x - (layout(a).w + layout(b).w) / 2;
	near(gap(ns()[0], ns()[1]), gap(ns()[1], ns()[2]));
	apply(sketch.sameSize(ns(), ids, null, 'w', layout));
	ns().forEach((n) => near(layout(n).w, layout(ns()[2]).w));
	for (const cmd of ['left', 'centerX', 'right', 'top', 'centerY', 'bottom']) {
		const key = ns()[1],
			before = { x: key.x, y: key.y };
		apply(sketch.arrange(ns(), [], ids, key.id, cmd, layout));
		near(key.x, before.x);
		near(key.y, before.y);
		const axis = ['left', 'centerX', 'right'].includes(cmd) ? 'x' : 'y';
		const pos = { left: 0, centerX: 0.5, right: 1, bottom: 0, centerY: 0.5, top: 1 }[cmd];
		const at = (n) => {
			const b = sketch.bounds([n], layout);
			return b[axis + '0'] + (b[axis + '1'] - b[axis + '0']) * pos;
		};
		ns().forEach((n) => near(at(n), at(key)));
	}
	// Key width, height, vertical distribution, mixed kinds and rigid nested groups.
	ns()[0].width = 12;
	ns()[1].width = 15;
	ns()[2].width = 20;
	apply(sketch.sameSize(ns(), ids, 'b', 'w', layout));
	ns().forEach((n) => near(n.width, 15));
	ns()[1].minh = 22;
	apply(sketch.sameSize(ns(), ids, 'b', 'h', layout));
	ns().forEach((n) => near(layout(n).h, 22));
	ns().forEach((n, i) => (n.y = [0, 40, 120][i]));
	apply(sketch.arrange(ns(), [], ids, null, 'distributeY', layout));
	near(ns()[1].y - ns()[0].y, ns()[2].y - ns()[1].y);
	const mixed = JSON.parse(JSON.stringify(ns()));
	mixed[0].kind = 'label';
	mixed[1].kind = 'icon';
	mixed[1].minh = 8;
	mixed[0].group = 'inner';
	mixed[1].group = 'outer';
	mixed[2].group = '';
	const gs = [
			{ id: 'inner', parent: 'outer' },
			{ id: 'outer', parent: '' },
		],
		before = mixed[1].x - mixed[0].x;
	const batch = sketch.arrange(mixed, gs, ids, null, 'right', layout);
	for (const op of batch.ops) {
		Object.assign(
			mixed.find((n) => n.id === op.id),
			{ x: op.x, y: op.y },
		);
	}
	near(mixed[1].x - mixed[0].x, before);
	mixed[1].locked = true;
	assert(!sketch.arrange(mixed, gs, ids, null, 'left', layout).ops.some((o) => o.id === 'a' || o.id === 'b'));
	// Tab placement, median spacing, occupied spots, direction from the last incoming edge.
	const seed = {
		...ns()[0],
		id: 'seed',
		title: 'seed',
		x: 0,
		y: 0,
		width: 26,
		minh: 12,
		style: { fill: 'peach', border: 'dashed' },
		extra: [],
	};
	let draft = sketch.nextBox([seed], [], seed, 'new', false, layout);
	near(draft.node.x, (layout(seed).w + layout(draft.node).w) / 2 + 8);
	near(draft.node.y, 0);
	assert.equal(draft.batch.ops.length, 1);
	assert.equal(draft.batch.ops[0].from, 'seed');
	assert.deepEqual(draft.node.style, seed.style);
	assert.equal(draft.node.width, seed.width);
	const below = sketch.nextBox([seed], [], seed, 'down', true, layout);
	near(below.node.y, -20);
	near(below.node.x, 0);
	const occupied = { ...draft.node, id: 'occupied' };
	const occupiedNext = sketch.nextBox([seed, occupied], [], seed, 'next', false, layout);
	assert(occupiedNext.node.x > occupied.x + layout(occupied).w);
	const occupiedBelow = { ...below.node, id: 'occupiedBelow' };
	assert(
		sketch.nextBox([seed, occupiedBelow], [], seed, 'down', true, layout).node.y <
			occupiedBelow.y - layout(occupiedBelow).h,
	);
	const predecessor = { ...seed, id: 'predecessor', x: 0, y: 30 };
	draft = sketch.nextBox([seed, predecessor], [{ from: 'predecessor', to: 'seed' }], seed, 'new', false, layout);
	assert(draft.node.y < 0);
	near(draft.node.x, 0);
	const leftward = { ...seed, id: 'leftward', x: 100 };
	assert(
		sketch.nextBox(
			[seed, leftward],
			[
				{ from: 'predecessor', to: 'seed' },
				{ from: 'leftward', to: 'seed' },
			],
			seed,
			'new',
			false,
			layout,
		).node.x < 0,
	);
	const spaced = [0, 40, 90].map((x, i) => ({ ...seed, id: `s${i}`, x }));
	near(sketch.typicalGap(spaced, layout), 45 - layout(seed).w);
	// Saved result uses the actual batch op and survives the TikZ round trip.
	t.apply(fig, draft.batch);
	const saved = t.parse(t.serialize(fig));
	assert(t.nodes(saved).some((n) => n.id === 'new'));
	assert(t.edges(saved).some((e) => e.to === 'new'));
});

const input_ = (s: Session) => s.document.getElementById('edit');
// The same seed box as the placement test above: a dashed peach box of 26 x 12 mm.
const SEED = { title: 'seed', width: 26, minh: 12, style: { fill: 'peach', border: 'dashed' } };
const SHORTCUT_ORDER = [
	'left',
	'centerX',
	'right',
	'top',
	'centerY',
	'bottom',
	'distributeX',
	'distributeY',
	'sameW',
	'sameH',
];

test('type-to-edit, Tab creation, cancellation, one-batch controls and constrained drags', () => {
	const s = new Session(
		figure([
			['seed', 0, 0, SEED],
			['second', 50, 0, SEED],
		]),
	);
	const nodes = () => s.hook.state().nodes;
	// Render invariant of the original harness: the selection only refers to existing nodes.
	const press = (key: string, mods: any = {}) => {
		const handled = s.key(key, mods);
		assert.ok(
			s.selection.nodes.every((id) => nodes().some((n: any) => n.id === id)),
			'Selection refers to existing nodes',
		);
		return handled;
	};
	const finish = (key: string) => s.editKey(key);
	const input = s.document.getElementById('edit');
	const selectSeed = () => {
		s.down(0, 0, s.node('seed'));
		s.up(0, 0);
	};
	selectSeed();
	assert.ok(press('Tab'));
	assert.equal(s.hook.editing(), 'n1');
	assert.equal(s.ops.length, 0);
	finish('Escape');
	assert.equal(s.ops.length, 0);
	assert.equal(nodes().length, 2);
	assert.ok(s.selection.nodes.includes('seed'));
	press('Tab', { shiftKey: true });
	assert.ok(nodes().find((n: any) => n.id === 'n1').y < 0);
	input.value = 'New title';
	finish('Enter');
	assert.equal(s.ops.length, 1);
	assert.equal(s.ops[0].op, 'batch');
	assert.equal(s.popOp().ops[0].title, 'New title');
	selectSeed();
	assert.ok(press('z'));
	assert.equal(input.value, 'z');
	finish('Enter');
	assert.equal(s.popOp().ops[0].title, 'z');
	assert.ok(!press('d'));
	assert.ok(!press('r'));
	assert.equal(s.hook.editing(), null);
	assert.ok(!press('z', { ctrlKey: true }));
	assert.ok(!press('z', { altKey: true }));
	assert.ok(!press('z', { metaKey: true }));
	assert.ok(!press('z', { isComposing: true }));
	assert.ok(press('😀'));
	assert.equal(input.value, '😀');
	finish('Escape');
	s.apply({ op: 'node', id: 'seed', title: 'seed' });
	assert.ok(press('F2'));
	assert.equal(input.value, 'seed');
	finish('Escape');
	assert.ok(press('Enter'));
	assert.equal(input.value, 'seed');
	finish('Escape');
	// A label takes typed text but cannot grow a connected box with Tab.
	const labelled = new Session(figure([['seed', 0, 0, { ...SEED, kind: 'label' }]]));
	labelled.down(0, 0, labelled.node('seed'));
	labelled.up(0, 0);
	assert.ok(labelled.key('!'));
	assert.equal(input_(labelled).value, '!');
	labelled.editKey('Escape');
	assert.ok(!labelled.key('Tab'));
	// A locked box cannot be selected, so typing does nothing.
	s.apply({ op: 'lock', ids: ['seed'], locked: true });
	assert.ok(!press('z'));
	s.apply({ op: 'lock', ids: ['seed'], locked: false });
	// The actual controls emit one batch, and Shift still starts a constrained drag.
	selectSeed();
	s.down(50, 0, s.node('second'), { ctrlKey: true });
	s.up(50, 0, { ctrlKey: true });
	const bar = s.inspector.querySelector('.sketch-controls');
	assert.equal(bar.children.length, 10);
	s.click(bar.children[0]);
	assert.equal(s.popOp().op, 'batch');
	s.down(50, 0, s.node('second'), { shiftKey: true });
	assert.ok(!s.selection.nodes.includes('second'));
	assert.ok(!s.hook.drag());
	s.up(50, 0, { shiftKey: true });
	s.down(50, 0, s.node('second'), { ctrlKey: true });
	assert.ok(s.selection.nodes.includes('second'));
	s.up(50, 0, { ctrlKey: true });
	// Every visible shortcut has an explicit scoped extension binding, avoiding workbench grabs.
	[...bar.children].forEach((b: any, i: number) => {
		const key = /\(([^)]+)\)$/.exec(b.title)![1];
		const binding = pkg.contributes.keybindings.find((k: any) => k.command === 'sakuga.sketch.' + SHORTCUT_ORDER[i]);
		assert.equal(binding.key, key.toLowerCase());
		assert.ok(binding.when.includes('activeCustomEditorId == sakuga.figure && webviewFocus'));
		assert.ok(!/^alt\+(?:[hjklq]|shift\+[hjkl])$/.test(binding.key));
	});
});
