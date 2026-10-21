import { h } from '../../ui/control';
import { post } from '../../store/model';
import { defsOf } from '../../../core/schema';
import type { Kind } from '../../../core/schema/props';
import { persist } from '../../store/prefs';
import { vscode } from '../../platform/host';
import { Row } from '../../ui/row';
import { Section, SectionMemory } from '../../ui/section';
import { ObjectSubject } from './subject';
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
	if ('prop' in spec || 'props' in spec)
		return propRow(spec.target === 'label' ? { ...c, subject: ObjectSubject.children(c.sel) } : c, spec);
	const built = spec.custom(c);
	if (!built) return null;
	const row = new Row(
		spec.label,
		Array.isArray(built) ? built : [built],
		[spec.label ? '' : 'wide', spec.class].filter(Boolean).join(' '),
	);
	if (spec.label === 'Opacity' && c.subject.def('opacity')) {
		const def = c.subject.def('opacity')!;
		row.controls[0].el.title = c.subject.read(def).source || '';
		if (c.subject.overridden(['opacity'])) {
			row.override(() => c.subject.reset(['opacity']));
			const apply = h('button', 'apply-prop', { type: 'button' }, c.subject.applyLabel || 'Apply to theme');
			apply.onclick = () => c.subject.apply?.(['opacity']);
			row.el.append(apply);
		}
	}
	if (spec.label === 'Route' && c.sel.edges.length) {
		const own = c.sel.edges.some(({ e }) => e.route !== 'auto');
		const control = row.controls[0].el;
		control.classList.toggle('inherited', !own);
		control.title = own ? 'Own value' : 'Theme';
		const reset = () =>
			post({
				op: 'batch',
				ops: c.sel.edges.map(({ i }) => ({ op: 'arrow', index: i, route: 'auto', mid: null, bend: 0 })),
			});
		if (own) {
			row.override(reset);
			const apply = h('button', 'apply-prop', { type: 'button' }, 'Apply to theme');
			apply.onclick = () =>
				post({
					op: 'batch',
					ops: [
						{ op: 'arrows', style: c.sel.edges[0].e.route },
						...c.sel.edges.map(({ i }) => ({ op: 'arrow', index: i, route: 'auto', mid: null, bend: 0 })),
					],
				});
			row.el.append(apply);
		}
	}
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
		const rows = [...(spec?.rows || [])];
		if (id === 'more') {
			const shown = new Set(
				specs.flatMap((s) => s.rows.flatMap((r) => ('prop' in r ? [r.prop] : 'props' in r ? r.props : []))),
			);
			if (specs.some((s) => s.rows.some((r) => 'custom' in r && r.label === 'Opacity'))) shown.add('opacity');
			for (const kind of c.subject.kinds)
				for (const def of defsOf(kind as Kind)) {
					if (
						!shown.has(def.key) &&
						!['step', 'labelStyle', 'titlePosition', 'titleFont', 'titleColor', 'titleBold'].includes(def.key)
					) {
						rows.push({ prop: def.key });
						shown.add(def.key);
					}
				}
		}
		for (const rowSpec of rows) {
			const row = buildRow(c, rowSpec);
			if (row) section.body.append(row.el);
		}
		section.settle();
		pane.append((spec?.title ?? title) === '' ? section.body : section.el);
		return section;
	});
}
