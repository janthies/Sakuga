export interface ExportTarget {
	width: number;
	font: string;
}
export const EXPORT_DEFAULTS: ExportTarget = { width: 146, font: 'small' };
export const EXPORT_PRESETS = [
	{ name: 'Thesis', width: 146, font: 'small' },
	{ name: 'Paper column', width: 88, font: 'footnotesize' },
	{ name: 'Paper full width', width: 180, font: 'footnotesize' },
];
export const exportTarget = (fig: { exportDefaults?: ExportTarget; export?: Partial<ExportTarget> }): ExportTarget => ({
	...EXPORT_DEFAULTS,
	...fig.exportDefaults,
	...fig.export,
});
export const documentPt = (width: number) => (width === 88 || width === 180 ? 10 : 11);
export function exportTextPt(target: ExportTarget, natural: number, font = target.font): number {
	const paper = documentPt(target.width) === 10;
	const pt =
		(
			{
				tiny: paper ? 5 : 6,
				scriptsize: paper ? 7 : 8,
				footnotesize: paper ? 8 : 9,
				small: paper ? 9 : 10,
				normalsize: paper ? 10 : 10.95,
				large: 12,
			} as Record<string, number>
		)[font] || 10;
	return pt * Math.min(1, target.width / Math.max(1, natural));
}
