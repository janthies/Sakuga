// Settings the host reads. No VS Code configuration is contributed yet, so the adapter returns these defaults.
export interface Settings {
	/** Goes into the preamble of the document and the export. */
	preamble: string;
	exportTimeoutMs: number;
	'export.width': number;
	'export.font': string;
}

export const DEFAULT_SETTINGS: Settings = {
	preamble:
		'\\usepackage{graphicx}\n\\usetikzlibrary{arrows.meta, fit, backgrounds, svg.path, shapes.geometric, patterns}',
	exportTimeoutMs: 120000,
	'export.width': 146,
	'export.font': 'small',
};
