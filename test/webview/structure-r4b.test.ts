import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { arrangeInParent } from '../../src/core/layout/parent-arrange';
import { loadIcons } from '../lib/env';
const t = loadIcons();
const row = (s: Session, id: string) => s.document.querySelector(`#layer-list [data-id="${id}"]`);
const expand = (s: Session) => {
	const layer = row(s, 'layer1');
	if (layer.getAttribute('aria-expanded') !== 'true') s.click(s.button('Expand layer', layer));
};
const fire = (s: Session, el: any, type: string, fields: Record<string, unknown>) => {
	const event = new s.window.Event(type, { bubbles: true, cancelable: true });
	for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
	el.dispatchEvent(event);
};

test('tree rows share disclosure/marker/name/count/eye/lock order; item controls persist', () => {
	const s = new Session(
		figure(
			[
				['a', 0, 0],
				['b', 60, 0],
			],
			[],
			[
				{ op: 'addGroup', id: 'g', name: 'Container' },
				{ op: 'reparent', id: 'a', newParent: 'g' },
			],
		),
	);
	expand(s);
	for (const id of ['layer1', 'g', 'a', 'b']) {
		const r = row(s, id),
			children = [...r.children] as any[];
		assert.equal(children[1].className, 'layer-marker');
		assert.equal(children[2].className, 'layer-name');
		assert.equal(children[3].className, 'layer-count');
		assert.equal(children[4].tagName, 'BUTTON');
		assert.equal(children[5].tagName, 'BUTTON');
	}
	s.click(s.button('Hide g', row(s, 'g')));
	assert.equal(s.fig().items.find((i: any) => i.id === 'g').hidden, true);
	s.click(s.button('Show g', row(s, 'g')));
	s.click(s.button('Lock a', row(s, 'a')));
	assert.equal(s.fig().items.find((i: any) => i.id === 'a').locked, true);
});

test('tree drops put labels into first free box slots and reject cycles', () => {
	const s = new Session(
		figure([
			['box', 0, 0],
			['label', 60, 0, { kind: 'label' }],
		]),
	);
	expand(s);
	fire(s, row(s, 'label'), 'dragstart', { dataTransfer: { setData() {} } });
	fire(s, row(s, 'box'), 'drop', { clientY: 12 });
	const item = s.fig().items.find((i: any) => i.id === 'label');
	assert.equal(item.parent, 'box');
	assert.equal(item.slot, 'below'); // the box's centre Label already occupies centre
	const before = s.ops.length;
	fire(s, row(s, 'box'), 'dragstart', { dataTransfer: { setData() {} } });
	fire(s, row(s, 'label'), 'drop', { clientY: 12 });
	assert.equal(s.ops.length, before);
});

test('Alt drag reparents a line into a box and detaches it onto empty canvas', () => {
	const s = new Session(figure([['box', 0, 0]], [], [{ op: 'addLine', id: 'line', start: [50, 0], end: [70, 0] }]));
	s.drag(60, 0, '[data-line="line"]', 0, 0, { altKey: true });
	assert.equal(s.fig().items.find((i: any) => i.id === 'line').parent, 'box');
	s.drag(0, 0, '[data-line="line"]', 100, 50, { altKey: true });
	assert.equal(s.fig().items.find((i: any) => i.id === 'line').parent, 'layer1');
});

test('group and ungroup/detach operate on mixed tree roots with keyboard shortcuts', () => {
	const s = new Session(
		figure([
			['a', 0, 0],
			['b', 60, 0],
		]),
	);
	expand(s);
	s.click(row(s, 'a'));
	s.click(row(s, 'b'), { shiftKey: true });
	s.key('g', { ctrlKey: true });
	const group = s.fig().items.find((i: any) => i.kind === 'Frame');
	assert.ok(group);
	assert.equal(s.fig().items.find((i: any) => i.id === 'a').parent, group.id);
	s.key('G', { ctrlKey: true, shiftKey: true });
	assert.ok(!s.fig().items.some((i: any) => i.id === group.id));
	s.apply({ op: 'reparent', id: 'b', newParent: 'a' });
	s.click(row(s, 'b'));
	s.key('G', { ctrlKey: true, shiftKey: true });
	assert.equal(s.fig().items.find((i: any) => i.id === 'b').parent, 'layer1');
});

test('parent arrange sets box slots; group distribution spans the parent bounds', () => {
	const fig = t.parse(
		figure(
			[
				['box', 0, 0],
				['child', 60, 0],
			],
			[],
			[{ op: 'reparent', id: 'child', newParent: 'box' }],
		),
	);
	const plan = arrangeInParent(fig, ['child'], 'right')!;
	t.apply(fig, plan);
	assert.equal(fig.items.find((i: any) => i.id === 'child').slot, 'below-right');
	const grouped = t.parse(
		figure(
			[
				['a', 0, 0],
				['b', 60, 0],
				['c', 120, 0],
			],
			[],
			[
				{ op: 'addGroup', id: 'g', name: 'Group' },
				...['a', 'b', 'c'].map((id) => ({ op: 'reparent', id, newParent: 'g' })),
			],
		),
	);
	const distribution = arrangeInParent(grouped, ['a', 'b'], 'distributeX')!;
	t.apply(grouped, distribution);
	assert.ok(t.nodes(grouped).find((n: any) => n.id === 'b').x > 100);
	assert.equal(arrangeInParent(grouped, ['a', 'box'], 'left'), undefined);
});
