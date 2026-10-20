import * as fs from 'node:fs';
import * as path from 'node:path';
import * as assert from 'node:assert/strict';

const ROOT = path.resolve(__dirname, '..', 'golden');

// Byte-exact compare against test/golden/<name>; UPDATE_GOLDEN=1 writes the file instead. Nothing is normalised.
export function expectGolden(name: string, actual: string): void {
	const file = path.join(ROOT, name);
	if (process.env.UPDATE_GOLDEN === '1') {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, actual);
		return;
	}
	assert.ok(fs.existsSync(file), `missing golden ${name} (run with UPDATE_GOLDEN=1)`);
	assert.equal(actual, fs.readFileSync(file, 'utf8'), `golden ${name} differs`);
}

// Floats are rounded to 4 decimals (0.0001 mm) so a different Node version cannot flip a last digit.
const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
export const json = (v: unknown) =>
	JSON.stringify(v, (_k, x) => (typeof x === 'number' && Number.isFinite(x) ? r4(x) : x), 1) + '\n';
// Hex colours such as #9e9e9e are not numbers: the lookbehind keeps "9e9" from being read as 9e9.
export const roundSvg = (s: string) => s.replace(/(?<![#\w])-?\d+\.\d+(?:e[-+]?\d+)?/g, (m) => String(r4(Number(m))));
