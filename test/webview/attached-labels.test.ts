import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { loadIcons } from '../lib/env';
import { start, sequence } from '../lib/attached-labels';

// Attached labels: model, real pointer handlers, inheritance and compatibility (ported from scripts/check-attached-labels.cjs;
// the LuaLaTeX position probe of that script is test/tex/attached-labels.test.ts).
const t = loadIcons();

test('drag, inheritance, detach and attach, additional nodes, frame titles, style clipboard and selection echo', () => {
	sequence(start());
});

test('old frame presets become groups; group look edits have no canvas effect', () => {
	for (const frame of t.FRAMES) {
		const f = t.parse(`% sakuga group old {Old} ${frame} blue\n${t.TEMPLATE}`);
		assert.equal(t.groups(f)[0].frame, 'none');
		assert.equal(t.serialize(t.parse(t.serialize(f))), t.serialize(f));
	}
	const f = t.parse(t.TEMPLATE);
	t.apply(f, { op: 'addGroup', id: 'folder', name: 'Folder' });
	t.apply(f, { op: 'groupProps', id: 'folder', fill: 'tint' });
	assert.equal(t.groups(f)[0].fill, undefined);
});

test('label edits retain unanchored routing geometry', () => {
	const s = new Session(
		figure(
			[
				['a', 0, 0, { cat: 'work' }],
				['b', 12, -30, { cat: 'work' }],
			],
			[{ from: 'a', to: 'b', route: 'auto' }],
		),
	);
	const old = s.hook.baseEdgeGeom(s.hook.state().edges[0]);
	s.apply({ op: 'label', index: 0, style: { dx: 2 } });
	assert.ok(s.hook.state().edges[0].labelStyle.dx === 2);
	const edited = s.hook.baseEdgeGeom(s.hook.state().edges[0]);
	assert.equal(JSON.stringify(edited.pts), JSON.stringify(old.pts));
});
