import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parse, serialize, apply, nodes, edges, itemById, titleOf, resolveLook, categories } from '../src/core';
import { legendBlock } from '../src/core/codec/blocks';
import { markOption } from '../src/core/codec/opt-fill';
import { readOptions } from '../src/core/codec/options';
import { darkerColor } from '../src/core/model/colour';

const source = String.raw`% sakuga category tee {TEE} green icon=shield legend
% sakuga layer layer1 {Layer 1}
\begin{tikzpicture}[x=1mm,y=1mm]
\node[sg shape,cat-tee-shape] (a) at (0,0) {A};
\node[sg shape,cat-tee-shape] (b) at (50,0) {B};
\draw[sg conn,cat-tee-conn,sg straight] (a) -- (b);
\draw[sg line,sg id=boundary,cat-tee-line] (0,-10) -- (50,-10);
\end{tikzpicture}`;

test('theme → category → item carries sources and resets through saves and clones', () => {
	let fig = parse(source);
	assert.deepEqual(resolveLook(fig, 'a').fill, { value: 'green', source: { category: 'tee' } });
	assert.equal(resolveLook(fig, 'a').shape.source, 'theme');
	apply(fig, { op: 'setOverride', id: 'a', prop: 'fill', value: '#123456' });
	assert.equal(nodes(fig)[0].cat, 'tee', 'giving a box a colour keeps its category');
	assert.deepEqual(resolveLook(fig, 'a').fill, { value: '#123456', source: 'item' });
	fig = JSON.parse(JSON.stringify(fig));
	fig = parse(serialize(fig));
	apply(fig, { op: 'categoryEdit', key: 'tee', patch: { color: 'blue' } });
	assert.equal(resolveLook(fig, 'a').fill.value, '#123456');
	assert.equal(resolveLook(fig, 'b').fill.value, 'blue');
	apply(fig, { op: 'resetOverride', id: 'a', prop: 'fill' });
	assert.deepEqual(resolveLook(fig, 'a').fill, { value: 'blue', source: { category: 'tee' } });
	apply(fig, { op: 'style', ids: ['a'], style: { fill: 'red' } });
	assert.equal(nodes(fig)[0].cat, 'tee');
});

test('categories map to each kind and text children inherit recursively', () => {
	const fig = parse(source);
	const dark = darkerColor('green');
	assert.equal(resolveLook(fig, edges(fig)[0].id!).color.value, dark);
	assert.equal(resolveLook(fig, 'boundary').color.value, dark);
	const title = titleOf(fig, 'a')!;
	assert.deepEqual(resolveLook(fig, title.id).textColor, { value: dark, source: { category: 'tee' } });
	apply(fig, { op: 'addText', id: 'note', parent: 'a', text: 'Note' });
	assert.equal(resolveLook(fig, 'note').textColor.value, dark);
	apply(fig, { op: 'addGroup', id: 'frame', name: 'Frame' });
	apply(fig, { op: 'setCategory', id: 'frame', category: 'tee' });
	assert.deepEqual(resolveLook(fig, 'frame').titleColor, { value: dark, source: { category: 'tee' } });
	apply(fig, { op: 'addNode', id: 'icon', x: 5, y: 5, title: '', cat: 'tee', kind: 'icon', icon: 'shield' });
	assert.equal(resolveLook(fig, 'icon').textColor.value, dark);
});

test('applying overrides to category/theme updates peers and removes the item source', () => {
	let fig = parse(source);
	apply(fig, { op: 'setOverride', id: 'a', prop: 'fill', value: 'red' });
	apply(fig, { op: 'applyToCategory', id: 'a', prop: 'fill' });
	assert.equal(resolveLook(fig, 'b').fill.value, 'red');
	assert.deepEqual(resolveLook(fig, 'a').fill.source, { category: 'tee' });
	apply(fig, { op: 'setOverride', id: 'a', prop: 'shape', value: 'ellipse' });
	apply(fig, { op: 'applyToTheme', id: 'a', prop: 'shape' });
	assert.deepEqual(resolveLook(fig, 'b').shape, { value: 'ellipse', source: 'theme' });
	fig = parse(serialize(fig));
	assert.deepEqual(resolveLook(fig, 'a').shape, { value: 'ellipse', source: 'theme' });
	apply(fig, { op: 'categoryDelete', key: 'tee' });
	assert.equal(nodes(fig)[0].cat, '');
	assert.equal(categories(fig).length, 0);
});

test('theme header stores house differences, palette and figure font', () => {
	const fig = parse(source);
	apply(fig, {
		op: 'themeEdit',
		kind: 'Shape',
		props: { shape: 'rounded', lineWidth: 0.8 },
		fontSize: 'footnotesize',
		palette: { green: '#112233' },
	});
	const text = serialize(fig);
	assert.match(text, /% sakuga theme shape.lineWidth=0.8/);
	assert.doesNotMatch(text, /% sakuga theme shape.shape=/);
	const back = parse(text);
	assert.equal(resolveLook(back, 'b').fill.value, '#112233');
	assert.equal(resolveLook(back, 'b').font.value, 'footnotesize');
});

test('legacy styles migrate to categories and item overrides with their look', () => {
	const fig = parse(String.raw`% sakuga style box tee {TEE} green shape=ellipse legend
% sakuga style arrow flow {Flow} red dashed lineWidth=0.8
\begin{tikzpicture}
\node[sg style/tee] (a) at (0,0) {A};
\node[sg style/tee] (b) at (50,0) {B};
\draw[sg style/flow,sg straight] (a) -- (b);
\end{tikzpicture}`);
	assert.equal(nodes(fig)[0].style?.shape, 'ellipse');
	assert.equal(edges(fig)[0].style?.lineWidth, 0.8);
	assert.equal(edges(fig)[0].styleKey, undefined);
	assert.doesNotMatch(serialize(fig), /sakuga style |sg style\//);
});

test('legend uses exactly one marker and includes flagged unused categories', () => {
	const fig = parse(source);
	apply(fig, { op: 'categoryAdd', category: { key: 'unused', name: 'Unused', color: 'blue', legend: true } });
	const legend = legendBlock(fig).join('\n');
	assert.equal((legend.match(/sg swatch/g) || []).length, 1);
	assert.equal((legend.match(/\\sgicon\{shield\}/g) || []).length, 1);
	assert.match(legend, /Unused/);
});

test('circle corner marks are inset and smaller than the triangle extent', () => {
	for (const markCorner of ['ne', 'nw', 'se', 'sw'])
		for (const markSize of ['small', 'medium']) {
			const st = { mark: 'circle', markCorner, markSize };
			const text = markOption(st);
			assert.match(text, new RegExp(`radius=${markSize === 'medium' ? '1.25' : '0.6'}mm`));
			assert.equal(readOptions([text]).style.mark, 'circle');
			assert.equal(readOptions([text]).style.markSize || 'small', markSize);
		}
});

test('explicit house defaults retain item sources over a changed theme', () => {
	let fig = parse(source);
	const id = edges(fig)[0].id!;
	apply(fig, { op: 'themeEdit', kind: 'Connector', props: { lineWidth: 1, end: 'Stealth' } });
	apply(fig, { op: 'setOverride', id, prop: 'lineWidth', value: 0.45 });
	apply(fig, { op: 'setOverride', id, prop: 'end', value: 'Latex' });
	const emitted = serialize(fig);
	assert.match(emitted, /sg line width=0.45/);
	assert.match(emitted, /Latex\[length=1.5mm/);
	fig = parse(emitted);
	assert.deepEqual(resolveLook(fig, id).lineWidth, { value: 0.45, source: 'item' });
	assert.deepEqual(resolveLook(fig, id).end, { value: 'Latex', source: 'item' });
});
