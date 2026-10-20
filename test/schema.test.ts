import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { loadIcons } from './lib/env';
import { CODECS, emitOptions, readOptions } from '../src/core/codec/options';
import { cornerKeys, patternKeys, shapeKeys, tipKeys } from '../src/core/codec/keys';
import {
	groupKeys,
	groupLineDefs,
	defaultOf,
	defsOf,
	primaryProp,
	styleable,
	travelGroups,
	PROPS,
	PropDef,
	Kind,
} from '../src/core/schema';
import { PALETTE } from '../src/core/model/colour';

const t = loadIcons();
const KINDS: Kind[] = ['box', 'label', 'arrow', 'frame'];

// Seeded generator (mulberry32), so a failing seed can be replayed.
function rng(seed: number) {
	let a = seed >>> 0;
	const next = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let x = Math.imul(a ^ (a >>> 15), 1 | a);
		x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
	return { next, pick: <T>(l: readonly T[]) => l[Math.floor(next() * l.length)], chance: (p: number) => next() < p };
}
type Rng = ReturnType<typeof rng>;

const HEX = ['#A1B2C3', '#102030', '#FFEE00'];
const NUMBERS: Record<string, number[]> = {
	lineWidth: [0.3, 0.45, 0.6, 1, 2.5],
	tipLength: [1, 1.5, 2.2],
	tipWidth: [0.9, 1.2, 2],
	fillStrength: [10, 30, 55],
	padding: [1, 2.8, 5],
	step: [1, 3],
};
// Every value a property can take in a test: all enum words, palette names and hex colours, a few numbers.
function samples(d: PropDef): unknown[] {
	switch (d.type) {
		case 'enum':
			return [...d.values!];
		case 'colour':
			return [...Object.keys(PALETTE), ...HEX, ...(d.none ? ['none'] : [])];
		case 'number':
			return NUMBERS[d.key] ?? [1, 2];
		case 'boolean':
			return [true, false];
		default:
			return ['x'];
	}
}

test('the derived property lists equal the six tables they replaced', () => {
	assert.deepEqual(styleable('box'), [
		'fill',
		'color',
		'border',
		'weight',
		'lineWidth',
		'shape',
		'font',
		'text',
		'textColor',
	]);
	assert.deepEqual(styleable('label'), ['fill', 'color', 'border', 'weight', 'lineWidth', 'font', 'text', 'textColor']);
	assert.deepEqual(styleable('arrow'), ['color', 'border', 'lineWidth', 'tipLength', 'tipWidth', 'start', 'end']);
	assert.deepEqual(styleable('frame'), [
		'frame',
		'color',
		'frameColor',
		'outline',
		'fill',
		'fillStrength',
		'lineWidth',
		'padding',
		'titlePosition',
		'titleBold',
		'titleFont',
		'titleColor',
	]);
	const stroke = ['weight', 'lineWidth'],
		font = ['font', 'text'];
	assert.deepEqual(travelGroups('box'), [font, stroke]);
	assert.deepEqual(travelGroups('label'), [font, stroke]);
	assert.deepEqual(travelGroups('arrow'), [['tipLength', 'tipWidth', 'start', 'end']]);
	assert.deepEqual(travelGroups('frame'), []);
	assert.deepEqual(KINDS.map(primaryProp), ['fill', 'textColor', 'color', 'color']);
	assert.deepEqual(groupKeys(), [
		'padding',
		'titlePosition',
		'titleBold',
		'titleFont',
		'titleColor',
		'lineWidth',
		'frameColor',
		'fill',
		'fillStrength',
		'outline',
		'labelStyle',
	]);
});

test('the enum values of the schema all have a dialect name', () => {
	const has = (rec: Record<string, unknown>, key: string) => assert.ok(key in rec, `no dialect name for ${key}`);
	for (const d of PROPS) {
		if (d.key === 'shape') d.values!.forEach((v) => has(shapeKeys, v));
		if (d.key === 'start' || d.key === 'end') d.values!.forEach((v) => has(tipKeys, v));
		if (d.key === 'pattern') d.values!.forEach((v) => has(patternKeys, v));
		if (d.key === 'markCorner') d.values!.forEach((v) => has(cornerKeys, v));
	}
});

test('every styleable property of a box or arrow has an option codec', () => {
	for (const kind of ['box', 'label', 'arrow'] as const) {
		const target = kind === 'arrow' ? 'arrow' : 'node';
		for (const key of styleable(kind)) {
			assert.ok(
				CODECS.some((c) => c.kinds.includes(target) && c.owns.includes(key)),
				`${kind}.${key} is owned by no codec`,
			);
		}
	}
	for (const key of styleable('frame').filter((k) => k !== 'frame' && k !== 'color')) {
		assert.ok(groupKeys().includes(key), `frame.${key} has no place in the group line`);
	}
});

const clean = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// All combinations of the owned properties, each unset or one of its samples, with a cap per codec.
function combos(owns: string[], target: 'node' | 'arrow', random: Rng): Record<string, any>[] {
	const defs = owns.map(
		(k) => defsOf(target === 'arrow' ? 'arrow' : 'box').find((d) => d.key === k) ?? PROPS.find((d) => d.key === k)!,
	);
	let all: Record<string, any>[] = [{}];
	for (const d of defs) {
		const values = [undefined, ...samples(d)];
		all = all.flatMap((p) => values.map((v) => (v === undefined ? p : { ...p, [d.key]: v })));
	}
	// A box states a weight or a width, never both.
	all = all.filter((p) => !(p.weight !== undefined && p.lineWidth !== undefined));
	while (all.length > 400) all.splice(Math.floor(random.next() * all.length), 1);
	return all;
}

test('read of emit gives back what a codec wrote, for every codec and every owned value', () => {
	const random = rng(7);
	for (const codec of CODECS) {
		for (const target of ['node', 'arrow'] as const) {
			const arrow = target === 'arrow';
			if (!codec.kinds.includes(target) && codec.kinds.length) continue;
			// Codecs nobody emits through emitOptions (opacity, label place) are driven directly.
			for (const p of combos(codec.owns, target, random)) {
				// Tips read the sizes the size codecs wrote, so they are driven together.
				const tips = codec.owns.includes('start');
				const written = tips
					? emitOptions(p, { arrow, thin: true })
					: codec.kinds.length
						? codec.emit(p, { arrow, height: 6.16, thin: true })
						: codec.owns.includes('opacity')
							? codec.emit(p, { arrow, height: 6.16 })
							: [];
				const where = `${codec.owns.join('+')} ${target} ${JSON.stringify(p)}`;
				if (!written.length) continue;
				const back = readOptions(written, arrow, true);
				assert.deepEqual(back.extra, [], `unread options for ${where}: ${written.join(' | ')}`);
				// What was written must be written again from what was read (text fixpoint).
				const again = tips
					? emitOptions(back.style, { arrow, thin: true })
					: codec.kinds.length
						? codec.emit(back.style, { arrow, height: 6.16, thin: true })
						: codec.emit(back.style, { arrow, height: 6.16 });
				assert.deepEqual(again, written, `not a fixpoint for ${where}`);
				// And every owned value that left a trace comes back as it was.
				const traced = clean(back.style);
				for (const [k, v] of Object.entries(traced)) {
					if (k in p) assert.deepEqual(v, p[k], `${k} changed for ${where}`);
				}
			}
		}
	}
});

test('a codec reading one of its own single properties gives exactly that property', () => {
	for (const codec of CODECS.filter((c) => c.kinds.length && c.owns.length === 1)) {
		for (const target of ['node', 'arrow'] as const) {
			if (!codec.kinds.includes(target)) continue;
			const d = PROPS.find(
				(x) => x.key === codec.owns[0] && x.kinds.some((k) => (target === 'arrow') === (k === 'arrow')),
			);
			if (!d) continue;
			for (const v of samples(d)) {
				const p = { [d.key]: v },
					written = codec.emit(p, { arrow: target === 'arrow', height: 6.16, thin: true });
				if (!written.length) continue;
				assert.deepEqual(clean(readOptions(written, target === 'arrow', true).style), p, `${d.key}=${v} ${target}`);
			}
		}
	}
});

test('options no codec claims stay verbatim in extra, in order', () => {
	const odd = ['inner sep=3pt', 'sg something new', 'fill=notacolour', 'rounded corners=weird', 'font=\\Huge'];
	const mixed = ['fill=sgBlue!85', ...odd.slice(0, 2), 'solid', ...odd.slice(2)];
	assert.deepEqual(readOptions(mixed).extra, odd);
	assert.deepEqual(readOptions(mixed, true).extra, odd);
});

// ---- generating figures from the schema ----
function value(d: PropDef, random: Rng): unknown {
	const list = samples(d).filter((v) => v !== '' && v !== 'legacy' && v !== 'region');
	return random.pick(list);
}

// A random style for an object kind: each styleable property is set by chance; a travel group is set whole or not at all,
// and a box states a weight or a line width, never both.
function style(kind: Kind, random: Rng): Record<string, any> {
	const out: Record<string, any> = {},
		groups = travelGroups(kind);
	for (const d of defsOf(kind).filter((x) => x.styleable)) {
		if (random.chance(0.5)) out[d.key] = value(d, random);
	}
	for (const g of groups) {
		const any = g.some((k) => out[k] !== undefined);
		if (any)
			for (const k of g)
				out[k] ??= value(
					defsOf(kind).find((d) => d.key === k)!,
					random,
				);
	}
	if (out.weight !== undefined && out.lineWidth !== undefined) delete out[random.chance(0.5) ? 'weight' : 'lineWidth'];
	return out;
}

// Whether a read-back value is the written one, or the default that is not written.
function survives(kind: Kind, d: PropDef | undefined, wrote: unknown, read: unknown): boolean {
	if (JSON.stringify(wrote) === JSON.stringify(read)) return true;
	return read === undefined && d !== undefined && wrote === defaultOf(d, {});
}

function build(seed: number) {
	const random = rng(seed),
		fig = t.parse(t.TEMPLATE),
		expect: { kind: Kind; style: Record<string, any>; where: () => any }[] = [];
	const n = 2 + Math.floor(random.next() * 4);
	for (let i = 0; i < n; i++) {
		const kind: Kind = random.chance(0.3) ? 'label' : 'box',
			st = style(kind, random);
		if (kind === 'label' && st.border === 'none') delete st.border;
		t.apply(fig, {
			op: 'addNode',
			id: `n${i}`,
			x: i * 40,
			y: 0,
			title: `N${i}`,
			cat: '',
			kind: kind === 'label' ? 'label' : undefined,
			style: st,
		});
		expect.push({ kind, style: st, where: () => t.nodes?.(fig) });
	}
	return { fig, expect, random };
}

test('seeded property round trip: serialize, parse, serialize is the identity for figures generated from the schema', () => {
	const failures: string[] = [];
	for (let seed = 1; seed <= 150; seed++) {
		const { fig, expect } = build(seed);
		// Arrows between consecutive boxes with random arrow styles.
		const random = rng(seed * 7919);
		const nodeIds = expect.flatMap((entry, i) => (entry.kind === 'box' ? [`n${i}`] : []));
		const arrows: Record<string, any>[] = [];
		for (let i = 0; i + 1 < nodeIds.length; i++) {
			const st = style('arrow', random);
			arrows.push(st);
			t.apply(fig, { op: 'addEdge', from: nodeIds[i], to: nodeIds[i + 1], style: st });
		}
		const text1 = t.serialize(fig),
			parsed = t.parse(text1),
			text2 = t.serialize(parsed);
		if (text1 !== text2) {
			failures.push(`seed ${seed}: text differs`);
			continue;
		}
		const back = (parsed.lines as any[]).filter((l) => l.t === 'node').map((l) => l.n),
			edgesBack = (parsed.lines as any[]).filter((l) => l.t === 'edge').map((l) => l.e);
		const check = (kind: Kind, wrote: Record<string, any>, read: Record<string, any> = {}, what: string) => {
			for (const d of defsOf(kind).filter((x) => x.styleable)) {
				if (!survives(kind, d, wrote[d.key], read[d.key])) {
					failures.push(
						`seed ${seed} ${what}.${d.key}: wrote ${JSON.stringify(wrote[d.key])}, read ${JSON.stringify(read[d.key])}`,
					);
				}
			}
		};
		expect.forEach((e, i) => check(e.kind, e.style, back[i]?.style, `node ${i} (${e.kind})`));
		arrows.forEach((a, i) => check('arrow', a, edgesBack[i]?.style, `arrow ${i}`));
	}
	assert.deepEqual(failures.slice(0, 20), []);
});

test('seeded property round trip: named styles and group lines', () => {
	const failures: string[] = [];
	for (let seed = 1; seed <= 100; seed++) {
		const random = rng(seed * 104729),
			fig = t.parse(t.TEMPLATE),
			wrote: Record<string, any>[] = [];
		KINDS.forEach((kind, i) => {
			const props = style(kind, random);
			wrote.push(props);
			t.apply(fig, { op: 'styleAdd', kind, key: `s${i}`, name: `S${i}`, props });
		});
		const frame = random.pick(['dashed', 'dotted', 'solid', 'region', 'none']);
		const g: Record<string, any> = { frame };
		for (const d of groupLineDefs().filter((x) => x.type !== 'json')) {
			if (random.chance(0.6) && d.key !== 'fill') g[d.key] = value(d, random);
		}
		t.apply(fig, { op: 'addGroup', id: 'g1', name: 'G', frame, color: 'blue', ...g });
		// The op may add defaults of its own (a new group gets a title position); compare with what the figure holds.
		Object.assign(g, (fig.lines as any[]).find((l) => l.t === 'group').g);
		const text1 = t.serialize(fig),
			parsed = t.parse(text1);
		if (t.serialize(parsed) !== text1) failures.push(`seed ${seed}: text differs`);
		const defs = (parsed.lines as any[]).filter((l) => l.t === 'style').map((l) => l.s);
		KINDS.forEach((kind, i) => {
			const def = defs.find((d: any) => d.key === `s${i}`);
			for (const d of defsOf(kind).filter((x) => x.styleable)) {
				if (!survives(kind, d, wrote[i][d.key], def?.props[d.key])) {
					failures.push(
						`seed ${seed} style ${kind}.${d.key}: wrote ${JSON.stringify(wrote[i][d.key])}, read ${JSON.stringify(def?.props[d.key])}`,
					);
				}
			}
		});
		const back = (parsed.lines as any[]).find((l) => l.t === 'group')?.g;
		for (const d of groupLineDefs().filter((x) => x.type !== 'json')) {
			const w = g[d.key],
				r = back?.[d.key];
			if (!(
				JSON.stringify(w) === JSON.stringify(r) ||
				(r === undefined && (w === undefined || w === defaultOf(d, g) || (d.length && w === 0)))
			)) {
				failures.push(`seed ${seed} group.${d.key}: wrote ${JSON.stringify(w)}, read ${JSON.stringify(r)}`);
			}
		}
	}
	assert.deepEqual(failures.slice(0, 20), []);
});
