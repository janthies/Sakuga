import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { loadIcons } from '../lib/env';

const { statePayload } = require('../../src/state');

// The canvas pointer, key and clipboard handlers for attached labels, icons and boxes (ported from scripts/check-labels-ui.cjs).
const t = loadIcons();
const NODES: [string, number, number, Record<string, unknown>][] = [
	['parent', 0, 0, { width: 80, minh: 60 }],
	['label', 90, 80, { kind: 'label', width: 12 }],
	['icon', 100, 80, { kind: 'icon', icon: 'board', width: 8, minh: 8 }],
	['box', 120, 80, { width: 16, minh: 10 }],
];
const node = (s: Session, id: string) => s.hook.state().nodes.find((n: any) => n.id === id);
const model = (s: Session, id: string) => t.nodes(s.fig()).find((n: any) => n.id === id);

test('anchor picker, grid drops, Alt drop, offsets, editing, parent previews, clipboard and duplicate', () => {
	const s = new Session(figure(NODES));
	// The anchor picker of the title position: nine cells, the current one pressed, a click posts that anchor.
	s.apply({ op: 'node', id: 'box', titlePosition: 'north west' });
	s.down(120, 80, s.node('box')); s.up(120, 80);
	const picker = s.row('Title position').querySelector('.anchor-picker');
	assert.equal(picker.children.length, 9);
	assert.equal(picker.children[0].getAttribute('aria-pressed'), 'true');
	s.click(picker.children[8]);
	assert.equal(s.lastOp.titlePosition, 'south east');
	// All nine target cells; objects and descendants cannot become their own parents.
	for (const [i, anchor] of t.ANCHORS.entries()) {
		const x = (i % 3 - 1) * 25, y = (1 - Math.floor(i / 3)) * 20;
		s.down(90, 80, s.node('label')); s.move(x, y);
		assert.equal(s.hook.drag().target.anchor, anchor);
		s.up(x, y);
		s.apply({ op: 'attach', id: 'label', attachment: null }); s.apply({ op: 'move', id: 'label', x: 90, y: 80 });
	}
	s.down(0, 0, s.node('parent')); s.move(0, 0);
	assert.equal(s.hook.drag().target, null);
	s.up(0, 0);
	for (const id of ['label', 'icon', 'box']) {
		const n = node(s, id);
		s.down(n.x, n.y, s.node(id));
		s.move(-28, 20);
		assert.equal(s.hook.drag().target.anchor, 'north west');
		s.up(-28, 20);
		const batch = s.lastOp;
		assert.equal(batch.op, 'batch');
		assert.ok(batch.ops.some((o: any) => o.op === 'attach' && o.id === id && o.attachment.parent === 'parent'));
		assert.equal(model(s, id).attachment.parent, 'parent');
	}
	s.dblclick(0, 0, s.node('label'));
	assert.equal(s.hook.editing(), 'label');
	s.editKey('Escape');
	// Re-dragging within the parent changes offsets without replacing either anchor.
	const label = node(s, 'label'), before = { ...label.attachment }, start = { x: label.x, y: label.y };
	s.down(start.x, start.y, s.node('label'));
	s.move(20, -15);
	assert.equal(node(s, 'label').attachment.anchor, before.anchor);
	s.up(20, -15);
	const shifted = s.lastOp;
	assert.ok(!shifted.ops.some((o: any) => o.op === 'attach'));
	const after = model(s, 'label');
	assert.equal(after.attachment.anchor, before.anchor);
	assert.ok(Math.abs(after.attachment.dx - before.dx - (20 - start.x)) < 0.11);
	// Alt at drop disables attachment even if the grid was visible in the last move.
	s.apply({ op: 'attach', id: 'box', attachment: null });
	const box = node(s, 'box');
	s.down(box.x, box.y, s.node('box')); s.move(10, 10);
	s.up(10, 10, { altKey: true });
	assert.ok(!s.lastOp.ops.some((o: any) => o.op === 'attach'));
	// Moving the parent previews child movement and keeps the relation on release.
	const childX = node(s, 'label').x;
	s.down(0, 0, s.node('parent')); s.move(7, 4);
	assert.ok(Math.abs(node(s, 'label').x - childX - 7) < 0.01);
	s.up(7, 4);
	// Clipboard and duplicate keep label kind, styling and attachments.
	s.down(0, 0, s.node('label')); s.up(0, 0);
	const copied = t.parse(s.clipboard('copy').text);
	assert.equal(t.nodes(copied).find((n: any) => n.id === 'label').kind, 'label');
	assert.ok(t.nodes(copied).some((n: any) => n.id === 'parent'));
	s.down(0, 0, s.node('parent')); s.up(0, 0);
	s.down(0, 0, s.node('label'), { ctrlKey: true }); s.up(0, 0, { ctrlKey: true });
	assert.deepEqual(s.selection.nodes, ['parent', 'label']);
	s.key('d', { ctrlKey: true });
	const additions = s.lastOp.ops.filter((o: any) => o.op === 'addNode');
	const labelCopy = additions.find((o: any) => o.kind === 'label'), parentCopy = additions.find((o: any) => !o.kind);
	assert.ok(s.lastOp.ops.some((o: any) => o.op === 'attach' && o.id === labelCopy.id && o.attachment.parent === parentCopy.id));
});

test('canvas stacking puts a parent before its attached child', () => {
	const s = new Session(figure(NODES.slice(0, 2), [], [{ op: 'attach', id: 'label', attachment: { parent: 'parent', anchor: 'north west', ownAnchor: 'north west', dx: 0, dy: 0 } }]));
	// The host sends the child first (as when it sits in a higher layer); the canvas still paints the parent below it.
	s.message({ ...statePayload(s.doc), nodes: statePayload(s.doc).nodes.reverse() });
	assert.deepEqual(s.hook.state().nodes.map((n: any) => n.id), ['label', 'parent']);
	const order = s.all('[data-node]').map((e: any) => e.getAttribute('data-node'));
	assert.ok(order.indexOf('parent') < order.indexOf('label'), order.join());
});
