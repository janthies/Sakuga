import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { loadIcons, read } from './lib/env';
import { geometryOf } from '../src/core/geometry/figure-geometry';

const t = loadIcons();

test('geometry is built once per revision of the figure and routes every arrow at most twice', () => {
	const fig = t.parse(read('examples/rats-architecture.sakuga.tikz'));
	const geo = geometryOf(fig);
	assert.equal(geometryOf(fig), geo, 'same content, same geometry');
	const edges = t.edges(fig);
	for (const e of edges) geo.edge(e);
	const first = geo.routed;
	assert.ok(first <= 2 * edges.length, `${first} routings for ${edges.length} arrows`);
	for (const e of edges) {
		geo.edge(e);
		geo.special(e);
		geo.label(e);
	}
	t.serialize(fig);
	assert.equal(geo.routed, first, 'asking again routes nothing');
	t.nodes(fig)[0].x += 5;
	assert.notEqual(geometryOf(fig), geo, 'a changed figure gets a new geometry');
});
