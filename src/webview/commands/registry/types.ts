// The command registry: every keyboard shortcut, toolbar action and VS Code `sakuga.*` command is one entry.
// Commands see the application through AppState and never touch the DOM, so tests can run them on a fake.

export type Op = { op: string; [k: string]: any };

/** The parts of a keydown a shortcut can depend on. */
export interface KeyInfo {
	key: string;
	code: string;
	ctrl: boolean;
	shift: boolean;
	alt: boolean;
}

export interface AppState {
	readonly cats: { key: string }[];
	readonly layers: { id: string }[];
	readonly activeLayer: string;
	readonly selG: string | null;
	readonly label: any;
	readonly tidyPreview: boolean;
	readonly tidyHeld: boolean;
	/** The routes an arrow cycles through, in order. */
	readonly routes: string[];
	/** Selected boxes that exist, selected arrows that exist, and the one selected box when it is alone. */
	ids(): string[];
	ix(): number[];
	one(): any;
	node(id: string): any;
	edge(index: number): any;
	/** A palette, a text field or a menu has the keyboard. */
	blocked(): boolean;
	/** A text field has the keyboard (the clipboard belongs to it). */
	busy(): boolean;
	post(op: Op): void;
	send(message: { type: string; [k: string]: any }): void;
	// effects
	tidy: { hold(): void; apply(): void; cancel(): void };
	arrange(command: string): void;
	moveSelectionToLayer(delta: number): void;
	copyStyle(): void;
	pasteStyle(): void;
	group(): void;
	ungroup(): void;
	selectAll(): void;
	clearSelection(): void;
	deleteSelection(): void;
	duplicate(ids: string[], dx: number, dy: number): void;
	fit(): void;
	resetFit(): void;
	edit(id: string, text?: string): void;
	nextBox(below: boolean): void;
	setLastCat(key: string): void;
	clipText(): string;
	paste(text: string): boolean;
	/** A fresh node id and the middle of the canvas in mm (snapped), for toolbar insertions. */
	newId(): string;
	centre(): { x: number; y: number };
	pendingEdit(id: string): void;
	pendingSelect(ids: string[]): void;
	preambleText(): string;
	openObjectMenu(): void;
}

export interface Command {
	id: string;
	title: string;
	/** Key patterns, see keys.ts. */
	keys?: string[];
	/** The shortcut belongs to the browser (clipboard events); it is listed in the help but not matched on keydown. */
	native?: boolean;
	/** The id this command has in VS Code (`sakuga.…`), package.json and the host list it too; a test keeps them equal. */
	vscode?: string;
	/** Position and wording of the row in the "?" table. */
	help?: { at: number; keys?: string; text?: string };
	when(s: AppState, k?: KeyInfo): boolean;
	run(s: AppState, args?: any): Op | void;
}
