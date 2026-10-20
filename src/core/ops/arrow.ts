// The arrow operation.
import { specialGeometry } from '../geometry/resolve';
import { Figure } from '../model/figure';
import { edges, nodes } from '../model/queries';
import { styleable } from '../schema';
import type { ArrowOp, Run } from './types';

export function applyArrow(fig: Figure, op: ArrowOp, run: Run): void {
	switch (op.op) {
		case 'arrow': {
			const e = edges(fig)[op.index];
			if (e) {
				if (
					e.route === 'fixed' &&
					e.chain &&
					['from', 'to', 'fromAnchor', 'toAnchor', 'fromOffset', 'toOffset'].some((k) => (op as any)[k] !== undefined)
				) {
					e.waypoints = specialGeometry(fig, e)?.pts.slice(1, -1);
					delete e.chain;
				}
				for (const key of ['from', 'to', 'fromAnchor', 'toAnchor', 'lane'] as const) {
					if (op[key] !== undefined) {
						if (key === 'lane' && op[key] === null) delete e.lane;
						else (e as any)[key] = op[key];
					}
				}
				if (op.styleKey !== undefined) {
					if (e.style) {
						for (const k of styleable('arrow')) {
							delete (e.style as any)[k];
						}
					}
					if (op.styleKey) {
						e.styleKey = op.styleKey;
						e.kind = 'arr';
					} else {
						delete e.styleKey;
					}
				}
				if (op.kind !== undefined) {
					e.kind = op.kind;
					if (e.style) {
						delete e.style.border;
					}
				}
				if (op.route !== undefined) {
					e.route = op.route;
					if (op.route !== 'fixed') {
						delete e.chain;
						delete e.waypoints;
					}
				}
				for (const key of [
					'fromOffset',
					'toOffset',
					'loopSide',
					'loopSize',
					'loopOut',
					'loopIn',
					'looseness',
					'loopMax',
					'chain',
					'waypoints',
				] as const)
					if (op[key] !== undefined) {
						if (key === 'chain' && op[key] === null) delete e.chain;
						else (e as any)[key] = op[key];
					}
				if (op.loopSide !== undefined) {
					for (const k of ['fromAnchor', 'toAnchor', 'fromOffset', 'toOffset']) delete (e as any)[k];
				}
				if (op.resetAuto) {
					e.route = 'auto';
					e.mid = null;
					e.bend = 0;
					for (const k of [
						'fromAnchor',
						'toAnchor',
						'fromOffset',
						'toOffset',
						'chain',
						'waypoints',
						'loopSide',
						'loopSize',
						'loopOut',
						'loopIn',
						'looseness',
						'loopMax',
						'lane',
					])
						delete (e as any)[k];
				}
				if (op.mid !== undefined) {
					e.mid = op.mid;
				}
				if (op.bend !== undefined) {
					e.bend = op.bend;
				}
				if (op.head !== undefined) {
					e.head = op.head;
					if (e.style) {
						delete e.style.start;
						delete e.style.end;
					}
				}
				if (op.label !== undefined) {
					e.label = op.label;
				}
			}
			break;
		}
	}
}
