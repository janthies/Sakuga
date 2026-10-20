// Settings the host reads. No VS Code configuration is contributed yet, so the adapter returns these defaults.
export interface Settings {
	/** Goes into the preamble of the document and the export. */
	preamble: string;
	exportTimeoutMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
	preamble: '\\usetikzlibrary{arrows.meta, fit, backgrounds, svg.path, shapes.geometric, patterns}',
	exportTimeoutMs: 120000,
};
