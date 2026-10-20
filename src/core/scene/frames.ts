import type { Env } from './env';
import type { Prim } from './types';

// Groups are structural and have no canvas area.
export function framePrims(_env: Env): Prim[] {
	return [];
}
