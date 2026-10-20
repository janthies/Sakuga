import type { Settings } from './settings';

export interface PageEnv {
	/** Content-security-policy source of the webview. */
	cspSource: string;
	/** URL of a file in media/. */
	uri(file: string): string;
	nonce: string;
}

export function page(env: PageEnv, settings: Pick<Settings, 'preamble'>): string {
	const { cspSource, nonce } = env;
	const uri = env.uri;
	const PREAMBLE = settings.preamble;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource}; font-src ${cspSource}; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
@font-face { font-family: 'Sakuga Sans'; src: url('${uri('OpenSans-Regular.ttf')}'); }
@font-face { font-family: 'Sakuga Mono'; src: url('${uri('texgyrecursor-regular.otf')}'); }
</style>
<link rel="stylesheet" href="${uri('codicons.css')}">
<link rel="stylesheet" href="${uri('editor.css')}">
</head>
<body>
<header id="bar">
	<button id="drawerToggle" class="tbtn" aria-label="TikZ source and preamble" aria-pressed="false" aria-controls="drawer" title="TikZ source and preamble"><i class="ci ci-menu"></i></button>
	<span class="vsep"></span>
	<button id="addBox" class="tool" title="Place a box"><i class="ci ci-add"></i>Box</button>
	<button id="addLabel" class="tool" title="Place a free text label"><i class="ci ci-add"></i>Label</button>
	<span id="addIcon" class="tool" title="Place a free icon"><span class="lbl">Icon</span></span>
	<span class="grow"></span>
	<button id="help" class="tbtn" aria-label="Keyboard shortcuts" aria-controls="keys"><i class="ci ci-question"></i></button>
	<table id="keys"></table>
	<button id="exportSvg" title="Set the figure with LuaLaTeX in the look of your thesis and save it as SVG"><i class="ci ci-export"></i>Export SVG</button>
</header>
<div id="main">
	<aside id="drawer" aria-label="TikZ source">
		<div class="drawer-in">
			<div class="phead" title="The figure itself. Paste it where the figure goes, for example inside a figure environment.">
				<span>TikZ source</span><button id="copySrc"><i class="ci ci-copy"></i>Copy</button>
			</div>
			<textarea id="src" aria-label="TikZ source" spellcheck="false"></textarea>
			<details id="preamble">
				<summary title="Goes once into the preamble of your document, before \\begin{document}. Without these libraries the figure does not compile."><i class="ci ci-chevron-right"></i>Preamble</summary>
				<div class="pre-body"><pre id="pre">${PREAMBLE}</pre><button id="copyPre"><i class="ci ci-copy"></i>Copy</button></div>
			</details>
		</div>
	</aside>
	<div id="desk">
		<svg id="canvas" aria-label="Figure canvas"></svg>
		<div id="zoombar"><span id="zi-size"></span><span class="vsep"></span><span id="zi-zoom" title="100 % is true size on screen"></span><button id="fitw" title="Fit the whole figure">Fit</button></div>
	</div>
	<aside id="sidebar" data-tab="figure">
		<nav id="tabs" role="tablist"><button role="tab" data-tab="figure" aria-selected="true">Figure</button><button role="tab" data-tab="selection">Selection<span id="tab-count"></span></button></nav>
		<div id="inspector"></div>
		<div id="splitter" role="separator" tabindex="0" aria-label="Resize Layers panel" aria-orientation="horizontal" title="Drag to resize, double-click to reset"></div>
		<section id="layers"><header class="lhead"><h3>Layers</h3><div id="layer-tools"><button id="group">Group</button><button id="ungroup">Ungroup</button></div></header><div id="layer-list" role="tree" aria-label="Layers"></div></section>
	</aside>
</div>
<input id="edit" type="text" spellcheck="false">
<div id="etools"></div>
<script nonce="${nonce}" src="${uri('dist/webview.js')}"></script>
</body>
</html>`;
}
