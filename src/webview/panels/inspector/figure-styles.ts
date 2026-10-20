import { KIND_NAMES, show, tex } from '../../store/constants';
import { addStyle } from '../../commands/styles';
import { post, styleUsers } from '../../store/model';
import { slug } from '../../store/layers';
import { store } from '../../store/store';
import type { ViewStyle } from '../../store/types';
import { Actions } from '../../ui/actions';
import { Block } from '../../ui/block';
import { h } from '../../ui/control';
import { IconPicker } from '../../ui/iconpicker';
import { Segmented } from '../../ui/segmented';
import { SelectControl } from '../../ui/select';
import { TextControl } from '../../ui/text';
import { Toggle } from '../../ui/toggle';
import { buildRow } from './build';
import type { Selection } from './selection';
import { StyleSubject } from './subject';
import type { PanelCtx, RowSpec } from './spec';
import { styleSwatch } from './rows-style';

// The named styles of the figure, listed by kind. A style opens into an editor built from the same property rows.

const edit = (def: ViewStyle, change: Record<string, unknown>) => post({ op: 'styleEdit', key: def.key, ...change });

const legendRow = (def: ViewStyle): RowSpec => ({
	label: 'In legend',
	custom: () => {
		const t = new Toggle({ label: 'Show in legend' });
		t.set(!!def.legend);
		t.onCommit((legend) => edit(def, { legend: !!legend }));
		return t;
	},
});

const iconRows = (def: ViewStyle): RowSpec[] => [
	{
		label: 'Icon',
		custom: () => {
			const p = new IconPicker();
			p.set(def.icon || '');
			p.onCommit((icon) => edit(def, { icon: icon ?? '' }));
			return p;
		},
	},
];

const knockOut = (def: ViewStyle): RowSpec => ({
	label: 'Knock-out',
	custom: () => {
		const s = new Segmented<string>(
			[
				{ value: 'none', label: 'None', text: 'None' },
				{ value: 'white', label: 'White', text: 'White' },
			],
			'Knock-out',
		);
		s.set(def.props.fill === 'white' ? 'white' : 'none');
		s.onCommit((fill) => edit(def, { props: { fill: fill! } }));
		return s;
	},
});

function editorRows(def: ViewStyle): RowSpec[] {
	switch (def.kind) {
		case 'box':
			return [
				{
					label: 'Marker colour',
					custom: () => {
						const c = new TextControl({ ariaLabel: 'Marker colour' });
						c.set(def.color || '');
						c.onCommit((color) => post({ op: 'categoryEdit', key: def.key, patch: { color: color || 'white' } }));
						return c;
					},
				},
				{ prop: 'fill', label: 'Fill' },
				{ prop: 'border', label: 'Outline' },
				{ prop: 'color', label: 'Outline colour' },
				...iconRows(def),
				legendRow(def),
			];
		case 'label':
			return [
				{ label: 'Font', props: ['text', 'font'] },
				{ prop: 'textColor' },
				knockOut(def),
				{ prop: 'border', label: 'Outline' },
			];
		case 'arrow':
			return [
				{ prop: 'border', label: 'Line' },
				{ prop: 'color', label: 'Colour' },
				{ prop: 'lineWidth' },
				{ label: 'Tips', props: ['start', 'end'] },
				legendRow(def),
			];
		default:
			return [
				{ prop: 'color', label: 'Colour' },
				{ prop: 'frame', label: 'Outline' },
			];
	}
}

const NO_SELECTION: Selection = { mode: 'none', nodes: [], edges: [], layers: [], attached: null, count: 0 };

function deleteBlock(def: ViewStyle): HTMLElement {
	const users = styleUsers(def);
	const remove = h('button', '', { type: 'button' }, 'Delete style');
	const where = new SelectControl(
		[
			{ value: '', label: 'Keep their look, without a style' },
			...store.styles
				.filter((s) => s.kind === def.kind && s.key !== def.key)
				.map((o) => ({ value: o.key, label: 'Move to ' + show(o.name) })),
		],
		'Where the objects go',
	);
	where.set('');
	const confirm = h(
		'div',
		'style-delete',
		{},
		h('span', '', {}, `${users} object${users === 1 ? '' : 's'} use${users === 1 ? 's' : ''} it. Where do they go?`),
		where.el,
	);
	confirm.hidden = true;
	const ok = new Actions([
		{ label: 'Delete', run: () => post({ op: 'styleDelete', key: def.key, to: where.el.value }) },
		{
			label: 'Cancel',
			run: () => {
				confirm.hidden = true;
				remove.hidden = false;
			},
		},
	]);
	confirm.append(ok.el);
	remove.onclick = () => {
		if (!users) {
			post({ op: 'styleDelete', key: def.key });
			return;
		}
		remove.hidden = true;
		confirm.hidden = false;
	};
	return h('div', '', {}, remove, confirm);
}

function editor(def: ViewStyle): HTMLElement {
	const panel = h('div', 'category-edit style-edit');
	const ctx: PanelCtx = { sel: NO_SELECTION, subject: new StyleSubject(def), refresh: () => {} };
	for (const spec of editorRows(def)) {
		const row = buildRow(ctx, spec);
		if (row) panel.append(row.el);
	}
	panel.append(...deleteBlock(def).children);
	return panel;
}

function item(def: ViewStyle): HTMLElement {
	const line = h('div', 'category-line style-line');
	const swatch = h('button', 'category-swatch', { type: 'button', title: 'Edit ' + show(def.name) });
	swatch.setAttribute('aria-label', swatch.title);
	swatch.style.background = styleSwatch(def) ?? '';
	const name = new TextControl({ ariaLabel: 'Style name' });
	name.set(show(def.name));
	name.el.dataset.styleName = def.key;
	name.onCommit((v) => {
		const next = tex(v ?? '');
		if (store.openStyles.has(def.key)) {
			store.openStyles.delete(def.key);
			store.openStyles.add(slug(next, def.key));
		}
		edit(def, { name: next });
	});
	const count = styleUsers(def);
	const users = h(
		'span',
		'style-count',
		{ title: count + (count === 1 ? ' object uses' : ' objects use') + ' this style' },
		String(count),
	);
	const inLegend = h('input', '', {
		type: 'checkbox',
		title: 'Include in legend',
		'aria-label': 'Include ' + show(def.name) + ' in legend',
	});
	inLegend.disabled = def.kind !== 'box' && def.kind !== 'arrow';
	inLegend.hidden = def.kind !== 'box';
	inLegend.checked = !!def.legend;
	inLegend.onchange = () => edit(def, { legend: inLegend.checked });
	const body = editor(def);
	body.hidden = !store.openStyles.has(def.key);
	swatch.setAttribute('aria-expanded', String(!body.hidden));
	const toggle = () => {
		body.hidden = !body.hidden;
		if (body.hidden) store.openStyles.delete(def.key);
		else store.openStyles.add(def.key);
		swatch.setAttribute('aria-expanded', String(!body.hidden));
	};
	swatch.onclick = toggle;
	line.onclick = (ev) => {
		if (ev.target === line || ev.target === users) toggle();
	};
	line.append(swatch, name.el, users, inLegend);
	return h('div', 'category-item style-item', {}, line, body);
}

export function styleList(): Block {
	const list = h('div');
	for (const kind of ['box', 'arrow', 'frame', 'label'] as const) {
		const defs = store.styles.filter((s) => s.kind === kind);
		const add = h(
			'button',
			'icon',
			{ type: 'button', title: 'Add a ' + kind + ' style', 'aria-label': 'Add a ' + kind + ' style' },
			'+',
		);
		add.onclick = () => addStyle(kind, undefined);
		list.append(
			h(
				'div',
				'category-heading style-group',
				{},
				h('span', '', {}, KIND_NAMES[kind] + ' styles'),
				h('span', '', {}, kind === 'box' ? 'Legend' : ''),
				add,
			),
		);
		if (!defs.length) list.append(h('p', 'empty style-empty', {}, 'None yet'));
		for (const def of defs) list.append(item(def));
	}
	return new Block(list);
}
