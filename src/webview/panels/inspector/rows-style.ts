import { ARROW } from '../../store/constants';
import { ROW_OF, STYLE_KEYS, dismissedHints, show } from '../../store/constants';
import { addStyle } from '../../commands/styles';
import { nodeStyleKind, post, styleDef, styleUsers } from '../../store/model';
import { persist } from '../../store/prefs';
import { styleColor } from '../../render/svg';
import { store } from '../../store/store';
import type { ViewNode, ViewStyle } from '../../store/types';
import { Actions } from '../../ui/actions';
import { Block } from '../../ui/block';
import { ChoiceControl } from '../../ui/choice';
import { MIXED, h } from '../../ui/control';
import type { PanelCtx, RowControls } from './spec';

// The Style section of boxes and labels: the style picker with its override count, and the three exits from the overrides.

export const styleSwatch = (def: ViewStyle) =>
	def.kind === 'box'
		? styleColor(def.props.fill, '#ffffff')
		: def.kind === 'arrow'
			? styleColor(def.props.color, ARROW)
			: def.kind === 'label'
				? styleColor(def.props.textColor, '#444444')
				: styleColor(def.props.color, '#bbbbbb');

interface Info {
	ids: string[];
	objs: ViewNode[];
	kind: 'box' | 'label';
	same: string | typeof MIXED;
	overrides: number;
}

// The nodes the style header acts on: those with a style kind, when they all share one.
function info(c: PanelCtx): Info | null {
	const styled = c.sel.nodes.filter((n) => nodeStyleKind(n));
	if (!styled.length) return null;
	const kind = nodeStyleKind(styled[0]) as 'box' | 'label';
	if (!styled.every((n) => nodeStyleKind(n) === kind)) return null;
	const same = styled.every((o) => o.cat === styled[0].cat) ? styled[0].cat : MIXED;
	const keys = (o: ViewNode) => new Set((o.overrides || []).map((k) => ROW_OF[k] || k)).size;
	return {
		ids: styled.map((n) => n.id),
		objs: styled,
		kind,
		same,
		overrides: same === MIXED ? 0 : Math.max(...styled.map(keys)),
	};
}

export function styleRow(c: PanelCtx): RowControls {
	const i = info(c);
	if (!i) return null;
	const picker = new ChoiceControl(
		[
			{ value: '', label: 'Plain', color: '#ffffff' },
			...store.styles
				.filter((s) => s.kind === 'box')
				.map((s) => ({ value: s.key, label: show(s.name), color: styleSwatch(s), icon: s.icon })),
		],
		'Category',
	);
	picker.set(i.same);
	picker.onCommit((v) => {
		if (v === null) return;
		if (i.kind === 'box') store.lastCat = v;
		post({ op: 'batch', ops: i.ids.map((id) => ({ op: 'setCategory', id, category: v })) });
	});
	if (!i.overrides) return picker;
	const badge = h(
		'span',
		'override-count',
		{
			title: `${i.overrides} propert${i.overrides === 1 ? 'y differs' : 'ies differ'} from the style`,
		},
		`+${i.overrides}`,
	);
	return [picker, new Block(badge)];
}

export function styleActionsRow(c: PanelCtx): RowControls {
	const i = info(c);
	if (!i) return null;
	const plain =
		i.same === '' &&
		i.objs.some((o) => STYLE_KEYS.some((k) => o.style?.[k as 'fill'] !== undefined && o.style?.[k as 'fill'] !== ''));
	if (!i.overrides && !plain) return null;
	const def = i.same === MIXED ? undefined : styleDef(i.same);
	const actions = [];
	if (i.overrides) {
		actions.push({
			label: 'Reset to style',
			title: 'Remove the overrides of this object',
			run: () => post({ op: 'batch', ops: i.ids.map((id) => ({ op: 'resetOverride', id })) }),
		});
	}
	const others = def ? styleUsers(def) - 1 : 0;
	if (i.overrides && i.ids.length === 1 && def) {
		actions.push({
			label: 'Update style from this object',
			title:
				others > 0
					? `The style "${show(def.name)}" takes this look; ${others} other ${others === 1 ? 'object changes' : 'objects change'}`
					: 'The style takes this look',
			run: () => post({ op: 'applyToCategory', id: i.ids[0] }),
		});
	}
	if (i.ids.length === 1) {
		actions.push({
			label: 'New style from this object',
			title: 'Make a new style with this look',
			run: () => addStyle(i.kind, { id: i.ids[0] }),
		});
	}
	const bar = new Actions(actions, 'buttons style-actions');
	if (i.overrides && i.ids.length === 1 && def && others > 0) {
		bar.el.append(
			h(
				'p',
				'style-note',
				{},
				`Changes ${others} other ${i.kind === 'label' ? 'label' : 'box'}${others === 1 ? '' : 'es'}.`,
			),
		);
	}
	return bar;
}

// Boxes that share the same overrides: offer to make a style from them.
export function sharedHintRow(c: PanelCtx): RowControls {
	const i = info(c);
	if (!i || i.kind !== 'box') return null;
	const dismissed = dismissedHints();
	const hint = store.shared.find(
		(g) => !dismissed.has(JSON.stringify([g.cat, g.props])) && i.ids.some((id) => g.ids.includes(id)),
	);
	if (!hint) return null;
	const bar = new Actions(
		[
			{ label: 'Make style', run: () => addStyle('box', { id: hint.ids[0] }, { ids: hint.ids }) },
			{
				label: 'Dismiss',
				run: () => {
					persist({ dismissedHints: [...dismissed, JSON.stringify([hint.cat, hint.props])] });
					c.refresh();
				},
			},
		],
		'buttons',
	);
	return new Block(
		h(
			'div',
			'style-hint',
			{},
			h('span', '', {}, `${hint.ids.length} boxes share the same overrides: make a style?`),
			bar.el,
		),
	);
}
