import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';

// Layers, objects, opacity, the inspector panes and the canvas drawing (ported from scripts/check-layerui.cjs).
const SETUP = [
	{ op: 'addLayer', id: 'back', name: 'Back' },
	{ op: 'addLayer', id: 'front', name: 'Front' },
	{ op: 'layerProps', id: 'back', opacity: 0.5 },
	{ op: 'setLayer', ids: ['outer', 'inner'], layer: 'back' },
	{ op: 'setLayer', ids: ['target'], layer: 'front' },
	{ op: 'deleteLayer', id: 'layer1' },
];
const make = () => {
	const s = new Session(
		figure(
			[
				['outer', 0, 0, { title: '', width: 80, minh: 60 }],
				['inner', 0, 0, { width: 18, minh: 10, style: { opacity: 0.3 } }],
				['target', 70, 0, { width: 18, minh: 10 }],
			],
			[{ from: 'inner', to: 'target', kind: 'arr', route: 'straight', head: 'end', style: { opacity: 0.3 } }],
			SETUP,
		),
	);
	// The layout of the original harness: an 800 x 600 canvas and a layer list of 200 px with rows of 24 px.
	s.svg.getBoundingClientRect = () => ({
		x: 0,
		y: 0,
		left: 0,
		top: 0,
		right: 800,
		bottom: 600,
		width: 800,
		height: 600,
	});
	const list = s.document.getElementById('layer-list');
	list.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 200, width: 800, height: 200 });
	return { s, list, doc: s.doc };
};

const ev = (s: Session, type: string, extra: Record<string, unknown> = {}) => {
	const e = new s.window.Event(type, { bubbles: true, cancelable: true });
	for (const [k, v] of Object.entries(extra)) {
		Object.defineProperty(e, k, { value: v });
	}
	return e;
};

test('layer and object deletion, opacity controls, add-at-centre editing, drop feedback and autoscroll', () => {
	const { s, list, doc } = make();
	const proto = s.window.HTMLElement.prototype,
		rectOf = s.window.Element.prototype.getBoundingClientRect;
	Object.defineProperty(proto, 'offsetHeight', {
		configurable: true,
		get() {
			return this.classList.contains('layer-row') ? 24 : 0;
		},
	});
	s.window.Element.prototype.getBoundingClientRect = function () {
		return this.classList?.contains('layer-row')
			? { top: 0, bottom: 24, left: 0, right: 800, width: 800, height: 24 }
			: rectOf.call(this);
	};
	const controls = () => s.document.getElementById('layer-controls');
	const button = (label: string) => [...controls().children].find((e: any) => e.textContent === label) as any;
	const row = (id: string) => list.querySelector(`[data-id="${id}"]`);
	const opacityRow = () => s.document.querySelector('.opacity-row');
	const fire = (el: any, e: Event) => el.dispatchEvent(e);
	for (const id of ['back', 'front']) {
		s.click(s.button('Expand layer', row(id)));
	}
	assert.ok(button('Delete objects').disabled, 'No selection disables Delete');
	s.click(row('back'));
	assert.ok(!button('Delete layer').disabled);
	assert.equal(opacityRow().children[2].value, '50');
	opacityRow().children[2].value = '60';
	fire(opacityRow().children[2], ev(s, 'change'));
	assert.equal(s.lastOp.ops[0].opacity, 0.6);
	s.setDoc(doc);
	s.click(row('inner'));
	assert.ok(button('Delete object'));
	assert.equal(opacityRow().children[2].value, '30');
	opacityRow().children[1].value = '0';
	fire(opacityRow().children[1], ev(s, 'input'));
	assert.equal(
		s.hook.state().nodes.find((n: any) => n.id === 'inner').style.opacity,
		0,
		'Slider previews opacity immediately',
	);
	fire(opacityRow().children[1], ev(s, 'change'));
	assert.equal(s.lastOp.style.opacity, 0);
	s.setDoc(doc);
	s.click(row('inner'));
	s.click(button('Delete object'));
	assert.equal(s.lastOp.ops[0].op, 'deleteNode');
	assert.ok(button('Delete objects').disabled);
	s.setDoc(doc);
	s.click(button('+ Object'));
	assert.equal(s.lastOp.op, 'addNode');
	assert.equal(s.lastOp.x, 75);
	assert.equal(s.lastOp.y, 25);
	assert.equal(s.hook.editing(), s.lastOp.id);
	// The box is added to the active layer.
	assert.equal(s.lastOp.layer, 'back');
	s.editKey('Escape');
	s.setDoc(doc);
	s.down(0, 0, '[data-edge="0"]');
	s.up(0, 0);
	assert.ok(button('Delete object'));
	assert.equal(opacityRow().children[2].value, '30');
	s.click(button('Delete object'));
	assert.equal(s.lastOp.ops[0].op, 'deleteEdge');
	s.setDoc(doc);
	// Layer reorder uses insertion lines, object-to-layer drops use a row highlight.
	const dataTransfer = { setData() {} };
	fire(list.children[0], ev(s, 'dragstart', { dataTransfer }));
	fire(list.children[0], ev(s, 'dragover', { clientY: 2 }));
	assert.ok(list.children[0].classList.contains('drop-above'));
	fire(list.children[0], ev(s, 'dragover', { clientY: 22 }));
	assert.ok(list.children[0].classList.contains('drop-below'));
	fire(row('inner'), ev(s, 'dragstart', { dataTransfer }));
	fire(list.children[0], ev(s, 'dragover', { clientY: 12 }));
	assert.ok(list.children[0].classList.contains('drop-group'));
	fire(list, ev(s, 'dragover', { clientY: 195 }));
	const [id, frame] = s.canvas.frames.entries().next().value!;
	s.canvas.frames.delete(id);
	frame();
	assert.ok(list.scrollTop > 0, 'Scroll continues near lower edge');
	fire(list, ev(s, 'dragleave', { relatedTarget: s.document.body }));
	assert.equal(s.canvas.frames.size, 0, 'Autoscroll stops when the pointer leaves the list');
});

test('canvas stacking, opacity, hit paths and inner endpoints', () => {
	const { s } = make();
	const [, framesGroup, nodeGroup, arrowGroup] = [...s.svg.children] as any[];
	const order = [...s.svg.children];
	assert.ok(order.indexOf(framesGroup) < order.indexOf(nodeGroup));
	assert.ok(order.indexOf(arrowGroup) > order.indexOf(nodeGroup), 'Arrows paint above boxes');
	assert.equal(nodeGroup.children[1].getAttribute('fill-opacity'), '0.15');
	assert.equal(arrowGroup.children[0].getAttribute('fill-opacity'), '0.15');
	assert.ok(
		[...arrowGroup.querySelectorAll('path')].some((e: any) => e.dataset.edge === '0'),
		'Arrow hit path survives',
	);
	const from = s.hook.baseEdgeGeom(s.hook.state().edges[0]).pts[0];
	const layoutOf = (id: string) => s.hook.layout(s.hook.state().nodes.find((n: any) => n.id === id));
	assert.ok(Math.abs(from[0] - layoutOf('inner').w / 2) < 1e-8, 'Arrow starts at inner border');
	assert.ok(from[0] < layoutOf('outer').w / 2);
	assert.ok(
		[...nodeGroup.children[0].children].some((e: any) => e.dataset.node === 'outer'),
		'Box has draggable hit area',
	);
});

test('inspector panes: ordered sections, multi-selection size batches, arrow and frame inspectors', () => {
	const { s } = make();
	s.apply({ op: 'addGroup', id: 'frame', name: 'Frame', frame: 'dashed', color: 'grey' });
	s.apply({ op: 'setGroup', ids: ['outer'], group: 'frame' });
	const pane = (id: string) => s.inspector.querySelector('#' + id);
	const sectionNames = (id: string) =>
		[...pane(id).children]
			.filter((d: any) => d.className === 'inspector-section')
			.map((d: any) => d.children[0].textContent);
	const rows = () => [...pane('pane-selection').querySelectorAll('.row')];
	s.down(0, 0, s.node('inner'));
	s.up(0, 0);
	assert.deepEqual(sectionNames('pane-selection'), [
		'Style',
		'Text',
		'Fill',
		'Outline',
		'Route & tips',
		'Shape & decoration',
		'Arrange',
	]);
	assert.deepEqual(sectionNames('pane-figure'), ['Text', 'Arrows', 'Legend', 'Grid', 'Styles']);
	assert.ok(pane('pane-selection').querySelector('.row'), 'Single node inspector builds controls');
	s.down(70, 0, s.node('target'), { ctrlKey: true });
	s.up(70, 0, { ctrlKey: true });
	assert.deepEqual(s.selection.nodes, ['inner', 'target']);
	const width = rows().find((r: any) => r.children[0].textContent === 'Width' && r.children[1].tagName === 'INPUT')
		.children[1];
	width.value = '32';
	width.dispatchEvent(new s.window.Event('change', { bubbles: true }));
	assert.equal(s.lastOp.ops.map((o: any) => o.id).join(','), 'inner,target');
	s.down(35, 0, '[data-edge="0"]');
	s.up(35, 0);
	assert.deepEqual(s.selection.edges, [0]);
	assert.ok(
		rows().some((r: any) => r.children[0].textContent === 'Route'),
		'Arrow route remains editable',
	);
	const f = s.hook.frameRect('frame');
	s.down(f.x - f.w / 2, f.y, '[data-group="frame"]');
	s.up(f.x - f.w / 2, f.y);
	assert.equal(s.selection.group, 'frame');
	assert.ok(!pane('pane-selection').querySelector('.empty'), 'A selected frame is not an empty selection');
	assert.ok(rows().some((r: any) => r.children[0].textContent === 'Title at'));
});

test('no sheet is drawn and Fit centres the content', () => {
	const { s } = make();
	s.apply({ op: 'move', id: 'inner', x: 300, y: 0 });
	assert.ok(
		![...s.svg.querySelectorAll('rect')].some(
			(e: any) => e.getAttribute('class') === 'sheet' || e.getAttribute('class') === 'over-flag',
		),
	);
	assert.ok(![...s.svg.querySelectorAll('path')].some((e: any) => e.getAttribute('class') === 'dim'));
	const content = s.hook.contentBox();
	assert.ok(content.x1 >= 300);
	s.click(s.document.getElementById('fitw'));
	const view = s.hook.view();
	assert.ok(Math.abs(view.ox + ((content.x0 + content.x1) / 2) * view.s - 400) < 1e-6, 'Fit centres the content');
	assert.ok(view.s > 0);
});
