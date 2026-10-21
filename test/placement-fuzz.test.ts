import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { inputs } from './lib/env';
import { parse, serialize, apply, nodes, items, descendants, itemById, layers, edges, TEMPLATE } from '../src/core';
import { geometryOf } from '../src/core/geometry/figure-geometry';
import type { Figure } from '../src/core/model/figure';
import type { Op } from '../src/core/ops/types';

function snapshot(f: Figure) {
	const g = geometryOf(f);
	return new Map(
		items(f).flatMap((i) => {
			const b = i.kind === 'Frame' ? g.frame(i.id) : g.node(i.id);
			if (b) return [[i.id, { p: [b.x, b.y], size: [b.w, b.h], parent: i.parent }] as const];
			return [];
		}),
	);
}

test('seeded placement invariant: examples and generated trees, ops and round trips', () => {
	let seed = 0x3c2026;
	const rand = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 2 ** 32;
	};
	const failures: string[] = [];
	const generated = parse(TEMPLATE);
	for (let j = 0; j < 8; j++)
		apply(generated, { op: 'addNode', id: 'generated' + j, x: j * 40, y: (j % 2) * 30, title: 'Box ' + j, cat: '' });
	apply(generated, { op: 'reparent', id: 'generated1', newParent: 'generated0' });
	const nested = parse(TEMPLATE);
	for (const [id, x, y] of [
		['parent', 0, 0],
		['member', 30, 20],
		['sibling', 50, 20],
	] as const)
		apply(nested, { op: 'addNode', id, x, y, title: id, cat: '' });
	apply(nested, { op: 'addGroup', id: 'group', name: 'Group' });
	for (const id of ['member', 'sibling']) apply(nested, { op: 'reparent', id, newParent: 'group' });
	apply(nested, { op: 'reparent', id: 'group', newParent: 'parent' });
	const corpus = [
		...inputs().filter((i) => !i.name.startsWith('routing-fuzz')),
		{ name: 'generated', text: serialize(generated) },
		{ name: 'nested-group', text: serialize(nested) },
	];
	for (const input of corpus) {
		let f = parse(input.text);
		for (const e of edges(f)) {
			e.route = 'straight';
			delete e.fromAnchor;
			delete e.toAnchor;
			e.labelStyle = undefined;
			e.labels = [];
		}
		const undo: string[] = [],
			redo: string[] = [];
		for (let step = 0; step < 96; step++) {
			const ns = nodes(f),
				n = ns[Math.floor(rand() * ns.length)];
			if (!n) break;
			const before = snapshot(f),
				target = n.id,
				exempt = new Set([target, ...descendants(f, target).map((i) => i.id)]);
			const choice = step % 12;
			let op: Op;
			switch (choice) {
				case 0:
					op = { op: 'move', id: target, x: n.x + rand() * 10, y: n.y + rand() * 10 };
					break;
				case 1:
					op = { op: 'node', id: target, width: 15 + rand() * 40, minh: rand() * 20 };
					break;
				case 2:
					op = { op: 'node', id: target, title: 'Edited ' + step + ' words words' };
					break;
				case 3:
					op = { op: 'addNode', id: 'fuzz' + step, x: rand() * 100, y: rand() * 100, title: 'Added', cat: '' };
					break;
				case 4:
					op = { op: 'deleteItem', id: target };
					break;
				case 5: {
					const p = ns.find((p) => p.id !== target && !p.kind && !descendants(f, target).some((i) => i.id === p.id));
					op = p ? { op: 'reparent', id: target, newParent: p.id } : { op: 'detach', id: target };
					break;
				}
				case 6:
					op = { op: 'detach', id: target };
					break;
				case 7:
					op = { op: 'setCategory', id: target, category: '' };
					break;
				case 8:
					op = { op: 'setOverride', id: target, prop: 'fill', value: 'white' };
					break;
				case 9:
				case 10: {
					const from = choice === 9 ? undo : redo,
						to = choice === 9 ? redo : undo;
					if (from.length) {
						to.push(serialize(f));
						f = parse(from.pop()!);
					}
					// Undo/redo restores the entire document, so compare to that document's positions.
					continue;
				}
				default: {
					const round = parse(serialize(f)),
						after = snapshot(round);
					for (const [id, b] of before)
						if (after.has(id) && JSON.stringify(after.get(id)!.p) !== JSON.stringify(b.p))
							failures.push(input.name + ': roundtrip ' + id + ' ' + JSON.stringify([b.p, after.get(id)!.p]));
					f = round;
					continue;
				}
			}
			if (choice === 8) undo.push(serialize(f));
			redo.length = 0;
			apply(f, op);
			const after = snapshot(f),
				resized = new Set(
					[...before]
						.filter(
							([id, b]) =>
								itemById(f, id)?.kind === 'Shape' && JSON.stringify(b.size) !== JSON.stringify(after.get(id)?.size),
						)
						.map(([id]) => id),
				);
			for (const [id, b] of before) {
				const a = after.get(id);
				if (!a || exempt.has(id) || resized.has(b.parent) || itemById(f, id)?.kind === 'Frame') continue;
				if (JSON.stringify(a.p) !== JSON.stringify(b.p))
					failures.push(input.name + ': ' + op.op + ' ' + target + ' moved ' + id + ' ' + JSON.stringify([b.p, a.p]));
			}
		}
	}
	assert.deepEqual(failures.slice(0, 20), [], `${failures.length} placement violations`);
});
