// The canvas: scene (mm) under one view transform, grid and overlays in screen pixels.
// draw() patches the SVG by key; panning and zooming change the transform and the grid only.
import type { HitRef, Prim, Scene } from '../../core/scene';
import { hitOf } from './hit';
import { Patcher } from './patch';

export interface View {
	s: number;
	ox: number;
	oy: number;
	/** The size of the canvas in pixels. */
	width: number;
	height: number;
	/** Grid pitch in mm; the dots show when they are at least 10 px apart. */
	grid: number;
}
// Overlay primitives are in screen pixels and rebuilt from the store state on every draw.
export type Overlay = Prim[];

const NS = 'http://www.w3.org/2000/svg';

export interface Renderer {
	draw(scene: Scene, overlay: Overlay, view: View): void;
	/** Moves the view only: the scene is not touched. */
	setView(view: View, overlay: Overlay): void;
	hit(target: EventTarget | null): HitRef | null;
}

export function createRenderer(svg: SVGElement): Renderer {
	const group = (cls: string) => {
		const g = document.createElementNS(NS, 'g');
		g.setAttribute('class', cls);
		svg.append(g);
		return g;
	};
	svg.replaceChildren();
	const gridEl = group('grid'),
		viewEl = group('view'),
		overlayEl = group('overlay');
	const grid = new Patcher(gridEl),
		content = new Patcher(viewEl),
		over = new Patcher(overlayEl);
	let transform = '';

	function setView(view: View, overlay: Overlay) {
		const t = `translate(${view.ox},${view.oy}) scale(${view.s})`;
		if (t !== transform) {
			viewEl.setAttribute('transform', t);
			transform = t;
		}
		grid.patch(gridPrims(view));
		over.patch(overlay);
	}
	return {
		draw(scene, overlay, view) {
			content.patch(scene.prims);
			setView(view, overlay);
		},
		setView,
		hit: hitOf,
	};
}

// Dots every `grid` mm, as one pattern anchored at the origin of the drawing.
function gridPrims(v: View): Prim[] {
	if (!(v.grid > 0 && v.grid * v.s >= 10)) return [];
	const t = v.grid * v.s;
	return [
		{
			key: 'defs',
			kind: 'defs',
			attrs: {},
			children: [
				{
					key: 'pattern',
					kind: 'pattern',
					attrs: {
						id: 'sg-grid',
						patternUnits: 'userSpaceOnUse',
						width: t,
						height: t,
						x: v.ox - t / 2,
						y: v.oy - t / 2,
					},
					children: [{ key: 'dot', kind: 'circle', attrs: { cx: t / 2, cy: t / 2, r: 0.75, fill: '#c8c8c8' } }],
				},
			],
		},
		{
			key: 'dots',
			kind: 'rect',
			attrs: { x: 0, y: 0, width: v.width, height: v.height, fill: 'url(#sg-grid)', 'pointer-events': 'none' },
		},
	];
}
