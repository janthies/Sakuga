import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
	parse,
	serialize,
	apply,
	nodes,
	items,
	itemById,
	childrenOf,
	descendants,
	layers,
	itemsOfLayer,
	titleOf,
	isHidden,
	isLocked,
	edges,
	lineItems,
	reparent,
	detach,
	ungroup,
} from '../src/core';
import { geometryOf } from '../src/core/geometry/figure-geometry';
import { viewModel } from '../src/core/view/viewModel';
import { buildScene } from '../src/core/scene';

const source = String.raw`% sakuga layer back {Back}
% sakuga layer front {Front}
% sakuga group outer {Outer} solid grey
% sakuga group inner {Inner} dashed blue in=outer
\begin{tikzpicture}[x=1mm,y=1mm]
\node[sg box,sg layer=back,sg in=inner] (a) at (0,0) {A\\[-1pt]\sgcode{a()}};
\node[sg box,sg layer=back,sg in=inner] (b) at (50,0) {B};
\node[sg label,anchor=center] (note) at ([shift={(2mm,3mm)}]a.north) {Note};
\draw[arr,sg straight] (a) -- node[sg elabel,above] {Link} (b);
\end{tikzpicture}`;
const node = (fig: ReturnType<typeof parse>, id: string) => nodes(fig).find((n) => n.id === id)!;

test('legacy files become a single tree, with title/code Text and inline connector Text', () => {
	const f = parse(source);
	assert.equal(itemById(f, 'a')?.kind, 'Shape');
	assert.equal(itemById(f, 'note')?.parent, 'a');
	assert.equal(node(f, 'note').layer, 'back');
	assert.equal(itemById(f, 'a')?.parent, 'inner');
	const t = titleOf(f, 'a');
	assert.equal(t?.kind, 'Text');
	if (t?.kind === 'Text') {
		assert.equal(t.text, 'A');
		assert.equal(t.code, 'a()');
	}
	const e = items(f).find((i) => i.kind === 'Connector')!;
	assert.equal(e.parent, 'inner');
	assert.equal(childrenOf(f, e.id)[0].kind, 'Text');
	assert.equal(itemsOfLayer(f, 'front').length, 0);
	assert.equal(new Set(items(f).map((i) => i.id)).size, items(f).length);
	assert.ok(items(f).every((i) => itemById(f, i.parent) || layers(f).some((l) => l.id === i.parent)));
});

test('reparent validates child rules/cycles, preserves coordinates and derives descendant layers', () => {
	const f = parse(source),
		before = [node(f, 'note').x, node(f, 'note').y];
	assert.throws(() => reparent(f, 'a', 'note'), /cannot contain/);
	assert.throws(() => reparent(f, 'outer', 'inner'), /cycle/);
	reparent(f, 'a', 'front');
	assert.equal(node(f, 'note').layer, 'front');
	assert.equal(itemById(f, 'note')?.parent, 'a');
	assert.deepEqual([node(f, 'note').x, node(f, 'note').y], before);
	const e = items(f).find((i) => i.kind === 'Connector')!;
	assert.equal(e.parent, 'front');
	detach(f, 'note');
	assert.equal(itemById(f, 'note')?.parent, 'front');
	assert.equal(node(f, 'note').attachment, undefined);
	assert.deepEqual([node(f, 'note').x, node(f, 'note').y], before);
});

test('moving and deleting act on subtrees; inherited hidden/locked retain child flags', () => {
	const f = parse(source),
		a = node(f, 'a'),
		note = node(f, 'note'),
		old = [note.x, note.y];
	apply(f, { op: 'move', id: 'a', x: a.x + 7, y: a.y - 4 });
	assert.deepEqual([note.x, note.y], [old[0] + 7, old[1] - 4]);
	apply(f, { op: 'hide', ids: ['outer'], hidden: true });
	assert.ok(isHidden(f, note));
	apply(f, { op: 'lock', ids: ['a'], locked: true });
	assert.ok(isLocked(f, note));
	apply(f, { op: 'hide', ids: ['outer'], hidden: false });
	assert.equal(isHidden(f, note), false);
	const saved = parse(serialize(f));
	assert.ok(isLocked(saved, node(saved, 'note')));
	apply(f, { op: 'deleteNode', id: 'a' });
	assert.equal(itemById(f, 'note'), undefined);
	assert.equal(edges(f).length, 0);
});

test('ungroup promotes members one level; deleting a frame removes members and incident connectors', () => {
	const f = parse(source),
		before = nodes(f)
			.map((n) => [n.id, n.x, n.y])
			.sort();
	ungroup(f, 'inner');
	assert.equal(itemById(f, 'inner'), undefined);
	assert.equal(itemById(f, 'a')?.parent, 'outer');
	assert.equal(items(f).find((i) => i.kind === 'Connector')?.parent, 'outer');
	assert.deepEqual(
		nodes(f)
			.map((n) => [n.id, n.x, n.y])
			.sort(),
		before,
	);
	apply(f, { op: 'deleteGroup', id: 'outer' });
	assert.equal(nodes(f).length, 0);
	assert.equal(edges(f).length, 0);
});

test('Lines have two endpoints, Text children, connector ports and fitted frame bounds', () => {
	const f = parse(source);
	apply(f, {
		op: 'addLine',
		id: 'boundary',
		start: [0, -30],
		end: [80, -30],
		parent: 'inner',
		labels: [
			{ text: 'NSW', style: { side: 'above' } },
			{ text: 'SW', style: { side: 'below', pos: 1 } },
		],
	});
	assert.equal(itemById(f, 'boundary')?.kind, 'Line');
	assert.equal(childrenOf(f, 'boundary').length, 2);
	apply(f, { op: 'addEdge', id: 'to-line', from: 'a', to: 'boundary', route: 'straight' });
	apply(f, {
		op: 'endpoint',
		id: 'to-line',
		end: 'target',
		endpoint: { id: 'boundary', port: { side: 'north', position: 0.25 } },
	});
	assert.equal(itemById(f, 'to-line')?.parent, 'inner');
	assert.equal(edges(f).at(-1)?.toOffset, -20);
	assert.ok(geometryOf(f).frame('inner')!.w >= 80);
	const output = serialize(f);
	assert.match(output, /\\draw\[sg line/);
	assert.match(output, /sg conn/);
	assert.match(output, /generated line anchor/);
	assert.ok(
		output.indexOf('generated line anchor') < output.lastIndexOf('\\draw[sg conn'),
		'Line anchors precede connector references',
	);
	const back = parse(output);
	assert.deepEqual(lineItems(back)[0].start, [0, -30]);
	assert.deepEqual(
		childrenOf(back, 'boundary').map((i) => (i.kind === 'Text' ? i.text : '')),
		['NSW', 'SW'],
	);
	assert.equal(serialize(back), output);
	const m = viewModel(output),
		scene = buildScene({ ...m, arrowStyle: m.arrows }, { icons: [] });
	assert.ok(JSON.stringify(scene).includes('line:boundary'));
	apply(f, { op: 'deleteItem', id: 'boundary' });
	assert.equal(itemById(f, 'to-line'), undefined);
});

test('Text identities, title replacement, detach and sibling order survive saves', () => {
	const f = parse(source);
	apply(f, { op: 'addText', id: 'new-title', text: 'New', code: 'new()', parent: 'a', index: 0 });
	assert.equal(titleOf(f, 'a')?.id, 'new-title');
	assert.equal(node(f, 'a').title, 'New');
	assert.ok(childrenOf(f, 'a').some((i) => i.kind === 'Text' && i.text === 'A'));
	const back = parse(serialize(f));
	assert.equal(titleOf(back, 'a')?.id, 'new-title');
	apply(back, { op: 'text', id: 'new-title', text: 'Edited' });
	assert.equal(node(back, 'a').title, 'Edited');
	apply(back, { op: 'detach', id: 'new-title' });
	assert.equal(itemById(back, 'new-title')?.parent, 'inner');
	assert.equal(node(back, 'new-title').title, 'Edited');
	assert.equal(new Set(items(back).map((i) => i.id)).size, items(back).length);
});

test('reparent Text to Line/Connector and detach labels keep their identity and position', () => {
	const f = parse(source);
	apply(f, { op: 'addLine', id: 'line', start: [0, -20], end: [50, -20] });
	apply(f, { op: 'addText', id: 'line-text', text: 'Below', parent: 'line', placement: { side: 'below', pos: 0.75 } });
	assert.equal(childrenOf(f, 'line')[0].id, 'line-text');
	assert.equal(lineItems(f)[0].labels?.[0].style?.side, 'below');
	const saved = parse(serialize(f));
	assert.equal(childrenOf(saved, 'line')[0].id, 'line-text');
	detach(saved, 'line-text');
	assert.equal(node(saved, 'line-text').title, 'Below');
	assert.equal(new Set(items(saved).map((i) => i.id)).size, items(saved).length);
	const connector = items(saved).find((i) => i.kind === 'Connector')!;
	reparent(saved, 'line-text', connector.id);
	assert.ok(descendants(saved, connector.id).some((i) => i.id === 'line-text'));
	assert.equal(
		nodes(saved).some((n) => n.id === 'line-text'),
		false,
	);
});

test('layers select the whole subtree and moving/duplicating layers preserves the tree', () => {
	const f = parse(source);
	apply(f, { op: 'setLayer', ids: ['outer'], layer: 'front' });
	assert.equal(itemsOfLayer(f, 'back').length, 0);
	assert.ok(itemsOfLayer(f, 'front').some((i) => i.id === 'note'));
	apply(f, { op: 'duplicateLayer', id: 'front', newId: 'copy' });
	const copied = itemsOfLayer(f, 'copy');
	assert.ok(copied.some((i) => i.kind === 'Frame'));
	assert.ok(copied.some((i) => i.kind === 'Connector'));
	assert.equal(new Set(items(f).map((i) => i.id)).size, items(f).length);
	apply(f, { op: 'mergeLayers', ids: ['copy'], target: 'front' });
	assert.equal(itemsOfLayer(f, 'copy').length, 0);
});

test('legacy cross-layer attachments become free items without changing their appearance', () => {
	const f = parse(String.raw`% sakuga layer shown {Shown}
% sakuga layer hidden {Hidden} hidden
\begin{tikzpicture}
% sakuga hidden \node[sg box,sg layer=hidden] (parent) at (10,20) {Parent};
\node[sg label,sg layer=shown] (visible) at ([shift={(2mm,3mm)}]parent.center) {Visible};
\end{tikzpicture}`);
	assert.equal(itemById(f, 'visible')?.parent, 'shown');
	assert.deepEqual([node(f, 'visible').x, node(f, 'visible').y], [12, 23]);
	assert.equal(isHidden(f, node(f, 'visible')), false);
});

test('reparent index determines sibling drawing order and survives serialization', () => {
	const f = parse(source);
	reparent(f, 'b', 'inner', 1);
	assert.deepEqual(
		childrenOf(f, 'inner')
			.filter((i) => i.kind === 'Shape' && ['a', 'b'].includes(i.id))
			.map((i) => i.id),
		['b', 'a'],
	);
	assert.deepEqual(
		nodes(f)
			.filter((n) => n.group === 'inner' && ['a', 'b'].includes(n.id))
			.map((n) => n.id),
		['b', 'a'],
	);
	const output = serialize(f),
		back = parse(output);
	assert.equal(serialize(back), output);
	assert.deepEqual(
		childrenOf(back, 'inner')
			.filter((i) => i.kind === 'Shape' && ['a', 'b'].includes(i.id))
			.map((i) => i.id),
		['b', 'a'],
	);
});

test('editing sg in in TikZ changes the parent despite saved structural metadata', () => {
	const saved = serialize(parse(source));
	const edited = saved
		.split('\n')
		.map((line) => (line.includes('] (b) at') ? line.replace('sg in=inner', 'sg in=outer') : line))
		.join('\n');
	const f = parse(edited);
	assert.equal(itemById(f, 'b')?.parent, 'outer');
	assert.equal(items(f).find((i) => i.kind === 'Connector')?.parent, 'outer');
});
