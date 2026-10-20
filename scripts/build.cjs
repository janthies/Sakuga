// Bundles the extension with esbuild: out/extension.js (loaded by VS Code) and out/tikz.js (required by scripts/*.cjs and tests).
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
fs.rmSync(path.join(root, 'out'), { recursive: true, force: true });
esbuild.buildSync({
	absWorkingDir: root,
	entryPoints: { extension: 'src/extension.ts', tikz: 'src/tikz.ts' },
	outdir: 'out',
	bundle: true,
	platform: 'node',
	format: 'cjs',
	target: 'node18',
	external: ['vscode'],
	sourcemap: true,
	logLevel: 'warning',
});
