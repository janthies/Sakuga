import { store } from '../store/store';
import { calls } from '../store/calls';
import { post } from '../store/model';
import { vscode } from '../platform/host';
import { h } from '../ui/control';
import { TextControl } from '../ui/text';

let sourceFile = 'figure.tikz';
const figureEnv = () => (store.exportTarget.width === 180 ? 'figure*' : 'figure');
function environment(): string {
	const { place, caption, label } = store.figure;
	return `\\begin{${figureEnv()}}[${place}]\n\\centering\n\\input{${sourceFile}}\n\\caption{${caption}}\n\\label{${label}}\n\\end{${figureEnv()}}`;
}
function renderDrawer(file?: string) {
	if (file) sourceFile = file;
	const target = document.getElementById('figure-env');
	if (!target || target.contains(document.activeElement)) return;
	target.replaceChildren();
	const field = (key: 'place' | 'caption' | 'label', before: string, after: string, name: string) => {
		const input = new TextControl({ ariaLabel: name });
		input.set(store.figure[key]);
		input.onCommit((value) => post({ op: 'figure', [key]: value || '' }));
		target.append(h('div', 'figure-source-line', {}, before, input.el, after));
	};
	field('place', `\\begin{${figureEnv()}}[`, ']', 'Placement');
	target.append(h('div', '', {}, '\\centering'), h('div', '', {}, `\\input{${sourceFile}}`));
	field('caption', '\\caption{', '}', 'Caption');
	field('label', '\\label{', '}', 'Figure label');
	target.append(h('div', '', {}, `\\end{${figureEnv()}}`));
}
export function initDrawer() {
	document
		.getElementById('copyFigure')
		?.addEventListener('click', () => vscode.postMessage({ type: 'copyText', text: environment() }));
	renderDrawer();
}
calls.renderDrawer = renderDrawer;
