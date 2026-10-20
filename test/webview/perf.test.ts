import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { inputs } from '../lib/env';
import { sceneOf } from '../lib/scene';

const rats = inputs().find((i) => i.name === 'rats-architecture')!.text;

// Every DOM mutation under the canvas between observe() and take().
function watch(s: Session) {
	const seen: any[] = [];
	const obs = new s.window.MutationObserver((r: any[]) => seen.push(...r));
	obs.observe(s.svg, { attributes: true, childList: true, subtree: true, characterData: true });
	return {
		take() {
			seen.push(...obs.takeRecords());
			return seen.splice(0);
		},
	};
}
const touched = (records: any[]) => new Set(records.map((r) => r.target));
// The element directly under `root` that contains `el`.
const branch = (el: any, root: any) => {
	while (el && el.parentNode !== root) el = el.parentNode;
	return el;
};

test('perf: dragging one box patches only that box, its arrows and its frames', () => {
	const s = new Session(rats);
	const state = s.hook.state();
	const edgesOf = (id: string) => state.edges.filter((e: any) => e.from === id || e.to === id).length;
	// a box with arrows in the middle of the figure
	const node = state.nodes.find((n: any) => edgesOf(n.id) >= 2 && !n.hidden);
	const view = s.svg.querySelector('g.view');
	const total = view.querySelectorAll('*').length;
	const w = watch(s);
	s.down(node.x, node.y, s.node(node.id));
	w.take();
	s.move(node.x + 3, node.y + 2);
	const records = w.take();
	const layers = [...view.children];
	const [frames, nodes, edges] = layers;
	const inScene = (r: any) => view.contains(r.target);
	const changed = (layer: any) => new Set(records.map((r) => branch(r.target, layer)).filter(Boolean)).size;
	console.log(
		`drag: ${records.length} mutations, ${touched(records.filter(inScene)).size} of ${total} scene elements touched, ` +
			`${touched(records.filter((r) => !inScene(r))).size} overlay elements; ` +
			`nodes ${changed(nodes)}, arrows ${changed(edges)} (of ${edgesOf(node.id)} connected), frames ${changed(frames)}`,
	);
	assert.ok(records.length > 0, 'the move is drawn');
	assert.equal(changed(nodes), 1, 'one box group changes');
	assert.equal(changed(edges), edgesOf(node.id), 'only the arrows that start or end at the box change');
	assert.ok(
		touched(records.filter(inScene)).size < total / 5,
		`fewer than a fifth of the ${total} scene elements are touched`,
	);
	s.up(node.x + 3, node.y + 2);
});

test('perf: panning and zooming change the view transform and nothing else', () => {
	const s = new Session(rats);
	const w = watch(s);
	const wheel = (init: any) =>
		s.svg.dispatchEvent(new s.window.WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }));
	w.take();
	wheel({ deltaX: 30, deltaY: -20 });
	let records = w.take();
	assert.equal(records.length, 1, 'panning is one attribute');
	assert.equal(records[0].attributeName, 'transform');
	wheel({ ctrlKey: true, deltaY: -50, clientX: 400, clientY: 300 });
	records = w.take();
	assert.equal(records.length, 1, 'zooming is one attribute');
	assert.equal(records[0].attributeName, 'transform');
});

// The budget for one full render (scene build, then patch of a mounted canvas; the panels are not part of it) of any example, on a CI machine.
// Measured on the development machine: build 3 to 8 ms, drawCanvas 3 to 6 ms in jsdom, a tenth of the budget.
const BUDGET_MS = { build: 50, render: 50 };
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const timed = (f: () => void) => {
	f();
	const t: number[] = [];
	for (let i = 0; i < 7; i++) {
		const t0 = performance.now();
		f();
		t.push(performance.now() - t0);
	}
	return median(t);
};

test('perf: a full render of every example stays inside its time budget', () => {
	const rows = inputs().map(({ name, text }) => {
		const count = (ps: any[]): number => ps.reduce((n, p) => n + 1 + count(p.children || []), 0);
		const s = new Session(text);
		return {
			name,
			prims: count(sceneOf(text).prims),
			build: timed(() => sceneOf(text)),
			render: timed(() => s.hook.drawCanvas()),
		};
	});
	rows.sort((a, b) => b.prims - a.prims);
	for (const r of rows.slice(0, 3))
		console.log(
			`${r.name}: ${r.prims} primitives, buildScene ${r.build.toFixed(1)} ms, drawCanvas() ${r.render.toFixed(1)} ms`,
		);
	for (const r of rows) {
		assert.ok(r.build < BUDGET_MS.build, `${r.name}: buildScene ${r.build} ms`);
		assert.ok(r.render < BUDGET_MS.render, `${r.name}: render ${r.render} ms`);
	}
});
