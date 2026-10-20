import type { ItemKind } from './item';
export interface Theme {
	kinds?: Partial<Record<ItemKind, Record<string, any>>>;
	palette?: Record<string, string>;
	fontSize?: string;
}
export type ValueSource = 'theme' | { category: string } | 'item';
export interface ResolvedValue {
	value: any;
	source: ValueSource;
}
