export type ItemKind = 'Shape' | 'Frame' | 'Text' | 'Icon' | 'Line' | 'Connector';
export interface TreeState {
	cat?: string;
	look?: { own: Record<string, any>; resolved: Record<string, any> };
	treeParent?: string;
	order?: number;
	hidden?: boolean;
	locked?: boolean;
}
export interface Port {
	side: 'auto' | 'north' | 'south' | 'east' | 'west';
	position: number;
}
export interface Endpoint {
	id: string;
	port: Port;
}
