// buildScene: the figure as keyed primitives in mm. Pure: the same input gives the same JSON.
import { linePrims } from './lines';
import { makeEnv } from './env';
import { edgePrims } from './edges';
import { framePrims } from './frames';
import { legendPrims } from './legend';
import { nodePrims, stepBadges } from './nodes';
import { prim } from './style';
import type { Scene, SceneCtx, SceneInput, SceneOpts } from './types';

export function buildScene(fig: SceneInput, ctx: SceneCtx, opts: SceneOpts = {}): Scene {
	const env = makeEnv(fig, ctx, opts);
	return {
		prims: [
			prim('g', 'frames', {}, { children: framePrims(env) }),
			prim('g', 'nodes', {}, { children: [...nodePrims(env), ...stepBadges(env), ...legendPrims(env)] }),
			prim('g', 'edges', {}, { children: [...linePrims(env), ...edgePrims(env)] }),
		],
	};
}
export { makeEnv, nodesBox, paintOrder, hierarchy, members, inGroup } from './env';
export type * from './types';
