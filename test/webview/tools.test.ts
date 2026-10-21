import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdleTool, TextEditTool, applyPreview } from '../../src/webview/tools';
import type { CanvasEvent, HitRef, Mods, Selection, Step, Tool, ToolCtx } from '../../src/webview/tools';

// The tools driven with synthetic CanvasEvents on a fake figure: no DOM, no store.
const mods = (m: Partial<Mods> = {}): Mods => ({ ctrl: false, shift: false, alt: false, space: false, ...m });
const box = (id: string, x: number, y: number, more: any = {}) => ({
	id,
	x,
	y,
	width: 20,
	minh: 10,
	cat: 'c',
	...more,
});

class Sim {
	nodes: any[];
	edges: any[];
	groups: any[] = [];
	selection: Selection = { nodes: new Set(), edges: new Set(), group: null, label: null, key: null };
	hover: string | null = null;
	view = { ox: 0, oy: 0 };
	commits: any[] = [];
	steps: Step[] = [];
	tool: Tool;
	idle: IdleTool;
	ctx: ToolCtx;
	constructor(nodes: any[], edges: any[] = []) {
		this.nodes = nodes;
		this.edges = edges;
		const byId = (id: string) => this.nodes.find((n) => n.id === id);
		const layout = (n: any) => ({ w: n.width, h: n.minh });
		const nodeAt = (p: any, m = 0) =>
			[...this.nodes].reverse().find((n) => {
				const { w, h } = layout(n);
				return !n.hidden && !n.locked && Math.abs(p.x - n.x) <= w / 2 + m && Math.abs(p.y - n.y) <= h / 2 + m;
			});
		const self = this;
		this.ctx = {
			get nodes() {
				return self.nodes;
			},
			get edges() {
				return self.edges;
			},
			get groups() {
				return self.groups;
			},
			scale: 4,
			view: () => this.view,
			sel: () => ({ ...this.selection, nodes: new Set(this.selection.nodes), edges: new Set(this.selection.edges) }),
			byId,
			layout,
			snap: (v) => Math.round(v),
			nodeAt,
			descendant: () => false,
			edgeGeom: (e) => ({
				pts: [[byId(e.from).x, byId(e.from).y], ...(e.waypoints ?? []), [byId(e.to).x, byId(e.to).y]],
			}),
			endpointObject: byId,
			endpointTarget: (p) => {
				const n = nodeAt(p, 2);
				return n && { id: n.id, anchor: 'west', offset: 0 };
			},
			dropAnchor: () => null,
			labelDrop: () => null,
			labelTarget: () => null,
			frameTitleGeom: () => null,
			arrowLabelGeom: () => null,
			projectLabel: () => null,
			selBox: (ids) => {
				const b = ids.map((id) => byId(id));
				return {
					x0: Math.min(...b.map((n) => n.x - n.width / 2)),
					x1: Math.max(...b.map((n) => n.x + n.width / 2)),
					y0: Math.min(...b.map((n) => n.y - n.minh / 2)),
					y1: Math.max(...b.map((n) => n.y + n.minh / 2)),
				};
			},
			newId: () => 'n9',
			lastCat: () => 'c',
			clickLayer: (id) => ({ ...this.selection, nodes: new Set([id]), edges: new Set() }),
			duplicateOp: (ids, dx, dy) => ({
				op: { op: 'batch', ops: ids.map((id) => ({ op: 'addNode', x: byId(id).x + dx, y: byId(id).y + dy })) },
				select: ['copy'],
			}),
			hover: () => this.hover,
			tex: (s) => s.replace('_', '\\_'),
			dropDraft: () => {},
		};
		this.idle = new IdleTool(this.ctx);
		this.tool = this.idle;
	}
	apply(step: Step) {
		if (step.select) this.selection = step.select;
		if (step.hover !== undefined) this.hover = step.hover;
		if (step.view) this.view = step.view;
		if (step.preview) applyPreview(this, step.preview);
		if (step.commit) this.commits.push(step.commit);
		this.steps.push(step);
		return step;
	}
	event(x: number, y: number, hit: HitRef, m: Partial<Mods> = {}, extra: Partial<CanvasEvent> = {}): CanvasEvent {
		return { p: { x, y }, screen: { x: x * 4, y: -y * 4 }, button: 0, mods: mods(m), hit, ...extra };
	}
	down(x: number, y: number, hit: HitRef, m: Partial<Mods> = {}, extra: Partial<CanvasEvent> = {}) {
		const step = this.apply(this.idle.down(this.event(x, y, hit, m, extra)));
		this.tool = step.next ?? this.idle;
		return step;
	}
	move(x: number, y: number, m: Partial<Mods> = {}) {
		const step = this.apply(this.tool.move(this.event(x, y, { k: 'none' }, m)));
		if (step.next) this.tool = step.next;
		return step;
	}
	up(x: number, y: number, m: Partial<Mods> = {}) {
		const t = this.tool;
		this.tool = this.idle;
		return this.apply(t.up(this.event(x, y, { k: 'none' }, m)));
	}
}
const two = () => new Sim([box('a', 0, 0), box('b', 60, 0)]);

test('a click selects the box; ctrl toggles, shift adds; a click on nothing clears', () => {
	const s = two();
	s.down(0, 0, { k: 'node', id: 'a' });
	assert.deepEqual([...s.selection.nodes], ['a']);
	s.up(0, 0);
	assert.equal(s.commits.length, 0, 'a click without movement sends nothing');
	s.down(60, 0, { k: 'node', id: 'b' }, { shift: true });
	assert.deepEqual([...s.selection.nodes], ['a', 'b']);
	assert.equal(s.selection.key, 'b', 'the added box becomes the alignment reference');
	s.down(60, 0, { k: 'node', id: 'b' }, { ctrl: true });
	assert.deepEqual([...s.selection.nodes], ['a']);
	assert.equal(s.tool, s.idle, 'ctrl+click starts no drag');
	s.down(200, 200, { k: 'none' });
	assert.equal(s.selection.nodes.size, 0);
});

test('dragging a box previews the move on the grid and commits one batch of move ops', () => {
	const s = two();
	s.down(0, 0, { k: 'node', id: 'a' });
	s.move(10.4, 5.2);
	assert.deepEqual([s.nodes[0].x, s.nodes[0].y], [10, 5], 'the preview moved the box');
	assert.equal(s.commits.length, 0, 'nothing is sent while dragging');
	s.up(10.4, 5.2);
	assert.deepEqual(s.commits, [{ op: 'batch', ops: [{ op: 'move', id: 'a', x: 10, y: 5 }] }]);
});

test('shift locks the drag to one axis, ctrl turns the grid off', () => {
	const s = two();
	s.down(0, 0, { k: 'node', id: 'a' });
	s.move(12, 3, { shift: true });
	assert.deepEqual([s.nodes[0].x, s.nodes[0].y], [12, 0]);
	s.move(12.34, 3.06, { ctrl: true });
	assert.deepEqual([s.nodes[0].x, s.nodes[0].y], [12.3, 3.1]);
});

test('alt+drag leaves the original and commits the duplicate', () => {
	const s = two();
	s.down(0, 0, { k: 'node', id: 'a' }, { alt: true });
	s.move(20, 0, { alt: true });
	assert.equal(s.nodes[0].x, 0, 'the original stays while the copy is dragged');
	const step = s.up(20, 0, { alt: true });
	assert.deepEqual(step.pendingSelect, ['copy']);
	assert.deepEqual(s.commits[0].ops, [{ op: 'addNode', x: 20, y: 0 }]);
});

test('a drag that does not move sends nothing', () => {
	const s = two();
	s.down(0, 0, { k: 'node', id: 'a' });
	s.move(0.2, 0.2);
	s.up(0.2, 0.2);
	assert.equal(s.commits.length, 0);
});

test('the band selects what it encloses and adds to the selection with ctrl', () => {
	const s = new Sim([box('a', 0, 0), box('b', 60, 0), box('c', 0, 40)]);
	s.down(-30, -20, { k: 'none' });
	s.move(80, 20);
	assert.deepEqual([...s.selection.nodes], ['a', 'b']);
	s.move(20, 20);
	assert.deepEqual([...s.selection.nodes], ['a'], 'shrinking the band deselects');
	s.up(20, 20);
	s.down(-30, 30, { k: 'none' }, { ctrl: true });
	s.move(30, 50);
	assert.deepEqual([...s.selection.nodes], ['a', 'c']);
	assert.equal(s.commits.length, 0);
});

test('the band selects an arrow whose end boxes are inside', () => {
	const s = new Sim([box('a', 0, 0), box('b', 60, 0)], [{ from: 'a', to: 'b' }]);
	s.down(-30, -20, { k: 'none' });
	s.move(90, 20);
	assert.deepEqual([...s.selection.edges], [0]);
});

test('the side handle resizes one box on the grid and commits width and position', () => {
	const s = two();
	s.down(10, 0, { k: 'resize', id: 'a', dir: 'e' });
	s.move(16.3, 0);
	assert.equal(s.nodes[0].width, 26);
	assert.equal(s.nodes[0].x, 3);
	s.up(16.3, 0);
	assert.deepEqual(s.commits, [
		{
			op: 'batch',
			ops: [
				{ op: 'node', id: 'a', width: 26 },
				{ op: 'move', id: 'a', x: 3, y: 0 },
			],
		},
	]);
});

test('a corner handle scales the selection about the opposite corner', () => {
	const s = two();
	s.selection = { ...s.selection, nodes: new Set(['a', 'b']) };
	s.down(70, 5, { k: 'scale', dir: 'ne' });
	s.move(70 + 80, 5, { shift: true });
	const [a, b] = s.nodes;
	assert.equal(a.width, 40, 'widths scale with the selection');
	assert.equal(b.x, 60 + (60 - -10) * 1, 'positions scale about the far corner');
	s.up(150, 5);
	assert.equal(s.commits[0].ops.length, 4, 'a width and a move per box');
	assert.equal(s.commits[0].ops[0].op, 'node');
});

test('the dot connects to another box, or opens the wheel in empty space', () => {
	const s = two();
	s.down(10, 0, { k: 'handle', id: 'a' });
	s.move(55, 0);
	assert.equal(s.tool.overlay.connect, 'a');
	s.up(58, 0);
	assert.deepEqual(s.commits[0], {
		op: 'addEdge',
		from: 'a',
		to: 'b',
		fromAnchor: 'east',
		toAnchor: 'west',
		fromOffset: 0,
		toOffset: 0,
	});
	s.down(10, 0, { k: 'handle', id: 'a' });
	const step = s.up(30, 30);
	assert.equal(step.pendingEdit, 'n9');
	assert.deepEqual(s.commits[1], {
		op: 'addNode',
		id: 'n9',
		x: 10,
		y: 0,
		title: 'Box',
		cat: 'c',
		width: 20,
		from: 'a',
	});
});

test('a straight arrow segment is dragged sideways and pinned as a fixed route', () => {
	const s = new Sim(
		[box('a', 0, 0), box('b', 60, 40)],
		[
			{
				from: 'a',
				to: 'b',
				route: 'fixed',
				waypoints: [
					[30, 0],
					[30, 40],
				],
			},
		],
	);
	s.down(30, 20, { k: 'segment', index: 0, j: 1 });
	s.move(41.57, 20);
	assert.deepEqual(s.edges[0].waypoints, [
		[41.6, 0],
		[41.6, 40],
	]);
	s.up(41.57, 20);
	assert.equal(s.commits[0].op, 'arrow');
	assert.equal(s.commits[0].route, 'fixed');
	assert.equal(s.commits[0].index, 0);
});

test('a segment drag below the threshold previews nothing', () => {
	const s = new Sim(
		[box('a', 0, 0), box('b', 60, 40)],
		[
			{
				from: 'a',
				to: 'b',
				waypoints: [
					[30, 0],
					[30, 40],
				],
			},
		],
	);
	s.down(30, 20, { k: 'segment', index: 0, j: 1 });
	const step = s.move(30.1, 20);
	assert.equal(step.preview, undefined);
	assert.equal(step.render, false);
});

test('panning follows the pointer in screen pixels and sends nothing', () => {
	const s = two();
	s.down(0, 0, { k: 'none' }, {}, { button: 1 });
	s.move(5, -5);
	assert.deepEqual(s.view, { ox: 20, oy: 20 });
	s.up(5, -5);
	assert.equal(s.commits.length, 0);
});

test('hover is reported once per box, and a press on a locked box changes nothing on screen', () => {
	const s = two();
	assert.equal(s.apply(s.idle.move(s.event(0, 0, { k: 'none' }))).hover, 'a');
	assert.equal(s.apply(s.idle.move(s.event(1, 1, { k: 'none' }))).render, false, 'same box, no redraw');
	assert.equal(s.down(0, 0, { k: 'locked' }).render, false);
});

test('a double-click edits the box under it, or opens the wheel in empty space', () => {
	const s = two();
	const open = s.apply(s.idle.dbl(s.event(0, 0, { k: 'node', id: 'a' })));
	assert.deepEqual(open.edit, { open: { kind: 'node', id: 'a' }, text: undefined });
	assert.ok(open.next instanceof TextEditTool);
	const fresh = s.apply(s.idle.dbl(s.event(40.4, 30.6, { k: 'none' })));
	assert.deepEqual(fresh.wheel, s.event(40.4, 30.6, { k: 'none' }).screen);
	assert.equal(s.commits.length, 0);
});

test('the text edit commits on Enter and blur, drops on Escape, and a click commits and then acts as a click', () => {
	const s = two();
	const t = s.idle.editNode('a').next as TextEditTool;
	assert.deepEqual(t.key({ key: 'Enter', text: 'My_box / line' }).commit, {
		op: 'batch',
		ops: [{ op: 'node', id: 'a', title: 'My\\_box\\\\line' }],
	});
	assert.equal(t.key({ key: 'Escape', text: 'x' }).commit, undefined);
	assert.equal(t.key({ key: 'blur', text: 'y' }).edit, 'close');
	const down = t.down(s.event(0, 0, { k: 'none' }, {}, { text: 'z' }));
	assert.equal(down.redispatch, true);
	assert.equal(down.commit.ops[0].title, 'z');
});

test('the text edit of an arrow label commits an arrow op', () => {
	const s = new Sim([box('a', 0, 0), box('b', 60, 0)], [{ from: 'a', to: 'b' }]);
	const t = new TextEditTool(s.ctx, { kind: 'edge', index: 0 });
	assert.deepEqual(t.key({ key: 'Enter', text: 'calls_x' }).commit, { op: 'arrow', index: 0, label: 'calls\\_x' });
});

test('a Tab draft is sent only when it has text, and either way the source box stays selected', () => {
	const s = two();
	const draft = {
		node: { id: 'n5' },
		edge: { from: 'a' },
		batch: { op: 'batch', ops: [{ op: 'addNode', title: '' }] },
	};
	const t = new TextEditTool(s.ctx, { kind: 'draft', id: 'n5', draft });
	const empty = t.key({ key: 'Escape', text: '  ' });
	assert.equal(empty.commit, undefined);
	assert.deepEqual([...empty.select.nodes], ['a']);
	const full = t.key({ key: 'Enter', text: 'Next' });
	assert.equal(full.commit, draft.batch);
	assert.equal(draft.batch.ops[0].title, 'Next');
	assert.deepEqual(full.pendingSelect, ['n5']);
});

test('previews change the model in place and nothing else', () => {
	const m = { nodes: [box('a', 0, 0)], edges: [{ labels: [{ style: {} }] }], groups: [{ id: 'g' }] };
	applyPreview(m, {
		nodes: [{ id: 'a', x: 3 }],
		arrows: [{ index: 0, fields: { route: 'fixed' } }],
		label: { ref: { index: 0, slot: 0 }, style: { dx: 1 } },
	});
	applyPreview(m, { label: { ref: { group: 'g' }, style: { dx: 2 }, titlePosition: 'above-left' } });
	assert.equal(m.nodes[0].x, 3);
	assert.equal(m.nodes[0].y, 0);
	assert.equal((m.edges[0] as any).route, 'fixed');
	assert.deepEqual(m.edges[0].labels[0].style, { dx: 1 });
	assert.deepEqual(m.groups[0], { id: 'g', labelStyle: { dx: 2 }, titlePosition: 'above-left' });
});
