import assert from 'node:assert/strict';
import { Session } from './session';
import { figure } from './figure';
import { loadIcons } from './env';

const t = loadIcons();

// The attached-label sequence of scripts/check-attached-labels.cjs: pointer handlers and clipboard through DOM events, the model
// through ops. Shared by the webview test and the LuaLaTeX probe, which needs the document this sequence ends with.
export function start(): Session {
	return new Session(figure(
		[['a', 0, 0, { cat: 'work' }], ['b', 60, 0, { cat: 'work' }], ['c', 0, -40, { cat: 'work' }]],
		[{ from: 'a', to: 'b', route: 'straight', label: 'Two\\\\lines', style: { step: 2, color: 'blue' } }],
		[{ op: 'addGroup', id: 'world', name: 'World', color: 'blue' }, { op: 'setGroup', ids: ['c'], group: 'world' }],
	));
}

const drawLine = (s: Session) => s.canonical().split('\n').find(l => l.startsWith('\\draw'))!;
const label = (s: Session, ref: object) => s.svg.querySelector(`[data-label='${JSON.stringify(ref)}']`);
const state = (s: Session) => s.hook.state();

export function sequence(s: Session) {
	const apply = (o: any) => s.apply(o);
	const canonical = () => s.canonical();
	const edges = () => t.edges(s.fig()), nodes = () => t.nodes(s.fig()), groups = () => t.groups(s.fig());
	// Clicking text selects only the label; moving uses the real handler and snaps to quarter position.
	const G = s.hook.arrowLabelGeom(state(s).edges[0]), A = s.hook.baseEdgeGeom({ ...state(s).edges[0], labelStyle: {} });
	const q = A.pts[0].map((v: number, k: number) => v + (A.pts[1][k] - v) * .25);
	s.down(G.p[0], G.p[1], label(s, { index: 0 }));
	assert.equal(s.selection.edges.length, 0); assert.equal(s.selection.label.index, 0);
	s.move(q[0], q[1] + 8); s.up(q[0], q[1] + 8);
	const move = s.lastOp; assert.equal(move.op, 'label'); assert.equal(move.style.pos, .25); assert.equal(move.style.side, 'above'); assert.ok(move.style.dy);
	assert.match(canonical(), /pos=0.25/); assert.match(canonical(), /shift=\{/);
	// Own colour wins; resetting to inherit follows the changed parent.
	apply({ op: 'label', index: 0, style: { color: '#123456', bold: true, italic: true, background: false } }); canonical();
	apply({ op: 'style', indices: [0], style: { color: 'red' } }); assert.match(drawLine(s), /text=sgc123456/);
	apply({ op: 'label', index: 0, style: { color: null } }); assert.ok(!edges()[0].labelStyle.color); assert.match(drawLine(s), /text=sgRed/);
	// Detach keeps badge, colour, combined emphasis, font, and coordinates; reattach is one operation.
	apply({ op: 'detachLabel', index: 0, id: 'detached', x: 21.5, y: 8, width: 24 });
	let n = nodes().find((n: any) => n.id === 'detached'); assert.equal(n.style.step, 2); assert.equal(n.style.text, 'bold-italic'); assert.equal(n.style.textColor, 'red'); assert.equal(n.x, 21.5); assert.equal(edges()[0].label, '');
	const detached = t.parse(canonical()); assert.equal(t.nodes(detached).find((n: any) => n.id === 'detached').title, 'Two\\\\lines');
	apply({ op: 'attachLabel', id: 'detached', index: 0, style: { pos: .75, side: 'above', dy: 2 } }); assert.equal(edges()[0].style.step, 2); assert.ok(!nodes().some((n: any) => n.id === 'detached')); canonical();
	// A second attachment adds another native path node. All slots round-trip independently.
	apply({ op: 'addNode', id: 'extra', kind: 'label', x: 20, y: 10, title: 'Extra {nested}', cat: '', style: { textColor: 'green', font: 'large' } }); apply({ op: 'attachLabel', id: 'extra', index: 0, style: { pos: .25, side: 'below', dx: 1, dy: -3 } });
	assert.equal(edges()[0].labels.length, 1); assert.equal((drawLine(s).match(/node\[sg elabel/g) || []).length, 2);
	apply({ op: 'label', index: 0, slot: 0, text: 'Edited', style: { bold: true, background: true } }); canonical(); apply({ op: 'detachLabel', index: 0, slot: 0, id: 'extra2', x: 20, y: -10 }); canonical(); assert.equal((edges()[0].labels ?? []).length, 0);
	// Attach to a frame replaces its title; detaching clears it. Frame label style inherits on reset.
	apply({ op: 'attachLabel', id: 'extra2', group: 'world', style: { dx: 3, dy: 2 } }); assert.equal(groups()[0].name, 'Edited'); canonical();
	apply({ op: 'label', group: 'world', style: { color: null, font: null, bold: null } }); apply({ op: 'groupProps', id: 'world', color: 'red' }); canonical();
	apply({ op: 'detachLabel', group: 'world', id: 'title-free', x: 0, y: -25 }); canonical(); assert.equal(groups()[0].name, '');
	apply({ op: 'attachLabel', id: 'title-free', group: 'world', style: { dx: 1, dy: 2 } }); canonical();
	// Style clipboard uses label properties only and clears the destination's own values.
	const G2 = s.hook.arrowLabelGeom(state(s).edges[0]);
	s.down(G2.p[0], G2.p[1], label(s, { index: 0 })); s.up(G2.p[0], G2.p[1]);
	assert.equal(s.selection.label.index, 0);
	s.key('c', { ctrlKey: true, altKey: true, code: 'KeyC' });
	const T = s.hook.frameTitleGeom(state(s).groups[0]);
	s.down(T.p[0], T.p[1], label(s, { group: 'world' })); s.up(T.p[0], T.p[1]);
	assert.equal(s.selection.label.group, 'world');
	s.key('v', { ctrlKey: true, altKey: true, code: 'KeyV' });
	const pasted = s.lastOp; assert.equal(pasted.op, 'label'); assert.equal(pasted.group, 'world'); assert.ok(!Object.hasOwn(pasted.style, 'pos')); canonical();
	// Legacy placement survives an own side/position, and reset still inherits the old preset.
	apply({ op: 'style', indices: [0], style: { side: 'below', position: 'start' } }); apply({ op: 'label', index: 0, style: { side: 'above', pos: .75 } });
	const saved = t.parse(canonical()); assert.equal(t.edges(saved)[0].style.side, 'below'); assert.equal(t.edges(saved)[0].style.position, 'start');
	// An inspector edit and its document echo retain label selection.
	s.down(G2.p[0], G2.p[1], label(s, { index: 0 })); s.up(G2.p[0], G2.p[1]);
	const field = s.row('Text').querySelector('input'); field.value = field.value; field.dispatchEvent(new s.window.Event('change', { bubbles: true }));
	assert.equal(s.selection.label.index, 0);
	// Every label property, including false values and routed-segment selection, is stable.
	for (const style of [{ pos: .25, dx: -2, dy: 3, side: 'left', font: 'large', bold: false, italic: true, color: '#123456', background: false }, { pos: .75, segment: 0, side: 'right', bold: true, italic: false, background: true }, { pos: .5, dx: 0, dy: 0, font: '', color: '', side: '' }]) { apply({ op: 'label', index: 0, style }); canonical(); }
	apply({ op: 'label', index: 0, style: { pos: .25, segment: 0, side: 'above', dx: 2, dy: 3, font: 'small', bold: true, italic: false, background: true } });
	apply({ op: 'label', group: 'world', style: { dx: 2, dy: 3, font: 'small' } });
	return { expected: s.hook.arrowLabelGeom(state(s).edges[0]).p, frame: s.hook.frameTitleGeom(state(s).groups[0]) };
}
