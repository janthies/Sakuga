// The list of overlay primitives that the overlay builders append to.
import { prim } from '../../core/scene/style';
import type { Attrs, Prim, PrimKind } from '../../core/scene';

export class Out {
	prims: Prim[] = [];
	add(kind: PrimKind, attrs: Attrs, rest: Partial<Prim> = {}) {
		const p = prim(kind, 'o' + this.prims.length, attrs, rest);
		this.prims.push(p);
		return p;
	}
}
