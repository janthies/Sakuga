// @ts-nocheck
import { FigureGeometry } from '../../core/geometry/figure-geometry';
import { store } from './store';

// The geometry of the figure as the store holds it now. It is rebuilt only when the store's revision or one of its
// lists changed, so each arrow is routed once per change and not once per question.
let cache = null;
export function geo() {
	const k = cache?.key;
	if (
		!k ||
		k.rev !== store.rev ||
		k.nodes !== store.nodes ||
		k.edges !== store.edges ||
		k.groups !== store.groups ||
		k.cats !== store.cats ||
		k.font !== store.figureFont ||
		k.arrows !== store.arrowsStyle
	) {
		cache = {
			key: {
				rev: store.rev,
				nodes: store.nodes,
				edges: store.edges,
				groups: store.groups,
				cats: store.cats,
				font: store.figureFont,
				arrows: store.arrowsStyle,
			},
			geometry: new FigureGeometry({
				nodes: store.nodes,
				edges: store.edges,
				groups: store.groups,
				categories: store.cats,
				font: store.figureFont,
				arrowStyle: store.arrowsStyle,
			}),
		};
	}
	return cache.geometry;
}
// Call after changing nodes, arrows or groups in place.
export const touch = () => {
	store.rev++;
};
