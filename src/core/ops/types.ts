// The operations the editor sends.
import { AttachedLabel, Attachment, Figure, LabelStyle, ObjectStyle, StyleKind } from '../model/figure';

export type Op =
	| { op: 'label'; index?: number; group?: string; slot?: number; text?: string; style?: LabelStyle }
	| {
			op: 'detachLabel';
			index?: number;
			group?: string;
			slot?: number;
			id: string;
			x: number;
			y: number;
			width?: number;
	  }
	| { op: 'attachLabel'; id: string; index?: number; group?: string; style?: LabelStyle }
	| { op: 'font'; size: string }
	| { op: 'duplicateLayer'; id: string; newId: string }
	| { op: 'mergeLayers'; ids: string[]; target: string }
	| { op: 'style'; ids?: string[]; indices?: number[]; style: ObjectStyle }
	| { op: 'attach'; id: string; attachment: Attachment | null }
	| { op: 'move'; id: string; x: number; y: number }
	| {
			op: 'addNode';
			wantWidth?: number;
			codeFont?: string;
			titlePosition?: string;
			attachment?: Attachment;
			style?: ObjectStyle;
			extra?: string[];
			layer?: string;
			id: string;
			x: number;
			y: number;
			title: string;
			cat: string;
			icon?: string;
			iconPosition?: string;
			kind?: string;
			code?: string;
			width?: number;
			minh?: number;
			from?: string;
	  }
	| {
			op: 'addEdge';
			styleKey?: string;
			fromOffset?: number;
			toOffset?: number;
			loopSide?: string;
			loopSize?: number;
			loopOut?: number;
			loopIn?: number;
			looseness?: number;
			loopMax?: number;
			chain?: string[];
			waypoints?: number[][];
			labelStyle?: LabelStyle;
			labels?: AttachedLabel[];
			fromAnchor?: string;
			toAnchor?: string;
			lane?: number;
			style?: ObjectStyle;
			extra?: string[];
			from: string;
			to: string;
			kind?: string;
			route?: string;
			mid?: number | null;
			bend?: number;
			head?: string;
			label?: string;
	  }
	| {
			op: 'node';
			wantWidth?: number;
			codeFont?: string;
			titlePosition?: string;
			id: string;
			title?: string;
			icon?: string;
			iconPosition?: string;
			kind?: string;
			code?: string;
			cat?: string;
			width?: number;
			minh?: number;
	  }
	| {
			op: 'arrow';
			styleKey?: string;
			fromOffset?: number;
			toOffset?: number;
			loopSide?: string;
			loopSize?: number;
			loopOut?: number;
			loopIn?: number;
			looseness?: number;
			loopMax?: number;
			chain?: string[] | null;
			waypoints?: number[][];
			resetAuto?: boolean;
			from?: string;
			to?: string;
			fromAnchor?: string;
			toAnchor?: string;
			lane?: number | null;
			index: number;
			kind?: string;
			route?: string;
			mid?: number | null;
			bend?: number;
			head?: string;
			label?: string;
	  }
	| { op: 'arrows'; style: string }
	| { op: 'sheet'; width: number }
	| { op: 'addLayer'; id: string; name: string }
	| { op: 'layerProps'; id: string; name?: string; hidden?: boolean; locked?: boolean; opacity?: number }
	| { op: 'deleteLayer'; id: string }
	| { op: 'reorderLayers'; order: string[] }
	| { op: 'setLayer'; ids: string[]; layer: string }
	| { op: 'reorder'; order: string[] }
	| {
			op: 'addGroup';
			fill?: string;
			fillStrength?: number;
			outline?: string;
			labelStyle?: LabelStyle;
			padding?: number;
			titlePosition?: string;
			titleBold?: boolean;
			titleFont?: string;
			titleColor?: string;
			lineWidth?: number;
			frameColor?: string;
			id: string;
			name: string;
			frame?: string;
			color?: string;
			parent?: string;
	  }
	| {
			op: 'groupProps';
			fill?: string;
			fillStrength?: number;
			outline?: string;
			labelStyle?: LabelStyle;
			padding?: number;
			titlePosition?: string;
			titleBold?: boolean;
			titleFont?: string;
			titleColor?: string;
			lineWidth?: number;
			frameColor?: string;
			id: string;
			name?: string;
			frame?: string;
			color?: string;
			parent?: string;
	  }
	| { op: 'deleteGroup'; id: string }
	| { op: 'setGroup'; ids: string[]; group: string }
	| { op: 'hide'; ids: string[]; hidden: boolean }
	| { op: 'lock'; ids: string[]; locked: boolean }
	| { op: 'deleteNode'; id: string }
	| { op: 'deleteEdge'; index: number }
	| { op: 'addCategory'; key: string; name: string; color: string; icon?: string; boxes?: boolean; legend?: boolean }
	| { op: 'category'; key: string; name?: string; color?: string; icon?: string; boxes?: boolean; legend?: boolean }
	| { op: 'deleteCategory'; key: string }
	| { op: 'legend'; on: boolean }
	| {
			op: 'styleAdd';
			kind: StyleKind;
			key?: string;
			name: string;
			props?: Record<string, any>;
			icon?: string;
			boxes?: boolean;
			legend?: boolean;
			from?: { id?: string; index?: number };
			assign?: { ids?: string[]; indices?: number[] };
	  }
	| {
			op: 'styleEdit';
			key: string;
			name?: string;
			props?: Record<string, any>;
			icon?: string;
			boxes?: boolean;
			legend?: boolean;
	  }
	| { op: 'styleUpdate'; key: string; id?: string; index?: number }
	| { op: 'styleDelete'; key: string; to?: string }
	| { op: 'resetStyle'; ids?: string[]; indices?: number[]; keys?: string[] }
	| { op: 'batch'; ops: Op[] };

export type FigureOp = Extract<Op, { op: 'sheet' | 'font' | 'arrows' | 'legend' }>;
export type LabelOp = Extract<Op, { op: 'label' | 'detachLabel' | 'attachLabel' }>;
export type StyleOp = Extract<
	Op,
	{
		op:
			| 'style'
			| 'styleAdd'
			| 'styleEdit'
			| 'styleUpdate'
			| 'styleDelete'
			| 'resetStyle'
			| 'addCategory'
			| 'category'
			| 'deleteCategory';
	}
>;
export type LayerOp = Extract<
	Op,
	{
		op:
			| 'mergeLayers'
			| 'duplicateLayer'
			| 'addLayer'
			| 'layerProps'
			| 'deleteLayer'
			| 'reorderLayers'
			| 'setLayer'
			| 'hide'
			| 'lock';
	}
>;
export type NodeOp = Extract<
	Op,
	{ op: 'attach' | 'move' | 'addNode' | 'addEdge' | 'node' | 'deleteNode' | 'deleteEdge' | 'reorder' }
>;
export type ArrowOp = Extract<Op, { op: 'arrow' }>;
export type GroupOp = Extract<Op, { op: 'addGroup' | 'groupProps' | 'deleteGroup' | 'setGroup' }>;
export type Run = (fig: Figure, op: Op) => void;
