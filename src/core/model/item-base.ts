export interface TreeState {
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
