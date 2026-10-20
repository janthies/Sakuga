import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { expectGolden, json } from './lib/golden';
import { inputs, loadIcons } from './lib/env';

const t = loadIcons();
const { statePayload } = require('../src/state');

// serialize(parse(text)), the model, and the host 'state' payload for every example and fixture.
const identity: Record<string, boolean> = {};
for (const { name, text } of inputs()) {
	test(`roundtrip, model and state: ${name}`, () => {
		const out = t.serialize(t.parse(text));
		identity[name] = out === text;
		expectGolden(`roundtrip/${name}.tikz`, out);
		expectGolden(`model/${name}.json`, json(t.parse(text)));
		// The webview receives the payload through structured clone, so undefined fields are gone.
		expectGolden(`state/${name}.json`, json(JSON.parse(JSON.stringify(statePayload(text)))));
	});
}

test('which inputs round-trip byte-identically today', () => {
	expectGolden('roundtrip/_identity.json', json(identity));
	for (const { name, text } of inputs()) {
		if (identity[name]) { assert.equal(t.serialize(t.parse(text)), text); }
	}
});
