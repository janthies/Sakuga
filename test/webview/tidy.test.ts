import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { loadIcons } from '../lib/env';

// Tidy up: measured layout, persistence, neighbour growth and the canvas preview handlers (ported from scripts/check-tidy.cjs).
const t = loadIcons();
const sketch = require('../../src/shared').sketch,
	text = require('../../src/shared').text,
	routes = require('../../src/shared').routes;
const near = (a: number, b: number, tol = 0.03) => assert(Math.abs(a - b) < tol, `${a} != ${b}`);
test('tidy: prototype fixtures, gaps, justification, neighbours/footnotes, content width, code sizes, wrapped frames, fixed/U routes and round trips', () => {
	const near = (a, b, tol = 0.03) => assert(Math.abs(a - b) < tol, `${a} != ${b}`);
	const layout = (n) => text.layout(n);
	const rect = (n) => {
		const { w, h } = layout(n);
		return { x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - h / 2, y1: n.y + h / 2 };
	};
	const plan = (f, ids = []) =>
		sketch.tidy(
			t.nodes(f).map((n) => ({ ...n, hidden: t.isHidden(f, n), locked: t.isLocked(f, n) })),
			t.groups(f),
			t.edges(f),
			ids,
			(n) => text.layout(n, t.fontSize(f)),
		);
	const round = (f) => {
		const s = t.serialize(f);
		assert.equal(t.serialize(t.parse(s)), s);
		return t.parse(s);
	};
	const fresh = () => t.parse(t.TEMPLATE),
		add = (f, id, x, y, more = {}) => t.apply(f, { op: 'addNode', id, x, y, title: id, cat: '', width: 26, ...more });
	// TeX Gyre Cursor's exact advance: 20 characters at scriptsize = 33.74 mm.
	near(text.mm('tee_attest_get_token', 8, 'mono'), 33.74, 0.01);
	let f = fresh();
	add(f, 'a', 0, 0, { code: 'tee\\_attest\\_get\\_token', codeFont: 'scriptsize' });
	let a = t.nodes(f)[0];
	near(a.width, 33.74);
	assert.equal(a.wantWidth, 26);
	assert(t.serialize(f).includes('sg want=26'));
	t.apply(f, { op: 'node', id: 'a', codeFont: 'tiny' });
	near(a.width, 26);
	assert(!t.serialize(f).includes('sg want='));
	assert(t.serialize(f).includes('sg code font=tiny'));
	round(f);
	t.apply(f, { op: 'node', id: 'a', codeFont: '', code: 'another_very_long_unbreakable_code_line' });
	assert(a.width > 26);
	assert.equal(a.wantWidth, 26);
	t.apply(f, { op: 'node', id: 'a', width: 30 });
	assert.equal(a.wantWidth, 30);
	f = round(f);
	a = t.nodes(f)[0];
	t.apply(f, { op: 'node', id: 'a', code: 'short' });
	near(a.width, 30);
	assert.equal(a.wantWidth, undefined);
	t.apply(f, { op: 'node', id: 'a', title: 'averyveryverylongunbreakabletitle' });
	assert(a.width > 30);
	t.apply(f, { op: 'node', id: 'a', title: 'Short' });
	near(a.width, 30);
	// Explicit line breaks are boundaries between words, not printable backslashes.
	add(f, 'b', 60, 0, { width: 18, title: 'Endorser\\\\IAK' });
	near(t.nodes(f)[1].width, 18);
	const legacy = t.parse(
		'\\begin{tikzpicture}\n\\node[sg box, text width=42mm] (old) at (0,0) {Short};\n\\end{tikzpicture}',
	);
	near(t.nodes(legacy)[0].width, 42);
	assert(!t.serialize(legacy).includes('sg want=42'));
	// Rows, labelled vertical arrows, equal heights, justification and no reordering.
	f = fresh();
	add(f, 'top', 0, 0, { width: 58 });
	add(f, 'left', -16, -14, { title: 'Two words', width: 20 });
	add(f, 'right', 16, -14, { title: 'Right', width: 20 });
	t.apply(f, { op: 'addEdge', from: 'top', to: 'right', label: 'calls' });
	const order = t.nodes(f).map((n) => n.id);
	const batch = plan(f);
	assert.equal(batch.op, 'batch');
	t.apply(f, batch);
	let [top, left, right] = t.nodes(f);
	near(layout(left).h, layout(right).h);
	assert(rect(top).y0 - rect(left).y1 >= 7.98);
	assert(rect(right).x0 - rect(left).x1 >= 3.98);
	assert.deepEqual(
		t.nodes(f).map((n) => n.id),
		order,
	);
	round(f);
	// A tall selection grows downwards, pushing a neighbour and a pinned footnote.
	f = fresh();
	add(f, 't', 0, 0);
	add(f, 'l', -16, -8);
	add(f, 'r', 16, -8);
	add(f, 'below', 0, -20);
	add(f, 'foot', 0, -32, { kind: 'label', width: 50, title: 'Pinned footnote' });
	const before = t.nodes(f).map((n) => ({ ...n }));
	const push = plan(f, ['t', 'l', 'r']);
	t.apply(f, push);
	assert(t.nodes(f).find((n) => n.id === 'below').y < before[3].y);
	assert(t.nodes(f).find((n) => n.id === 'foot').y < before[4].y);
	assert(rect(t.nodes(f)[3]).y1 < rect(t.nodes(f)[1]).y0);
	assert(rect(t.nodes(f)[4]).y1 < rect(t.nodes(f)[3]).y0);
	round(f);
	// Widening a stacked selection pushes the right neighbour, without pulling it back.
	f = fresh();
	add(f, 't', 0, 0, { width: 60 });
	add(f, 'l', -16, -14);
	add(f, 'r', 16, -14);
	add(f, 'right', 52, -14);
	const oldRight = t.nodes(f)[3].x;
	t.apply(f, plan(f, ['t', 'l', 'r']));
	assert(t.nodes(f)[3].x > oldRight);
	round(f);
	// Hidden and locked nodes are excluded; free labels stay unless pushed by growth.
	f = fresh();
	add(f, 't', 0, 0);
	add(f, 'b', 0, -18);
	add(f, 'label', -60, 0, { kind: 'label' });
	add(f, 'lock', 90, 0);
	t.apply(f, { op: 'lock', ids: ['lock'], locked: true });
	const untouched = t
		.nodes(f)
		.filter((n) => ['label', 'lock'].includes(n.id))
		.map((n) => ({ ...n }));
	t.apply(f, plan(f));
	for (const n of untouched) {
		near(t.nodes(f).find((q) => q.id === n.id).x, n.x);
		near(t.nodes(f).find((q) => q.id === n.id).y, n.y);
	}
	// Wrapped frame bounds use the same height as the canvas, with exact padding.
	f = fresh();
	add(f, 'wrapped', 0, 0, { width: 16, title: 'Several words wrap into many lines' });
	t.apply(f, { op: 'addGroup', id: 'frame', name: '', frame: 'dashed', padding: 3 });
	t.apply(f, { op: 'setGroup', ids: ['wrapped'], group: 'frame' });
	a = t.nodes(f)[0];
	assert(layout(a).lines.length > 2);
	const frame = t.routeObjects(f).find((n) => n.id === 'frame');
	near(frame.h, layout(a).h + 6);
	assert(t.serialize(f).includes(`${-frame.h / 2}`));
	round(f);
	// Fixed absolute paths re-anchor orthogonally and retain their interior when one end moves.
	f = fresh();
	add(f, 'a', 0, 0);
	add(f, 'b', 60, -25);
	t.apply(f, {
		op: 'addEdge',
		from: 'a',
		to: 'b',
		route: 'fixed',
		chain: ['(a.east)', '--', '(35,0)', '--', '(35,-25)', '--', '(b.west)'],
	});
	const oldObjects = t.routeObjects(f);
	t.apply(f, { op: 'move', id: 'a', x: 5, y: -10 });
	const fix = routes.reanchor(t.edges(f), oldObjects, t.routeObjects(f));
	assert.equal(fix.length, 1);
	t.apply(f, { op: 'batch', ops: fix });
	const geom = t.specialGeometry(f, t.edges(f)[0]);
	near(geom.pts[0][1], -10);
	near(geom.pts[1][1], -10);
	near(geom.pts[1][0], 35);
	round(f);
	// Explicit U detours retain their clearance when endpoints move.
	t.apply(f, { op: 'arrow', index: 0, route: 'u', fromAnchor: 'south', toAnchor: 'south', mid: -45 });
	const old = t.routeObjects(f);
	t.apply(f, { op: 'move', id: 'b', x: 60, y: -50 });
	t.apply(f, { op: 'batch', ops: routes.reanchor(t.edges(f), old, t.routeObjects(f)) });
	assert(t.edges(f)[0].mid < -45);
	round(f);
	// Real prototype fixtures: whole components and the nine Attester boxes.
	for (const name of ['components', 'rats-architecture']) {
		f = t.parse(fs.readFileSync(path.join(__dirname, '../../examples/' + name + '.sakuga.tikz'), 'utf8'));
		const ids = name === 'components' ? [] : ['app', 'rtos', 'client', 'store', 'crypto', 'ias', 'bl1', 'otp', 'rec'];
		const order = t.nodes(f).map((n) => n.id);
		t.apply(f, plan(f, ids));
		assert.deepEqual(
			t.nodes(f).map((n) => n.id),
			order,
		);
		round(f);
		if (name === 'components') {
			const objects = t.routeObjects(f),
				g1 = objects.find((n) => n.id === 'g1'),
				api = t.nodes(f).find((n) => n.id === 'cysapi'),
				g2 = objects.find((n) => n.id === 'g2'),
				drv = t.nodes(f).find((n) => n.id === 'drv'),
				g3 = objects.find((n) => n.id === 'g3'),
				ops = t.nodes(f).find((n) => n.id === 'ops');
			assert(g1.y - g1.h / 2 - rect(api).y1 >= 3.98);
			assert(g2.y - g2.h / 2 - rect(drv).y1 >= 3.98);
			assert(rect(ops).x0 - (g3.x + g3.w / 2) >= 3.98);
			const seam = t.nodes(f).find((n) => n.id === 'seam'),
				row = t.nodes(f).filter((n) => ['swbe', 'teebe'].includes(n.id));
			near(rect(row[0]).x0, rect(seam).x0);
			near(rect(row[1]).x1, rect(seam).x1);
		}
		// A second run is stable within the prototype's 0.1 mm rounding tolerance.
		const again = plan(f, ids);
		for (const o of again.ops)
			if (o.op === 'move') {
				const n = t.nodes(f).find((n) => n.id === o.id);
				near(n.x, o.x, 0.11);
				near(n.y, o.y, 0.11);
			}
	}
});

test('canvas layout equals the serializer box for every shape and font size', () => {
	const s = new Session(figure([], [], [{ op: 'styleEdit', key: 'work', icon: 'board', boxes: true }]));
	for (const shape of ['', 'circle', 'ellipse', 'diamond', 'cylinder'])
		for (const font of t.FONT_SIZES) {
			const n = {
				title: 'Wrapped words in a narrow box',
				code: 'code',
				width: 20,
				minh: 0,
				icon: 'none',
				style: { shape, font },
			};
			const canvas = s.hook.layout(n),
				[w, h] = t.boxHalf(n);
			near(canvas.w, w * 2, 0.00001);
			near(canvas.h, h * 2, 0.00001);
		}
	// A box inherits the icon of its style, and the icon makes room.
	const n = { title: 'Category icon title', code: '', width: 20, minh: 0, cat: 'work', iconPosition: 'above' };
	near(s.hook.layout(n).h, text.layout({ ...n, icon: 'board' }).h, 0.00001);
});

test('hover and hold previews change nothing, apply one batch, and cancel', () => {
	const START = [
		['a', 0, 0],
		['b', 0, -20],
		['c', 0, -60],
	] as const;
	const s = new Session(figure(START.map(([id, x, y]) => [id, x, y, { width: 26, minh: 0 }] as any)));
	const reset = () => s.apply({ op: 'batch', ops: START.map(([id, x, y]) => ({ op: 'move', id, x, y })) });
	const positions = () => JSON.stringify(s.hook.state().nodes.map((n: any) => [n.id, n.x, n.y]));
	const json = positions();
	s.key('t', { altKey: true });
	assert.ok(s.hook.tidyPreview());
	assert.equal(s.ops.length, 0);
	assert.equal(positions(), json);
	s.key('t', {}, 'keyup');
	assert.equal(s.ops.length, 1);
	assert.equal(s.ops[0].op, 'batch');
	assert.ok(!s.hook.tidyPreview());
	reset();
	const sent = s.ops.length;
	s.key('t', { altKey: true });
	s.key('Escape');
	assert.equal(s.ops.length, sent);
	assert.ok(!s.hook.tidyPreview());
	const fire = (el: any, type: string) => el.dispatchEvent(new s.window.Event(type));
	fire(s.button('Tidy up figure', s.inspector), 'mouseenter');
	assert.ok(s.hook.tidyPreview());
	fire(s.button('Tidy up figure', s.inspector), 'mouseleave');
	assert.ok(!s.hook.tidyPreview());
	fire(s.button('Tidy up figure', s.inspector), 'mouseenter');
	s.click(s.button('Tidy up figure', s.inspector));
	assert.equal(s.ops.length, sent + 1);
});
