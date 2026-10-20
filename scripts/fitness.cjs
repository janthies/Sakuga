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
	if (!fs.existsSync(path.join(ROOT, dir))) { return; }
	for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
		const rel = `${dir}/${e.name}`;
		if (SKIP.includes(rel)) { continue; }
		if (e.isDirectory()) { yield* walk(rel); } else if (EXT.test(e.name)) { yield rel; }
	}
}

let errors = 0;
let warnings = 0;
for (const file of [...walk('src'), ...walk('media')]) {
	const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
	const lines = text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
	if (lines <= LIMIT) { continue; }
	if (ENFORCED.some(p => file.startsWith(p))) {
		console.error(`error: ${file} has ${lines} lines (limit ${LIMIT})`);
		errors++;
	} else {
		console.warn(`warn:  ${file} has ${lines} lines (limit ${LIMIT}, not enforced yet)`);
		warnings++;
	}
}
console.log(`fitness: ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
