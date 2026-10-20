import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { loadIcons } from '../lib/env';

// Frame drops, new fields and style transfer through the editor's real handlers (ported from scripts/check-architecture-ui.cjs).
const t = loadIcons();

test('frame endpoint drops, numeric controls, next step, style transfer and frame clipboard', () => {
	const s = new Session(figure(
		[['a', 0, 0, { title: 'A', cat: 'work', minh: 12 }], ['b', 70, 0, { title: 'B', cat: 'work', minh: 12 }]],
		[{ from: 'b', to: 'a', style: { step: 2, color: 'blue', lineWidth: .75, tipWidth: 2, tipLength: 3, side: 'left' } }, { from: 'a', to: 'b', style: { step: 5, color: 'red' } }],
		[{ op: 'addGroup', id: 'g', name: 'Frame', frame: 'dashed', color: 'blue', parent: '' }, { op: 'setGroup', ids: ['a'], group: 'g' }],
	));
	const selectEdge = (i: number, x = 35, y = 0) => { s.down(x, y, `[data-edge="${i}"]`); s.up(x, y); };
	const input = (row: string) => s.row(row).querySelector('input');
	const change = (row: string, value: string) => { const el = input(row); el.value = value; el.dispatchEvent(new s.window.Event('change', { bubbles: true })); };

	// The next free step number is the placeholder of the Step field.
	selectEdge(0);
	assert.equal(input('Step').placeholder, '1');
	s.apply({ op: 'style', indices: [0], style: { step: 1 } }); s.apply({ op: 'style', indices: [1], style: { step: 3 } });
	assert.equal(input('Step').placeholder, '2');
	s.apply({ op: 'style', indices: [0], style: { step: 2 } }); s.apply({ op: 'style', indices: [1], style: { step: 5 } });

	const frame = s.hook.frameRect('g'), x = frame.x + frame.w / 2;
	selectEdge(0);
	s.down(50, 0, '[data-endpoint="0:to"]'); s.move(x, 0);
	assert.equal(s.hook.drag().target.id, 'g'); assert.equal(s.hook.drag().target.anchor, 'east');
	s.up(x, 0);
	assert.equal(s.lastOp.to, 'g'); assert.equal(s.lastOp.toAnchor, 'east');
	assert.equal(s.hook.baseEdgeGeom(s.hook.state().edges[0]).pts.at(-1)[0], x);

	// Numeric controls, integer badges, clearing and 0.05 pt increments.
	selectEdge(0);
	const before = s.ops.length;
	change('Line width', '.65');
	assert.equal(s.lastOp.ops[0].style.lineWidth, .65);
	change('Step', '1.5');
	assert.equal(s.ops.length, before + 1, 'A fractional step is not accepted');
	change('Step', '4');
	assert.equal(s.lastOp.style.step, 4);
	change('Step', '');
	// The field posts a cleared step as 0 (the original primitive test posted null from its own callback).
	assert.equal(s.lastOp.style.step, 0);
	s.apply({ op: 'style', indices: [0], style: { step: 2, lineWidth: .75 } });

	selectEdge(0);
	s.key('c', { ctrlKey: true, altKey: true, code: 'KeyC' });
	selectEdge(1, 35, 0);
	s.key('v', { ctrlKey: true, altKey: true, code: 'KeyV' });
	const styleBatch = s.lastOp;
	assert.ok(!Object.hasOwn(styleBatch.ops.find((o: any) => o.op === 'style').style, 'step'));
	assert.equal(t.edges(s.fig())[1].style.step, 5);
	assert.equal(t.edges(s.fig())[1].style.tipLength, 3);

	// Cross-type style transfers a colour; group style does not alter its members.
	s.apply({ op: 'style', indices: [1], style: { color: 'red' } });
	selectEdge(0);
	s.key('c', { ctrlKey: true, altKey: true, code: 'KeyC' });
	s.down(0, 0, s.node('a')); s.up(0, 0);
	s.key('v', { ctrlKey: true, altKey: true, code: 'KeyV' });
	assert.equal(s.lastOp.ops.at(-1).style.color, 'blue');
	const frameEdge = () => { const r = s.hook.frameRect('g'); return [r.x - r.w / 2, r.y]; };
	s.down(...frameEdge() as [number, number], '[data-group="g"]'); s.up(...frameEdge() as [number, number]);
	assert.equal(s.selection.group, 'g');
	s.key('c', { ctrlKey: true, altKey: true, code: 'KeyC' });
	selectEdge(1);
	s.key('v', { ctrlKey: true, altKey: true, code: 'KeyV' });
	assert.equal(s.lastOp.ops[0].style.color, 'blue');
	s.down(...frameEdge() as [number, number], '[data-group="g"]'); s.up(...frameEdge() as [number, number]);
	s.key('v', { ctrlKey: true, altKey: true, code: 'KeyV' });
	assert.equal(s.lastOp.op, 'groupProps');
	selectEdge(0);
	s.click(s.button('Colour from source', s.inspector));
	assert.equal(s.lastOp.ops[0].style.color, t.darkerColor('peach'));

	// Copying a frame endpoint includes the fit-node's membership and hierarchy.
	selectEdge(0);
	const clip = s.clipboard('copy').text;
	assert.ok(clip.includes('% sakuga group g '));
	const target = new Session();
	target.clipboard('paste', clip);
	const p = target.fig();
	assert.equal(t.groups(p).length, 1);
	assert.equal(t.edges(p).length, 1);
	assert.equal(t.serialize(t.parse(t.serialize(p))), t.serialize(p));
});
