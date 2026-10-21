import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { minDiff, writeDocument } from '../src/host/documentSync';
import { buildTex } from '../src/host/exportService';
import { openFigure } from '../src/host/provider';
import { PROTOCOL } from '../src/bridge/protocol';
import { DEFAULT_SETTINGS } from '../src/host/settings';
import { loadIcons, read } from './lib/env';
import { FakeClipboard, FakeDocument, FakeFiles, FakeSettings, FakeTex, FakeUi, FakeWebview } from './fakes/ports';

const t = loadIcons();
const example = read('examples/components.sakuga.tikz');
const icons = JSON.parse(read('icons/icons.json'));

function setup(text: string) {
	const doc = new FakeDocument(text);
	const view = new FakeWebview();
	const ui = new FakeUi();
	const clipboard = new FakeClipboard();
	const tex = new FakeTex();
	const files = new FakeFiles();
	const settings = new FakeSettings(DEFAULT_SETTINGS);
	const session = openFigure({ doc, view, ui, clipboard, tex, files, settings, icons, fontsDir: '/media' } as any);
	return { doc, view, ui, clipboard, tex, files, session };
}

test('minDiff replaces only the changed middle', () => {
	assert.equal(minDiff('same', 'same'), null);
	assert.deepEqual(minDiff('abcXYZdef', 'abc12def'), { start: 3, end: 6, insert: '12' });
	assert.deepEqual(minDiff('abc', 'abcd'), { start: 3, end: 3, insert: 'd' });
	assert.deepEqual(minDiff('aaa', 'aa'), { start: 2, end: 3, insert: '' });
});

test('writeDocument sends one minimal edit and nothing for equal text', async () => {
	const doc = new FakeDocument('line1\nline2\nline3\n');
	await writeDocument(doc as any, 'line1\nLINE2\nline3\n');
	assert.deepEqual(doc.edits, [{ start: 6, end: 10, text: 'LINE' }]);
	await writeDocument(doc as any, doc.text());
	assert.equal(doc.edits.length, 1);
	assert.equal(doc.text(), 'line1\nLINE2\nline3\n');
});

test('ready sends icons and the state; a foreign protocol is refused', async () => {
	const s = setup(example);
	await s.view.send({ type: 'ready', protocol: PROTOCOL });
	assert.deepEqual(
		s.view.posted.map((m) => m.type),
		['icons', 'state'],
	);
	const other = setup(example);
	await other.view.send({ type: 'ready', protocol: PROTOCOL + 1 });
	assert.equal(other.view.posted.length, 0);
	assert.equal(other.ui.errors.length, 1);
});

test('an op goes through the provider: parse, apply, min-diff write, new state', async () => {
	const s = setup(example);
	const node = t.nodes(t.parse(example))[0];
	const op = { op: 'move', id: node.id, x: node.x + 10, y: node.y };
	const fig = t.parse(example);
	t.apply(fig, op);
	const expected = t.serialize(fig);
	await s.view.send({ type: 'op', op });
	assert.equal(s.doc.text(), expected);
	assert.equal(s.doc.edits.length, 1);
	const last = s.view.posted.at(-1) as any;
	assert.equal(last.type, 'state');
	assert.equal(last.text, expected);
});

test('an empty document gets the template; copy, copyText and error use the ports', async () => {
	const s = setup('');
	await new Promise((r) => setTimeout(r, 10));
	assert.equal(s.doc.text(), t.serialize(t.parse(t.TEMPLATE)));
	await s.view.send({ type: 'copy' });
	await s.view.send({ type: 'copyText', text: 'pre' });
	await s.view.send({ type: 'error', text: 'boom' });
	assert.deepEqual(s.clipboard.written, [t.serialize(t.parse(s.doc.text())), 'pre']);
	assert.deepEqual(s.ui.statuses, ['Sakuga: TikZ copied', 'Sakuga: preamble copied']);
	assert.deepEqual(s.ui.logs, ['webview: boom']);
});

test('exportSvg builds the .tex, runs the runner and writes the SVG; a failure is reported', async () => {
	const s = setup(example);
	await s.view.send({ type: 'exportSvg' });
	assert.deepEqual(s.ui.saveRequests, [['/work/fig', 'svg']]);
	assert.equal(s.tex.jobs.length, 1);
	const job = s.tex.jobs[0];
	assert.equal(job.output, 'svg-pdftocairo');
	assert.equal(job.timeoutMs, 120000);
	assert.equal(job.tex, buildTex(t.serialize(t.parse(example)), DEFAULT_SETTINGS.preamble, '/media'));
	assert.equal(new TextDecoder().decode(s.files.written.get('/out/fig.svg')), '<svg/>');
	assert.deepEqual(s.ui.statuses, ['Sakuga: saved fig.svg']);

	const f = setup(example);
	f.tex.result = { ok: false, error: '! Undefined control sequence.', log: 'files in /tmp/x' };
	await f.view.send({ type: 'exportSvg' });
	assert.equal(f.files.written.size, 0);
	assert.deepEqual(f.ui.errors, ['Sakuga: SVG export failed: ! Undefined control sequence.']);
	assert.deepEqual(f.ui.logs, ['export: ! Undefined control sequence. (files in /tmp/x)']);

	const c = setup(example);
	c.ui.saveTarget = undefined;
	await c.view.send({ type: 'exportSvg' });
	assert.equal(c.tex.jobs.length, 0);
});

test('buildTex has the thesis fonts, the preamble and the figure between the document tags', () => {
	const tex = buildTex('\\begin{tikzpicture}\\end{tikzpicture}', '\\usetikzlibrary{fit}', 'C:\\media');
	assert.match(tex, /\\setsansfont\{OpenSans-Regular\.ttf\}\[Path=C:\/media\/, AutoFakeBold=2, AutoFakeSlant=0\.2\]/);
	assert.match(tex, /\\usetikzlibrary\{fit\}\n\\begin\{document\}\n\\begin\{tikzpicture\}/);
	assert.ok(tex.endsWith('\\end{document}\n'));
});

test('category deletion requires host confirmation and preserves item looks', async () => {
	const s = setup(example);
	const fig = t.parse(s.doc.text());
	const category = t.categories(fig)[0];
	const users = t.items(fig).filter((i: any) => i.kind !== 'Frame' && t.categoryKey(fig, i) === category.key);
	const appearance = (fig: any, id: string) => {
		const values: Record<string, any> = Object.fromEntries(
			Object.entries(t.resolveLook(fig, id)).map(([k, v]: any) => [k, v.value]),
		);
		values.lineWidth ??= ({ thin: 0.45, medium: 0.8, thick: 1.2 } as Record<string, number>)[values.weight] || 0.45;
		return values;
	};
	const before = users.map((i: any) => appearance(fig, i.id));
	s.ui.confirmed = false;
	await s.view.send({ type: 'deleteCategory', key: category.key });
	assert.equal(s.doc.text(), example);
	s.ui.confirmed = true;
	await s.view.send({ type: 'deleteCategory', key: category.key });
	const back = t.parse(s.doc.text());
	assert.equal(
		t.categories(back).some((c: any) => c.key === category.key),
		false,
	);
	assert.equal(s.ui.confirmations.length, 2);
	users.forEach((i: any, n: number) => assert.deepEqual(appearance(back, i.id), before[n]));
});
