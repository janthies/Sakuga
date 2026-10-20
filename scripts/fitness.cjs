// Fitness rule: no source file in src/ or media/ over 400 lines.
// Warning for files that are over today; error under the new layer folders.
const fs = require('fs');
const path = require('path');

const LIMIT = 400;
const ROOT = path.join(__dirname, '..');
const ENFORCED = ['src/core/', 'src/host/', 'src/bridge/', 'src/webview/'];
const EXT = /\.(ts|js|css)$/;
const SKIP = ['media/dist'];

function* walk(dir) {
	if (!fs.existsSync(path.join(ROOT, dir))) {
		return;
	}
	for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
		const rel = `${dir}/${e.name}`;
		if (SKIP.includes(rel)) {
			continue;
		}
		if (e.isDirectory()) {
			yield* walk(rel);
		} else if (EXT.test(e.name)) {
			yield rel;
		}
	}
}

let errors = 0;
let warnings = 0;
for (const file of [...walk('src'), ...walk('media')]) {
	const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
	const lines = text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
	if (lines <= LIMIT) {
		continue;
	}
	if (ENFORCED.some((p) => file.startsWith(p))) {
		console.error(`error: ${file} has ${lines} lines (limit ${LIMIT})`);
		errors++;
	} else {
		console.warn(`warn:  ${file} has ${lines} lines (limit ${LIMIT}, not enforced yet)`);
		warnings++;
	}
}
// Only src/webview/platform may touch acquireVsCodeApi.
for (const file of walk('src/webview')) {
	if (
		!file.startsWith('src/webview/platform/') &&
		/acquireVsCodeApi/.test(fs.readFileSync(path.join(ROOT, file), 'utf8'))
	) {
		console.error(`error: ${file} uses acquireVsCodeApi outside src/webview/platform`);
		errors++;
	}
}
// No @ts-nocheck in src/. Report-only (a warning) until both halves of S14 are merged: src/webview/panels and src/webview/ui still have it.
// When they are typed, set NOCHECK_ENFORCED to true so the rule fails the build.
const NOCHECK_ENFORCED = true;
for (const file of walk('src')) {
	if (/^\s*\/\/\s*@ts-nocheck/m.test(fs.readFileSync(path.join(ROOT, file), 'utf8'))) {
		if (NOCHECK_ENFORCED) {
			console.error(`error: ${file} has @ts-nocheck`);
			errors++;
		} else {
			console.warn(`warn:  ${file} has @ts-nocheck (report-only until S14 is merged)`);
			warnings++;
		}
	}
}
console.log(`fitness: ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
