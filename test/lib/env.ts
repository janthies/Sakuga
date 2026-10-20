import * as fs from 'node:fs';
import * as path from 'node:path';

export const ROOT = path.resolve(__dirname, '..', '..');
export const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// The inputs of the golden tests: every example and every fixture, as {name, text}.
export function inputs(): { name: string; text: string }[] {
	const list = (dir: string, re: RegExp) =>
		fs
			.readdirSync(path.join(ROOT, dir))
			.filter((f) => re.test(f))
			.sort()
			.map((f) => ({ name: f.replace(/\.tikz$/, '').replace(/\.sakuga$/, ''), text: read(`${dir}/${f}`) }));
	return [...list('examples', /\.sakuga\.tikz$/), ...list('test/fixtures', /\.tikz$/)];
}

// Load the shipped icon catalogue like the host does at activation.
export function loadIcons() {
	const t = require('../../src/core');
	t.setIcons(JSON.parse(read('icons/icons.json')));
	return t;
}
