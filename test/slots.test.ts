import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	parse,
	serialize,
	apply,
	nodes,
	childrenOf,
	itemById,
	TEMPLATE,
	serializeSubset,
	pasteOps,
	edges,
} from '../src/core';
import { BOX_SLOTS, defaultSlot } from '../src/core/model/slots';
import { slotRect } from '../src/core/geometry/slot-layout';

const fresh = () => {
	const f = parse(TEMPLATE);
	apply(f, { op: 'addNode', id: 'box', title: 'Box', code: 'code()', cat: '', x: 10, y: 20, width: 40 });
	return f;
};
test('box content belongs to Label children; all 25 slots survive source round trips', () => {
	const f = fresh(),
		box = nodes(f).find((n) => n.id === 'box')!;
	assert.equal(box.title, '');
	assert.equal(box.code, '');
	assert.equal(childrenOf(f, 'box')[0].kind, 'Text');
	for (const slot of BOX_SLOTS) {
		apply(f, { op: 'addText', id: slot, text: slot, parent: 'box', slot });
	}
	const before = nodes(f).map((n) => [n.id, n.x, n.y]);
	const text = serialize(f),
		g = parse(text);
	assert.deepEqual(
		nodes(g)
			.map((n) => [n.id, n.x, n.y])
			.sort(),
		before.sort(),
	);
	for (const slot of BOX_SLOTS) assert.equal(itemById(g, slot)?.slot, slot);
	assert.match(text, /\{Box\\\\\[-1pt\]\\sgcode\{code\(\)\}\}/);
	assert.ok(!nodes(g).some((n) => n.attachment));
});
test('creation defaults, outer stacking, inside growth, detach and parent movement', () => {
	const f = fresh();
	assert.equal(defaultSlot([]), 'centre');
	for (const [j, slot] of ['below', 'above', 'right', 'left'].entries()) {
		apply(f, { op: 'addText', id: 'note' + j, text: 'Note', parent: 'box' });
		assert.equal(itemById(f, 'note' + j)?.slot, slot);
	}
	apply(f, { op: 'addText', id: 'stack', text: 'Stack', parent: 'box', slot: 'above' });
	const a = nodes(f).find((n) => n.id === 'note1')!,
		b = nodes(f).find((n) => n.id === 'stack')!;
	assert.ok(b.y - slotRect(b)!.h / 2 > a.y + slotRect(a)!.h / 2);
	const old = [b.x, b.y];
	apply(f, { op: 'move', id: 'box', x: 15, y: 27 });
	assert.deepEqual([b.x, b.y], [old[0] + 5, old[1] + 7]);
	apply(f, { op: 'detach', id: 'stack' });
	const free = [b.x, b.y];
	apply(f, { op: 'move', id: 'box', x: 20, y: 35 });
	assert.deepEqual([b.x, b.y], free);
	const box = nodes(f).find((n) => n.id === 'box')!,
		height = slotRect(box)!.h;
	apply(f, { op: 'addText', id: 'inside', text: 'A\\\\B\\\\C\\\\D', parent: 'box', slot: 'top' });
	assert.ok(slotRect(box)!.h > height);
});
test('copy one box from a layer with several items pastes exactly one subtree, no ancestors', () => {
	const f = fresh();
	apply(f, { op: 'addNode', id: 'other', title: 'Other', cat: '', x: 90, y: 0 });
	apply(f, { op: 'addEdge', from: 'box', to: 'other' });
	const text = serializeSubset(f, [{ k: 'node', id: 'box' }]),
		copy = parse(text);
	assert.deepEqual(
		nodes(copy)
			.filter((n) => !n.kind)
			.map((n) => n.id),
		['box'],
	);
	assert.equal(edges(copy).length, 0);
	assert.ok(!text.includes('% sakuga layer'));
	const pasted = pasteOps(f, text, 5, -5, 'layer1');
	apply(f, { op: 'batch', ops: pasted.ops });
	assert.equal(pasted.ids.length, 1);
	assert.equal(nodes(f).filter((n) => !n.kind).length, 3);
	assert.equal(childrenOf(f, pasted.ids[0]).filter((i) => i.kind === 'Text').length, 1);
	const label = childrenOf(f, 'box')[0],
		single = parse(serializeSubset(f, [{ k: 'node', id: label.id }]));
	assert.equal(nodes(single).length, 1);
	assert.equal(nodes(single)[0].kind, 'label');
});
