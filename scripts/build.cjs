// Bundles with esbuild: out/extension.js (loaded by VS Code), out/tikz.js and out/shared.js (required by scripts/*.cjs and tests),
// and media/dist/shared.js (the webview's SakugaText/SakugaRoutes/SakugaSketch globals until S8).
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
fs.rmSync(path.join(root, 'out'), { recursive: true, force: true });
fs.rmSync(path.join(root, 'media/dist'), { recursive: true, force: true });
esbuild.buildSync({
	absWorkingDir: root,
	entryPoints: { extension: 'src/extension.ts', tikz: 'src/tikz.ts', shared: 'src/shared.ts' },
	outdir: 'out',
	bundle: true,
	platform: 'node',
	format: 'cjs',
	target: 'node18',
	external: ['vscode'],
	sourcemap: true,
	logLevel: 'warning',
});
esbuild.buildSync({
	absWorkingDir: root,
	entryPoints: { shared: 'src/webview-shim.ts' },
	outdir: 'media/dist',
	bundle: true,
	platform: 'browser',
	format: 'iife',
	target: 'es2022',
	logLevel: 'warning',
});
