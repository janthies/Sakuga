import { persist } from '../../store/prefs';
import { vscode } from '../../platform/host';
import { Row } from '../../ui/row';
import { Section, SectionMemory } from '../../ui/section';
import { propRow } from './props';
import type { PanelCtx, RowSpec, SectionSpec } from './spec';

// Turns SectionSpecs into sections and rows. This is the only place that walks a spec.

// Sections remember their open state per section id in the webview state.
export const memory = (pane: string): SectionMemory => ({
	read: (id) => (vscode.getState()?.sections || {})[`${pane}.${id}`],
	write: (id, open) => persist({ sections: { ...vscode.getState()?.sections, [`${pane}.${id}`]: open } }),
});

export function buildRow(c: PanelCtx, spec: RowSpec): Row | null {
	if (spec.when && !spec.when(c)) return null;
	if ('prop' in spec || 'props' in spec) return propRow(c, spec);
	const built = spec.custom(c);
	if (!built) return null;
	const row = new Row(
		spec.label,
		Array.isArray(built) ? built : [built],
		[spec.label ? '' : 'wide', spec.class].filter(Boolean).join(' '),
	);
	return row;
}

// Fills `pane` with one section per skeleton entry, in skeleton order; a spec of that id supplies title and rows.
export function mountSections(
	pane: HTMLElement,
	skeleton: readonly { id: string; title: string }[],
	specs: SectionSpec[],
	c: PanelCtx,
	paneName: string,
): Section[] {
	const mem = memory(paneName);
	return skeleton.map(({ id, title }) => {
		const spec = specs.find((s) => s.id === id);
		const section = new Section(id, spec?.title ?? title, spec?.collapsed ?? false, mem);
		for (const rowSpec of spec?.rows ?? []) {
			const row = buildRow(c, rowSpec);
			if (row) section.body.append(row.el);
		}
		section.settle();
		pane.append(section.el);
		return section;
	});
}
