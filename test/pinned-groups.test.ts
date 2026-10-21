import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { apply, parse, serialize, TEMPLATE, nodes, lineItems, itemById } from '../src/core';
import { BOX_SLOTS } from '../src/core/model/slots';
import { slotFrame } from '../src/core/geometry/slot-layout';
import { geometryOf } from '../src/core/geometry/figure-geometry';

const point = (f: ReturnType<typeof parse>, id: string) => {
	geometryOf(f);
	const n = nodes(f).find((n) => n.id === id)!;
	return [n.x, n.y];
};

test('groups pin their flush point in every box slot; member edits never recenter siblings', () => {
	for (const slot of BOX_SLOTS) {
		let f = parse(TEMPLATE);
		for (const [id, x, y] of [
			['box', 0, 0],
			['a', 40, 30],
			['b', 80, 50],
		] as const)
			apply(f, { op: 'addNode', id, x, y, title: id, cat: '' });
		apply(f, { op: 'addGroup', id: 'g', name: 'Members' });
		for (const id of ['a', 'b']) apply(f, { op: 'reparent', id, newParent: 'g' });
		apply(f, { op: 'addLine', id: 'line', start: [50, 50], end: [70, 50], parent: 'g' });
		apply(f, { op: 'reparent', id: 'g', newParent: 'box' });
		apply(f, { op: 'slot', id: 'g', slot });
		const before = point(f, 'b'),
			line = [...lineItems(f)[0].start];
		const a = point(f, 'a');
		apply(f, { op: 'move', id: 'a', x: a[0] + 7, y: a[1] + 9 });
		apply(f, { op: 'node', id: 'a', width: 80, minh: 40 });
		apply(f, { op: 'node', id: 'a', title: 'A much longer changed label' });
		assert.deepEqual(point(f, 'b'), before, slot);
		assert.deepEqual(lineItems(f)[0].start, line, slot);
		const expected = point(f, 'a');
		f = parse(serialize(f));
		assert.deepEqual(point(f, 'a'), expected, slot + ' roundtrip target');
		assert.deepEqual(point(f, 'b'), before, slot + ' roundtrip sibling');
		assert.deepEqual(lineItems(f)[0].start, line, slot + ' roundtrip line');
		const previous = itemById(f, 'g');
		assert.ok(previous?.kind === 'Frame');
		const pin = [...previous.frame.pin!];
		apply(f, { op: 'slot', id: 'g', slot });
		const reset = itemById(f, 'g');
		assert.ok(reset?.kind === 'Frame');
		assert.notDeepEqual(reset.frame.pin, pin, 'explicit placement refits the changed group');
		assert.ok(slotFrame(reset.frame)?.origin);
	}
});
