import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { loadIcons, read } from './lib/env';

const t = loadIcons();
const { viewModel } = require('../src/core/view/viewModel');
const shared = require('../src/shared');
const { polyline, result } = require('../src/core/geometry/route-base') as any;
const route = require('../src/core/geometry/route');

// Two boxes on the same spot (what "align top" does to the components example) collapse the routed arrow to one point.
test('a zero-length arrow keeps two end points and serializes', () => {
	const source = read('examples/components.sakuga.tikz');
	const p = JSON.parse(JSON.stringify(viewModel(source)));
	const icon = (n: any) => {
		const c = p.categories.find((c: any) => c.key === n.cat);
		return n.icon === 'none' ? '' : n.icon === 'category' || (!n.icon && c?.boxes) ? c?.icon : n.icon;
	};
	const layout = (n: any) => shared.text.layout({ ...n, icon: icon(n) }, p.font);
	const ids = ['app', 'att', 'seam', 'psac', 'entry', 'drv'];
	const fig = t.parse(source);
	t.apply(fig, shared.sketch.arrange(p.nodes, p.groups, ids, null, 'top', layout));
	const g = t.specialGeometry(fig, t.edges(fig)[1]);
	assert.ok(g.pts.length >= 2, 'the router returns at least a start and an end');
	assert.doesNotThrow(() => t.serialize(fig));
});

test('polyline accepts a one-point path', () => {
	assert.equal(typeof route.polyline, 'function');
	assert.doesNotThrow(() => route.polyline([[0, 0]], '(a.south)', '(b.north)'));
	assert.doesNotThrow(() =>
		result([
			[1, 1],
			[1, 1],
		]),
	);
	assert.equal(
		result([
			[1, 1],
			[1, 1],
		]).pts.length,
		2,
	);
	void polyline;
});
