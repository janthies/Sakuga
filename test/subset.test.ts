import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { loadIcons, read } from './lib/env';

const t = loadIcons();

test('serializeSubset copies the selected boxes with their styles, groups and the arrows between them, and pastes back', () => {
	const source = read('examples/components.sakuga.tikz');
	const fig = t.parse(source);
	const edge = t.edges(fig)[0];
	const text = t.serializeSubset(fig, [
		{ k: 'node', id: edge.from },
		{ k: 'node', id: edge.to },
	]);
	const lines = text.split('\n');
	assert.equal(lines.filter((l) => /^\\node\[/.test(l)).length, 2);
	assert.equal(lines.filter((l) => /^\\draw\[/.test(l)).length, 1, 'the arrow between the two boxes comes along');
	assert.ok(!text.includes('% sakuga group'));
	assert.ok(!text.includes('% sakuga layer'));
	assert.equal(t.serializeSubset(fig, []), '');
	const target = t.parse(source);
	const { ids } = t.pasteOps(target, text, 5, -5);
	assert.equal(ids.length, 2);
});
