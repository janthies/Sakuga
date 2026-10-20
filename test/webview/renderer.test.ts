import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { inputs } from '../lib/env';

// The webview's objects come from another realm: compare them as JSON.
const hit = (s: Session, el: any) => JSON.parse(JSON.stringify(s.hook.hit(el)));
const text = (name: string) => inputs().find((i) => i.name === name)!.text;

test('renderer: drawing an unchanged scene touches no element', () => {
	const s = new Session(text('rats-architecture'));
	const seen: any[] = [];
	const obs = new s.window.MutationObserver((r: any[]) => seen.push(...r));
	obs.observe(s.svg, { attributes: true, childList: true, subtree: true, characterData: true });
	s.hook.drawCanvas();
	s.hook.drawCanvas();
	seen.push(...obs.takeRecords());
	assert.equal(seen.length, 0);
});

test('renderer: hit() maps an event target to what the tools need', () => {
	const s = new Session(text('rats-architecture'));
	const st = s.hook.state();
	const node = st.nodes[0];
	assert.deepEqual(hit(s, s.node(node.id)), { k: 'node', id: node.id });
	assert.deepEqual(hit(s, s.svg.querySelector('[data-edge="0"]')), { k: 'edge', index: 0 });
	const group = s.svg.querySelector('[data-group]');
	assert.deepEqual(hit(s, group), { k: 'group', id: group.dataset.group });
	assert.equal(hit(s, s.svg), null, 'the background is nothing');
	// handles appear with the selection
	s.down(node.x, node.y, s.node(node.id));
	s.up(node.x, node.y);
	const resize = s.svg.querySelector('[data-resize]');
	assert.deepEqual(hit(s, resize), { k: 'resize', id: node.id, dir: resize.dataset.resize.split(':')[1] });
	assert.deepEqual(hit(s, s.svg.querySelector('[data-handle]')), { k: 'handle', id: node.id });
	// a label of an arrow carries its reference
	const label = s.svg.querySelector('[data-label]');
	assert.deepEqual(hit(s, label), { k: 'label', ref: JSON.parse(label.dataset.label) });
});

test('renderer: a locked box is a hit target without a node reference', () => {
	const s = new Session(text('rats-architecture'));
	const node = s.hook.state().nodes[0];
	s.apply({ op: 'lock', ids: [node.id], locked: true });
	const locked = s.svg.querySelector('.locked-node');
	assert.ok(locked);
	assert.deepEqual(hit(s, locked), { k: 'locked' });
});
