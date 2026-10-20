import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { expectGolden } from './lib/golden';
import { ROOT, read, loadIcons } from './lib/env';

const t = loadIcons();
const { statePayload } = require('../src/state');
const sketch = require('../src/shared').sketch;
const text = require('../src/shared').text;

// Layout as editor.js passes it to sketch.js: effective icon from the categories, the figure font.
function editorLayout(p: any) {
	const effectiveIcon = (n: any) => {
		const c = p.categories.find((c: any) => c.key === n.cat);
		return n.icon === 'none' ? '' : n.icon === 'category' || (!n.icon && c?.boxes) ? c?.icon : n.icon;
	};
	return (n: any) => text.layout({ ...n, icon: effectiveIcon(n) }, p.font);
}

// The host's op path: parse the document, apply the op, serialize. A throw is part of today's behaviour and is recorded as such.
const run = (source: string, op: any) => {
	try {
		const fig = t.parse(source);
		t.apply(fig, op);
		return t.serialize(fig);
	} catch (e: any) {
		return `%%% THROWS ${e.name}: ${e.message}\n`;
	}
};

const SELECTION: Record<string, string[]> = {
	components: ['app', 'att', 'seam', 'psac', 'entry', 'drv'],
	'rats-architecture': ['app', 'rtos', 'client', 'store', 'crypto', 'ver', 'rp'],
};
const COMMANDS = [
	'left',
	'centerX',
	'right',
	'top',
	'centerY',
	'bottom',
	'distributeX',
	'distributeY',
	'sameW',
	'sameH',
];

for (const [name, ids] of Object.entries(SELECTION)) {
	const source = read(`examples/${name}.sakuga.tikz`);
	test(`arrange and tidy: ${name}`, () => {
		const p = JSON.parse(JSON.stringify(statePayload(source))),
			layout = editorLayout(p);
		const batch = (command: string, key: string | null) =>
			command === 'sameW' || command === 'sameH'
				? sketch.sameSize(p.nodes, ids, key, command === 'sameW' ? 'w' : 'h', layout)
				: sketch.arrange(p.nodes, p.groups, ids, key, command, layout);
		for (const command of COMMANDS) {
			expectGolden(`ops/${name}/${command}.tikz`, run(source, batch(command, null)));
		}
		for (const command of COMMANDS.slice(0, 6)) {
			expectGolden(`ops/${name}/${command}-keyed-${ids[1]}.tikz`, run(source, batch(command, ids[1])));
		}
		expectGolden(`ops/${name}/tidy-selection.tikz`, run(source, sketch.tidy(p.nodes, p.groups, p.edges, ids, layout)));
		expectGolden(`ops/${name}/tidy-figure.tikz`, run(source, sketch.tidy(p.nodes, p.groups, p.edges, [], layout)));
	});
}

// scripts/build-rats-architecture.cjs, run unchanged against the sources with its file writes captured.
test('build-rats-architecture output', () => {
	const file = path.join(ROOT, 'scripts/build-rats-architecture.cjs');
	const writes: Record<string, string> = {};
	const fakeFs = {
		writeFileSync: (f: string, d: string) => {
			writes[path.relative(ROOT, f)] = d;
		},
		mkdirSync: () => undefined,
	};
	const req = (id: string) =>
		id === '../out/tikz.js' ? require('../src/tikz') : id === 'node:fs' ? fakeFs : require(id);
	const log = console.log;
	console.log = () => undefined;
	try {
		vm.runInNewContext(`(function(require,__dirname,console){${read('scripts/build-rats-architecture.cjs')}\n})`, {
			Error,
			Object,
			JSON,
		})(req, path.dirname(file), console);
	} finally {
		console.log = log;
	}
	assert.deepEqual(Object.keys(writes).sort(), [
		'examples/rats-architecture.sakuga.tikz',
		'work/feature-arch/sakuga-02-v3.tex',
	]);
	expectGolden('ops/build-rats-architecture.tikz', writes['examples/rats-architecture.sakuga.tikz']);
	expectGolden(
		'ops/build-rats-architecture-standalone.tex',
		writes['work/feature-arch/sakuga-02-v3.tex'].split(ROOT).join('<root>'),
	);
});

// One sequence over styles, labels, layers and paste, with the figure after every step.
test('sequence: styles, labels, layers, paste', () => {
	let source = read('examples/components.sakuga.tikz');
	const pasted = read('examples/state-machine.sakuga.tikz');
	const steps: any[] = [
		{ op: 'styleAdd', kind: 'box', name: 'Hot path', props: { fill: 'red', weight: 'thick' }, legend: true },
		{ op: 'style', ids: ['app'], style: { fill: 'blue', text: 'bold' } },
		{ op: 'styleAdd', kind: 'box', name: 'Soft', from: { id: 'psac' } },
		{ op: 'styleEdit', key: 'hot-path', props: { fill: 'green', weight: 'thick' } },
		{ op: 'styleUpdate', key: 'soft', id: 'app' },
		{ op: 'resetStyle', ids: ['app'] },
		{
			op: 'label',
			index: 0,
			text: 'calls',
			style: { side: 'above', pos: 0.25, dx: 1, dy: 2, font: 'scriptsize', bold: true },
		},
		{ op: 'label', group: 'g1', style: { dx: 2, dy: 1, font: 'small' } },
		{ op: 'addLayer', id: 'back', name: 'Back' },
		{ op: 'setLayer', ids: ['hw', 'drv'], layer: 'back' },
		{ op: 'layerProps', id: 'back', opacity: 0.5, locked: true },
		{ op: 'duplicateLayer', id: 'back', newId: 'copy' },
		{ op: 'layerProps', id: 'copy', hidden: true },
		{ op: 'reorderLayers', order: ['back', 'layer1', 'copy'] },
		{ op: 'mergeLayers', ids: ['copy'], target: 'back' },
	];
	let log = '';
	const record = (label: string) => {
		log += `%%%%% ${label}\n${source}`;
	};
	record('start');
	for (const op of steps) {
		source = run(source, op);
		record(JSON.stringify(op));
	}
	// Paste exactly as the host does: pasteOps on the current document, addNode ops moved to the active layer, then one batch.
	const fig = t.parse(source);
	const { ops, ids } = t.pasteOps(fig, pasted, 5, -5);
	t.apply(fig, { op: 'batch', ops: ops.map((op: any) => (op.op === 'addNode' ? { ...op, layer: 'back' } : op)) });
	source = t.serialize(fig);
	record(`paste state-machine at (5,-5), new ids ${ids.join(',')}`);
	expectGolden('ops/sequence-styles-labels-layers-paste.tikz', log);
});
