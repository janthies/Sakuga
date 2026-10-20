import type { icon } from '../store/constants';
import type { Layer } from '../store/types';

// What renderLayers builds for the row functions: the list, its row factory and the shared handlers.
export interface LayerCtx {
	list: HTMLElement;
	updateSelection(): void;
	button(row: HTMLElement, key: Parameters<typeof icon>[0], title: string, action: () => void): HTMLButtonElement;
	rename(name: HTMLElement, obj: { id: string; name: string }, op: string): void;
	makeRow(id: string, depth: number): HTMLElement;
	drop(row: HTMLElement, layer: Layer, target?: string | null): void;
}
