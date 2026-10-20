import { test } from 'node:test';
import { expectGolden, json, roundSvg } from './lib/golden';
import { inputs, loadIcons, read } from './lib/env';
import { boot } from './lib/webview';
import { serializerDump, canvasDump, drift } from './lib/dump';

loadIcons();
const { statePayload } = require('../src/state');
const icons = JSON.parse(read('icons/icons.json'));
const summary: Record<string, unknown> = {};

// Geometry dumps from both sides, the differences between them, and the canvas SVG of the real editor.js in jsdom.
for (const { name, text } of inputs()) {
	test(`geometry and canvas: ${name}`, () => {
		const c = boot(statePayload(text), icons);
		const S = serializerDump(text),
			C = canvasDump(c.hook);
		expectGolden(`geometry/serializer/${name}.json`, json(S));
		expectGolden(`geometry/canvas/${name}.json`, json(C));
		expectGolden(`canvas/${name}.svg`, roundSvg(c.svg) + '\n');
		const items = drift(S, C);
		const finite = items.filter((i) => Number.isFinite(i.mm));
		summary[name] = {
			differing: items.length,
			maxMm: Math.max(0, ...finite.map((i) => i.mm)),
			structural: items.length - finite.length,
			items: items.map((i) => ({ ...i, mm: Number.isFinite(i.mm) ? i.mm : 'structural' })),
		};
	});
}

test('drift between serializer and canvas geometry', () => {
	const all = Object.values(summary) as { differing: number; maxMm: number; structural: number }[];
	const total = {
		objectsDiffering: all.reduce((a, v) => a + v.differing, 0),
		structural: all.reduce((a, v) => a + v.structural, 0),
		maxMm: Math.max(0, ...all.map((v) => v.maxMm)),
	};
	expectGolden('drift.json', json({ total, ...summary }));
});
