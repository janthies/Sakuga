// Dependency rules of docs/architecture.md section 5. Rules on folders that do not exist yet are valid and pass.
const CORE_ORDER = ['model', 'text', 'schema', 'geometry', 'styles', 'codec', 'ops', 'layout', 'scene'];
const coreModule = (name) => `^src/core/${name}(/|\\.ts$)`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: 'no-circular',
			severity: 'error',
			comment: 'No import cycles anywhere.',
			from: {},
			to: { circular: true },
		},
		{
			name: 'core-pure',
			severity: 'error',
			comment: 'src/core imports only src/core: no Node builtins, no vscode, no npm packages.',
			from: { path: '^src/core/' },
			to: { pathNot: '^src/core/', dependencyTypesNot: ['type-only'] },
		},
		{
			name: 'core-no-platform',
			severity: 'error',
			comment: 'core uses neither Node builtins nor vscode (also as type-only imports).',
			from: { path: '^src/core/' },
			to: { path: ['^vscode$', '^node:'], dependencyTypesNot: [] },
		},
		{
			name: 'core-no-node-builtins',
			severity: 'error',
			from: { path: '^src/core/' },
			to: { dependencyTypes: ['core'] },
		},
		...CORE_ORDER.map((name, i) => ({
			name: `core-layers-${name}`,
			severity: 'error',
			comment: `core/${name} may import only ${CORE_ORDER.slice(0, i).join(', ') || 'nothing in core'} (leftwards only).`,
			from: { path: coreModule(name) },
			to: { path: CORE_ORDER.slice(i + 1).map(coreModule) },
		})),
		{
			name: 'bridge-thin',
			severity: 'error',
			comment: 'src/bridge imports only src/core/model, and only for types.',
			from: { path: '^src/bridge/' },
			to: {
				pathNot: ['^src/bridge/', '^src/core/model(/|\\.ts$)'],
				dependencyTypesNot: ['type-only'],
			},
		},
		{
			name: 'bridge-only-core-model',
			severity: 'error',
			comment: 'src/bridge never reaches into the rest of core, host or webview.',
			from: { path: '^src/bridge/' },
			to: { path: ['^src/host/', '^src/webview/', '^src/core/(?!model(/|\\.ts$))'] },
		},
		{
			name: 'host-no-webview',
			severity: 'error',
			comment: 'Host and webview talk only through src/bridge.',
			from: { path: '^src/host/' },
			to: { path: '^src/webview/' },
		},
		{
			name: 'webview-no-host',
			severity: 'error',
			comment: 'Webview code never imports host code, vscode or Node builtins.',
			from: { path: '^src/webview/' },
			to: { path: '^src/host/' },
		},
		{
			name: 'webview-no-vscode-or-node',
			severity: 'error',
			comment: 'Webview code runs in a browser: no vscode module, no Node builtins.',
			from: { path: '^src/webview/' },
			to: { dependencyTypes: ['core'] },
		},
		{
			name: 'webview-no-vscode-module',
			severity: 'error',
			from: { path: '^src/webview/' },
			to: { path: '^vscode$' },
		},
		{
			name: 'webview-layers',
			severity: 'error',
			comment: 'render, tools and commands do not import panels; panels build on ui.',
			from: { path: '^src/webview/(render|tools|commands)/' },
			to: { path: '^src/webview/panels/' },
		},
	],
	options: {
		doNotFollow: { path: 'node_modules' },
		exclude: { path: ['^src/core/index\\.ts$'] },
		tsPreCompilationDeps: true,
		tsConfig: { fileName: 'tsconfig.host.json' },
		combinedDependencies: false,
	},
};
