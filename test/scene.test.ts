import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { expectGolden, json } from './lib/golden';
import { inputs } from './lib/env';
import { sceneOf } from './lib/scene';

// The scene is plain data: the same text gives the same JSON, and it holds no DOM and no view.
for (const { name, text } of inputs()) {
	test(`scene: ${name}`, () => {
		const scene = sceneOf(text);
		expectGolden(`scene/${name}.json`, json(scene));
		assert.deepEqual(JSON.parse(JSON.stringify(scene)), JSON.parse(json(scene)), 'scene survives JSON');
		const keys = new Set<string>();
		const walk = (prims: any[], parent: string) => {
			const seen = new Set<string>();
			for (const p of prims) {
				assert.ok(!seen.has(p.key), `duplicate key ${p.key} under ${parent}`);
				seen.add(p.key);
				assert.ok(!keys.has(p.key), `key ${p.key} reused elsewhere in the scene`);
				keys.add(p.key);
				walk(p.children || [], p.key);
			}
		};
		walk(scene.prims, 'root');
	});
}

test('scene: same input, same scene', () => {
	const { text } = inputs()[0];
	assert.deepEqual(sceneOf(text), sceneOf(text));
});
