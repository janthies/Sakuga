import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { commands, commandById, commandForKey, helpRows, runCommand } from '../../src/webview/commands/registry';
import { formatKey, matchKey } from '../../src/webview/commands/registry/keys';
import type { AppState, KeyInfo } from '../../src/webview/commands/registry';

const key = (k: string, m: Partial<KeyInfo> = {}): KeyInfo => ({
	key: k,
	code: m.code ?? '',
	ctrl: false,
	shift: false,
	alt: false,
	...m,
});

// A fake application: boxes a (free) and l (locked), one arrow, and a log of what the commands asked it to do.
function app(over: Partial<{ ids: string[]; ix: number[]; tidyPreview: boolean; label: any; selG: string }> = {}) {
	const log: any[] = [];
	const nodes: any = {
		a: { id: 'a', x: 0, y: 0 },
		l: { id: 'l', x: 5, y: 5, locked: true },
		t: { id: 't', x: 1, y: 1, kind: 'label' },
	};
	const edges = [
		{ route: 'straight', kind: 'arr' },
		{ route: 'curved', kind: 'arr-dashed' },
	];
	const ids = over.ids ?? [];
	const ix = over.ix ?? [];
	const s: any = new Proxy(
		{
			cats: [{ key: 'blue' }, { key: 'red' }],
			layers: [{ id: 'layer1' }],
			activeLayer: 'layer1',
			selG: over.selG ?? null,
			label: over.label ?? null,
			tidyPreview: !!over.tidyPreview,
			tidyHeld: false,
			interaction: undefined,
			routes: ['straight', 'manhattan', 'curved'],
			ids: () => ids,
			ix: () => ix,
			one: () => (ids.length === 1 && !ix.length ? nodes[ids[0]] : null),
			node: (id: string) => nodes[id],
			edge: (i: number) => edges[i],
			blocked: () => false,
			busy: () => false,
			post: (op: any) => log.push(['post', op]),
			tidy: { hold: () => log.push(['hold']), apply: () => log.push(['apply']), cancel: () => log.push(['cancel']) },
			centre: () => ({ x: 4, y: 6 }),
			newId: () => 'n7',
		} as any,
		{ get: (t, p: string) => (p in t ? t[p] : (...a: any[]) => void log.push([p, ...a])) },
	);
	return { s: s as AppState, log };
}
const which = (s: AppState, k: KeyInfo) => commandForKey(s, k)?.id;

test('key patterns: ctrl and alt must match, shift only when listed', () => {
	assert.ok(matchKey('ctrl+a', key('a', { ctrl: true })));
	assert.ok(matchKey('ctrl+a', key('A', { ctrl: true, shift: true })), 'shift is ignored unless listed');
	assert.ok(!matchKey('ctrl+a', key('a')));
	assert.ok(!matchKey('ctrl+a', key('a', { ctrl: true, alt: true })));
	assert.ok(!matchKey('alt+-shift+t', key('t', { alt: true, shift: true })));
	assert.ok(matchKey('shift+code:Digit1', key('!', { code: 'Digit1', shift: true })));
	assert.ok(!matchKey('shift+code:Digit1', key('1', { code: 'Digit1' })));
	assert.ok(matchKey('char', key('x')) && !matchKey('char', key('Enter')));
	assert.equal(formatKey('ctrl+alt+code:KeyC'), 'Ctrl+Alt+C');
	assert.equal(formatKey('escape'), 'Esc');
});

test('ids are unique and every command can be found by id', () => {
	const ids = commands.map((c) => c.id);
	assert.equal(new Set(ids).size, ids.length);
	for (const c of commands) assert.equal(commandById(c.id), c);
});

test('the keyboard picks commands in the old handler order', () => {
	const { s } = app({ ids: ['a'] });
	assert.equal(which(s, key('a', { ctrl: true })), 'selection.all');
	assert.equal(which(s, key('d', { ctrl: true })), 'selection.duplicate');
	assert.equal(which(s, key('g', { ctrl: true })), 'group.group');
	assert.equal(which(s, key('G', { ctrl: true, shift: true })), 'group.ungroup');
	assert.equal(which(s, key('t', { alt: true })), 'sketch.tidy');
	assert.equal(which(s, key('a', { alt: true })), 'sketch.left');
	assert.equal(which(s, key('Enter')), 'box.edit');
	assert.equal(which(s, key('Tab')), 'box.next');
	assert.equal(which(s, key('F2')), 'box.edit');
	assert.equal(which(s, key('ArrowLeft')), 'selection.nudge');
	assert.equal(which(s, key('Delete')), 'selection.delete');
	assert.equal(which(s, key('Escape')), 'selection.clear');
	assert.equal(which(s, key('!', { code: 'Digit1', shift: true })), 'view.fit');
	assert.equal(which(s, key('c', { ctrl: true, alt: true, code: 'KeyC' })), 'style.copy');
	assert.equal(which(s, key(']', { ctrl: true, code: 'BracketRight' })), 'layer.up');
	assert.equal(which(s, key('c', { ctrl: true })), undefined, 'the clipboard belongs to the browser events');
});

test('typing goes to the box title except D and R, and digits pick a style only when it exists', () => {
	const { s } = app({ ids: ['a'] });
	assert.equal(which(s, key('x')), 'box.type');
	assert.equal(which(s, key('d')), undefined, 'D with only a box selected does nothing');
	assert.equal(which(s, key('r')), undefined);
	assert.equal(which(s, key('2', { code: 'Digit2' })), 'selection.category');
	assert.equal(which(s, key('3', { code: 'Digit3' })), 'box.type', 'no third style: the digit is typed');
	assert.equal(which(s, key('!', { code: 'Digit2', shift: true })), 'box.type', 'shift+digit is not a style');
	assert.equal(which(app({ ids: [] }).s, key('x')), undefined, 'nothing selected');
});

test('D and R act on selected arrows', () => {
	const { s } = app({ ix: [0] });
	assert.equal(which(s, key('d')), 'arrow.dashed');
	assert.equal(which(s, key('r')), 'arrow.route');
});

test('Escape clears selection and tidy has no preview command', () => {
	assert.equal(commandById('sketch.tidyCancel'), undefined);
	assert.equal(which(app().s, key('Escape')), 'selection.clear');
});

test('commands return the same ops the key handler built', () => {
	const { s, log } = app({ ids: ['a', 'l'], ix: [0, 1] });
	runCommand(s, 'selection.nudge', key('ArrowUp', { shift: true }));
	assert.deepEqual(log.pop(), ['post', { op: 'batch', ops: [{ op: 'move', id: 'a', x: 0, y: 5 }] }]);
	runCommand(s, 'arrow.route');
	assert.deepEqual(log.pop(), [
		'post',
		{
			op: 'batch',
			ops: [
				{ op: 'arrow', index: 0, route: 'manhattan', mid: null, bend: 0 },
				{ op: 'arrow', index: 1, route: 'manhattan', mid: null, bend: 0 },
			],
		},
	]);
	runCommand(s, 'arrow.dashed');
	assert.deepEqual(
		log.pop()[1].ops.map((o: any) => o.kind),
		['arr-dashed', 'arr-dashed'],
	);
	runCommand(s, 'selection.category', key('2', { code: 'Digit2' }));
	assert.deepEqual(
		log.splice(0).map((l) => l[0]),
		['setLastCat', 'post'],
	);
});

test('toolbar commands are called by id', () => {
	const { s, log } = app();
	assert.ok(runCommand(s, 'node.addLabel'));
	assert.deepEqual(log.splice(0), [
		['pendingEdit', 'n7'],
		['post', { op: 'addNode', kind: 'label', id: 'n7', title: 'Label', cat: '', width: 18, x: 4, y: 6 }],
	]);
	assert.ok(runCommand(s, 'node.addIcon', { icon: 'lock' }));
	assert.equal(log.at(-1)[1].icon, 'lock');
	assert.ok(runCommand(s, 'node.addIcon', {}));
	assert.ok(!runCommand(s, 'no.such.command'));
	runCommand(s, 'sketch.tidy', { preview: false });
	assert.deepEqual(log.at(-1), ['apply']);
	runCommand(s, 'sketch.centerX');
	assert.deepEqual(log.at(-1), ['arrange', 'centerX']);
});

test('the help table is the old table, generated', () => {
	const old = fs.readFileSync(path.join(__dirname, 'shortcuts.expected.json'), 'utf8').trim();
	assert.deepEqual(helpRows(), JSON.parse(old));
});

test('VS Code commands and keybindings in package.json agree with the registry and the host list', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
	const mine = commands.filter((c) => c.vscode);
	const declared = pkg.contributes.commands.map((c: any) => c.command).filter((c: string) => c !== 'sakuga.newFigure');
	assert.deepEqual([...declared].sort(), mine.map((c) => c.vscode).sort());
	for (const c of mine) {
		const bound = pkg.contributes.keybindings.find((k: any) => k.command === c.vscode);
		const pattern = c.keys![0].replace('-shift+', '');
		assert.equal(bound?.key, pattern, `${c.vscode} key`);
	}
	const host = fs.readFileSync(path.join(__dirname, '../../src/host/vscode/commands.ts'), 'utf8');
	const list = [...host.slice(host.indexOf('SKETCH_COMMANDS'), host.indexOf('];')).matchAll(/'(\w+)'/g)].map(
		(m) => m[1],
	);
	assert.deepEqual(list.map((n) => `sakuga.sketch.${n}`).sort(), mine.map((c) => c.vscode).sort());
});
