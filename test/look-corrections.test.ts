import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
	parse,
	serialize,
	apply,
	categories,
	nodes,
	groups,
	itemById,
	childrenOf,
	resolveLook,
	isHidden,
	lineItems,
} from '../src/core';
import { geometryOf } from '../src/core/geometry/figure-geometry';
import { nodeIcon } from '../src/core/geometry/boxes';
import { viewModel } from '../src/core/view/viewModel';
import { buildScene } from '../src/core/scene';

const source = String.raw`% sakuga category work {Work} color=blue legend
% sakuga layer layer1 {Layer 1}
\begin{tikzpicture}[x=1mm,y=1mm]
\node[sg shape,cat-work-shape] (a) at (0,0) {A};
\node[sg shape] (b) at (60,0) {B};
\node[sg shape] (c) at (20,-30) {C};
\end{tikzpicture}`;
const n = (f: ReturnType<typeof parse>, id: string) => nodes(f).find((v) => v.id === id)!;
const roundtrip = (f: ReturnType<typeof parse>) => {
	const text = serialize(f),
		back = parse(text);
	assert.equal(serialize(back), text);
	return back;
};

test('marker exclusivity, independent surface defaults, migration and category deletion', () => {
	const f = parse(source.replace('color=blue', 'green icon=shield font=large text=bold'));
	const cat = categories(f)[0];
	const outlined = parse(source.replace('color=blue', 'green icon=shield color=red'));
	assert.equal(categories(outlined)[0].fill, 'green');
	assert.equal(categories(outlined)[0].outlineColor, 'red');
	roundtrip(outlined);
	assert.equal(cat.icon, 'shield');
	assert.equal(cat.color, undefined);
	assert.equal(cat.fill, 'green');
	assert.equal(n(f, 'a').style?.font, 'large');
	assert.ok(childrenOf(f, 'a').some((i) => i.kind === 'Icon' && i.node.icon === 'shield'));
	apply(f, { op: 'reparent', id: 'b', newParent: 'a' });
	assert.equal(n(f, 'b').slot, 'below');
	assert.doesNotMatch(serialize(f), /category .*font=|category .*text=/);
	assert.match(serialize(f), /category work \{Work\} icon=shield fill=green/);
	const before = { ...n(f, 'a').style };
	apply(f, { op: 'categoryDelete', key: 'work' });
	assert.deepEqual(n(f, 'a').style, before);
	assert.equal(n(f, 'a').cat, '');
	assert.ok(childrenOf(f, 'a').some((i) => i.kind === 'Icon' && i.node.icon === 'shield'));
	roundtrip(f);
	const fresh = parse(source);
	apply(fresh, { op: 'categoryAdd', category: { key: 'icon', name: 'Icon', icon: 'shield' } });
	apply(fresh, { op: 'setCategory', id: 'b', category: 'icon' });
	assert.equal(resolveLook(fresh, 'b').fill.value, 'none');
	apply(fresh, { op: 'categoryEdit', key: 'icon', patch: { fill: 'yellow', outline: 'dotted', outlineColor: 'red' } });
	assert.equal(resolveLook(fresh, 'b').fill.value, 'yellow');
	assert.equal(resolveLook(fresh, 'b').color.value, 'red');
	apply(fresh, { op: 'categoryEdit', key: 'icon', patch: { color: 'peach' } });
	assert.equal(categories(fresh).find((c) => c.key === 'icon')?.icon, undefined);
	roundtrip(fresh);
});

test('legacy drawn frames become background boxes with attached labels; groups never draw', () => {
	const f = parse(
		source
			.replace(
				'\\begin{tikzpicture}',
				'% sakuga group g {Region} region blue titlePosition=inside-top-left\n\\begin{tikzpicture}',
			)
			.replace('(a) at', '(a) at')
			.replace('cat-work-shape]', 'cat-work-shape,sg in=g]'),
	);
	assert.equal(groups(f)[0].frame, 'none');
	assert.equal(groups(f)[0].fill, undefined);
	const bg = n(f, 'g-background');
	assert.ok(bg);
	assert.equal(itemById(f, bg.id)?.parent, 'g');
	assert.equal(itemById(f, 'g-label')?.parent, bg.id);
	assert.equal(n(f, 'g-label').title, 'Region');
	assert.equal(childrenOf(f, 'g')[0].id, bg.id);
	const m = viewModel(serialize(f));
	const scene = JSON.stringify(buildScene({ ...m, arrowStyle: m.arrows }, { icons: [] }));
	assert.ok(!scene.includes('group-frame'));
	assert.ok(scene.includes('g-background'));
	const b = geometryOf(f).frame('g')!;
	assert.ok(b.w >= geometryOf(f).size(bg).w);
	roundtrip(f);
});

test('all nesting combinations keep placement, move with box parents and detach one level', () => {
	const f = parse(source);
	apply(f, { op: 'addGroup', id: 'outer', name: 'Outer' });
	apply(f, { op: 'reparent', id: 'a', newParent: 'outer' });
	apply(f, { op: 'reparent', id: 'b', newParent: 'a' });
	assert.equal(n(f, 'b').slot, 'below');
	assert.notEqual(n(f, 'b').attachment?.anchor, 'center');
	apply(f, { op: 'addGroup', id: 'inner', name: 'Inner' });
	apply(f, { op: 'reparent', id: 'c', newParent: 'inner' });
	apply(f, { op: 'reparent', id: 'inner', newParent: 'b' });
	apply(f, { op: 'addLine', id: 'line', start: [10, 20], end: [30, 20] });
	apply(f, { op: 'reparent', id: 'line', newParent: 'b' });
	apply(f, { op: 'addText', id: 'note', parent: 'b', text: 'Note', x: 62, y: 8 });
	let back = roundtrip(f);
	for (const [id, parent] of [
		['a', 'outer'],
		['b', 'a'],
		['inner', 'b'],
		['c', 'inner'],
		['line', 'b'],
		['note', 'b'],
	])
		assert.equal(itemById(back, id)?.parent, parent);
	const old = [n(back, 'c').x, n(back, 'c').y],
		start = [...lineItems(back)[0].start],
		origin = [n(back, 'b').x, n(back, 'b').y];
	apply(back, { op: 'slot', id: 'b', slot: 'outside-right' });
	const dx = n(back, 'b').x - origin[0],
		dy = n(back, 'b').y - origin[1];
	for (const [actual, expected] of [
		[
			[n(back, 'c').x, n(back, 'c').y],
			[old[0] + dx, old[1] + dy],
		],
		[lineItems(back)[0].start, [start[0] + dx, start[1] + dy]],
	])
		actual.forEach((v, k) => assert.ok(Math.abs(v - expected[k]) < 1e-12));
	apply(back, { op: 'ungroup', id: 'b' });
	assert.equal(itemById(back, 'b')?.parent, 'outer');
	const outsidePoint = [n(back, 'a').x, n(back, 'a').y];
	apply(back, { op: 'ungroup', id: 'inner' });
	assert.equal(itemById(back, 'c')?.parent, 'b');
	assert.ok(n(back, 'c').slot);
	assert.deepEqual([n(back, 'a').x, n(back, 'a').y], outsidePoint);
	back = roundtrip(back);
	assert.equal(itemById(back, 'c')?.parent, 'b');
});

test('every item can be hidden with its subtree and incident arrows, then restored', () => {
	const f = parse(source);
	apply(f, { op: 'addGroup', id: 'g', name: 'Group' });
	apply(f, { op: 'reparent', id: 'a', newParent: 'g' });
	apply(f, { op: 'addNode', id: 'symbol', title: '', cat: '', kind: 'icon', icon: 'shield', x: 4, y: 4 });
	apply(f, { op: 'addLine', id: 'line', start: [0, 20], end: [30, 20] });
	apply(f, { op: 'addEdge', id: 'arrow', from: 'a', to: 'b' });
	for (const id of ['g', 'a', 'a-title', 'symbol', 'line', 'arrow']) {
		apply(f, { op: 'hide', ids: [id], hidden: true });
		const back = roundtrip(f);
		assert.equal(itemById(back, id)?.hidden, true);
		if (id === 'g') assert.ok(isHidden(back, n(back, 'a')));
		apply(f, { op: 'hide', ids: [id], hidden: false });
		assert.equal(itemById(roundtrip(f), id)?.hidden, false);
	}
});

test('figure header and upward triangle survive editing and saving', () => {
	const f = parse(source);
	apply(f, { op: 'figure', place: 'htbp', label: 'fig:nesting', caption: 'Nested {boxes}' });
	apply(f, { op: 'setOverride', id: 'a', prop: 'shape', value: 'triangle' });
	assert.match(serialize(f), /regular polygon, regular polygon sides=3/);
	const back = roundtrip(f);
	assert.deepEqual(back.figure, f.figure);
	assert.equal(n(back, 'a').style?.shape, 'triangle');
});
