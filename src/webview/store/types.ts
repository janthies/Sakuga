// The shapes the webview keeps: the core figure types plus what the host's 'state' snapshot adds (core/view/viewModel.ts).
import type { Item, FigLine } from '../../core/model/item';
import type { Category, Group, Icon, Layer } from '../../core/model/figure';
import type { StateMessage, ViewEdge, ViewNode, ViewStyle } from '../../bridge/protocol';
import type { LabelRef } from '../../core/model/refs';
import type { OpLike as Op } from '../../core/model/node';

export type { ViewEdge, ViewNode, ViewStyle } from '../../bridge/protocol';
export type Palette = StateMessage['palette'];
export type { Category, Group, Icon, Layer, LabelRef, Op };

/** The selected boxes; `label` marks that an attached label or frame title is selected instead. */
export type NodeSelection = Set<string> & { label?: LabelRef };

/** What copying a style keeps; each part is filled by the kind of object that was copied. */
export interface StyleClip {
	labelStyle?: Record<string, any>;
	groupStyle?: Record<string, any>;
	nodeStyle?: Record<string, any>;
	edgeStyle?: Record<string, any>;
	color?: string;
	codeFont?: string;
	cat?: string;
	width?: number;
	minh?: number;
	kind?: string;
	lane?: number;
	route?: string;
	head?: string;
}

export interface Store {
	outerGap: number;
	items: Item[];
	lines: FigLine[];
	rev: number;
	figureFont: string;
	selectedLayers: Set<string>;
	layers: Layer[];
	activeLayer: string;
	expandedLayers: Set<string>;
	groups: Group[];
	selG: string | null;
	layerAnchor: string | null;
	layerDrag: { layer: string } | string[] | null;
	collapsed: Set<string>;
	icons: Icon[];
	openStyles: Set<string>;
	pendingStyleFocus: string | null;
	nodes: ViewNode[];
	edges: ViewEdge[];
	cats: Category[];
	styles: ViewStyle[];
	shared: Record<string, any>[];
	legend: boolean;
	palette: Palette;
	defaultWidth: number;
	keyObject: string | null;
	/** The unsent box and arrow of a Tab draft. */
	freshBox: { node: ViewNode; edge: ViewEdge } | null;
	selN: NodeSelection;
	selE: Set<number>;
	view: { s: number; ox: number; oy: number };
	/** The running gesture's overlay (guides, band, rubber line), as the tool describes it. */
	drag: DragOverlay | null;
	hover: string | null;
	editing: string | null;
	pendingEdit: string | null;
	moved: boolean;
	fitted: boolean;
	lastCat: string;
	space: boolean;
	pendingSelect: string[] | null;
	styleClip: StyleClip | null;
	lastPaste: string;
	pasteCount: number;
	grid: number;
	recentColors: string[];
	arrowsStyle: string;
	floating: { panel: HTMLElement; anchor: HTMLElement } | null;
	iconPanel: HTMLElement | null;
	iconEntries: any[];
	iconGroups: any[];
	chooseIcon: ((name: string) => void) | null;
	layerScrollFrame: number | null;
	layerPointerY: number | null;
	layerSignature: string;
	sent: string | null;
	timer: ReturnType<typeof setTimeout> | null;
	lastInspectorSelection: string;
	tab: string;
}

export type Pt = { x: number; y: number };
export type Box = { x0: number; x1: number; y0: number; y1: number };
/** Where an arrow end would land: a box or a frame, the side, and for boxes the offset along it. */
export type EndpointTarget = { id: string; anchor: string; offset?: number; fraction?: number; d?: number };

/** What the running tool says to draw: guides, copies, the band, connect lines (Tool.overlay in tools/types.ts). */
export type DragOverlay = any;
