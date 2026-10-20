// @ts-nocheck
import { store } from '../store/store';
import { calls } from '../store/calls';
import { inspectorSelection } from './inspector-selection';
import { inspectorFigure, inspectorStyles } from './inspector-styles';
import { inspector } from '../platform/dom';
import { vscode } from '../platform/host';
import { persist } from '../store/prefs';
import { segmented, sizeSegments, unit } from '../ui/controls';
import { styleChoice, titlePositionPicker } from '../ui/stylecontrols';
import { ROW_OF, SIZE_LABEL, STYLE_KEYS, dismissedHints, show, sizes } from '../store/constants';
import { byId, nodeStyleKind, post, styleDef, styleUsers } from '../store/model';
import { addStyle } from '../commands/styles';

export function renderInspector() {
	if (store.tidyPreview) return;
	renderInspectorRaw();
}
function renderInspectorRaw() {
	const ctx = {};
	if (inspectorBase(ctx)) return;
	if (inspectorStyleHeader(ctx)) return;
	if (inspectorSelection(ctx)) return;
	if (inspectorStyles(ctx)) return;
	if (inspectorFigure(ctx)) return;
}
function inspectorBase(ctx) {
	if (store.floating && inspector.contains(store.floating.anchor)) {
		return true;
	}
	if (inspector.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') {
		return true;
	}
	inspector.replaceChildren();
	const makePane = (id) => {
		const p = document.createElement('div');
		p.id = id;
		p.className = 'tabpane';
		p.setAttribute('role', 'tabpanel');
		inspector.append(p);
		return p;
	};
	ctx.selection = makePane('pane-selection');
	ctx.figure = makePane('pane-figure');
	ctx.sections = new Map();
	let figureMode = false;
	ctx.current = 'Text';
	ctx.getSection = (title, parent = ctx.selection) => {
		const key = (parent === ctx.selection ? 'selection.' : 'figure.') + title;
		if (ctx.sections.has(key)) return ctx.sections.get(key);
		const d = document.createElement('details'),
			h = document.createElement('summary'),
			body = document.createElement('div');
		d.className = 'inspector-section';
		h.textContent = title;
		body.className = 'section-body';
		d.open = (vscode.getState()?.sections || {})[key] ?? !['Shape & decoration', 'Arrange'].includes(title);
		d.ontoggle = () => persist({ sections: { ...vscode.getState()?.sections, [key]: d.open } });
		d.append(h, body);
		parent.append(d);
		ctx.sections.set(key, body);
		return body;
	};
	for (const title of ['Style', 'Text', 'Fill', 'Outline', 'Route & tips', 'Shape & decoration', 'Arrange'])
		ctx.getSection(title);
	for (const title of ['Text', 'Arrows', 'Legend', 'Grid', 'Styles']) ctx.getSection(title, ctx.figure);
	ctx.section = (title) => {
		if (title === 'Styles' || title === 'Figure') {
			figureMode = true;
			ctx.current = title === 'Figure' ? 'Text' : title;
			return;
		}
		ctx.current = ['Style', 'Fill', 'Outline'].includes(title) ? title : 'Text';
	};
	ctx.row = (name, ...controls) => {
		const r = document.createElement('div');
		r.className = 'row';
		const label = document.createElement('span');
		label.textContent = name;
		r.append(label, ...controls);
		const suffix = / \((pt|mm|%)\)$/.exec(name);
		if (suffix) {
			label.textContent = name.slice(0, -suffix[0].length);
			r.append(unit(suffix[1]));
		}
		let target = ctx.current;
		if (figureMode) {
			target =
				ctx.current === 'Styles'
					? ctx.current
					: { 'Font size': 'Text', Arrows: 'Arrows', Legend: 'Legend', Grid: 'Grid' }[name] || ctx.current;
		} else {
			if (
				[
					'Code size',
					'Title',
					'Code',
					'Label',
					'Name',
					'Text',
					'Font size',
					'Title size',
					'Bold title',
					'bold',
					'italic',
					'Knock-out',
					'Text colour',
					'Title colour',
					'Title at',
					'Title position',
				].includes(name)
			)
				target = 'Text';
			else if (
				[
					'Icon',
					'Icons',
					'Style icon',
					'Pattern',
					'Pattern colour',
					'Corner mark',
					'Corner',
					'Mark size',
					'Mark colour',
					'Shape',
				].includes(name) ||
				(name === 'Position' && controls[0]?.className === 'segments')
			)
				target = 'Shape & decoration';
			else if (name === 'Style') target = 'Style';
			else if (name === 'Thin frame') target = 'Outline';
			else if (
				[
					'X',
					'Y',
					'Width',
					'Height',
					'Padding',
					'Strength',
					'Opacity',
					'Move to layer',
					'Attached to',
					'Parent anchor',
					'Own anchor',
					'Offset X',
					'Offset Y',
					'From',
					'To',
					'Start side',
					'End side',
					'Lane',
					'Step',
				].includes(name)
			)
				target = name === 'Strength' ? 'Fill' : 'Arrange';
			else if (['Route', 'Heads', 'Start', 'End'].includes(name)) target = 'Route & tips';
			else if (['Label at', 'Label side', 'Side'].includes(name)) target = 'Shape & decoration';
		}
		target = controls[0]?._inspectorSection || target;
		ctx.getSection(target, figureMode ? ctx.figure : ctx.selection).append(r);
		for (const c of controls) {
			if (c.tagName === 'INPUT' || c.tagName === 'SELECT')
				c.setAttribute('aria-label', c.getAttribute('aria-label') || name);
		}
		const num = controls.find((c) => c.type === 'number');
		if (num) {
			label.classList.add('scrub');
			label.title = 'Drag to adjust ' + name;
			label.onpointerdown = (ev) => {
				if (ev.button !== 0) return;
				ev.preventDefault();
				label.setPointerCapture(ev.pointerId);
				const x = ev.clientX,
					initial = +num.value || 0,
					step = +(num.step === 'any' ? 1 : num.step) || 1;
				const move = (e) => {
					const v = initial + Math.round((e.clientX - x) / 4) * step;
					num.value = String(
						Math.max(
							num.min === '' ? -Infinity : +num.min,
							Math.min(num.max === '' ? Infinity : +num.max, +v.toFixed(3)),
						),
					);
				};
				const end = () => {
					label.removeEventListener('pointermove', move);
					label.removeEventListener('pointerup', end);
					label.removeEventListener('pointercancel', end);
					num.dispatchEvent(new Event('change', { bubbles: true }));
				};
				label.addEventListener('pointermove', move);
				label.addEventListener('pointerup', end);
				label.addEventListener('pointercancel', end);
			};
		}
		return r;
	};
	ctx.field = (value, onChange, opts = {}) => {
		const i = document.createElement('input');
		i.type = opts.type || 'text';
		i.value = value;
		if (opts.mono) {
			i.className = 'mono';
		}
		i.addEventListener('change', () => {
			if (i.type === 'number' && (i.value === '' || !Number.isFinite(+i.value))) return;
			onChange(i.value);
		});
		return i;
	};
	ctx.choice = (options, value, onChange) => {
		if (options.some(([v]) => v === 'inside-top-left')) return titlePositionPicker(options, value, onChange);
		if (options.some(([v]) => SIZE_LABEL[v])) return sizeSegments(options, value, onChange);
		if (
			options.length <= 7 &&
			options.every(([v]) => !Object.keys(sizes).includes(v)) &&
			!options.some(([v]) => store.nodes.some((n) => n.id === v) || store.layers.some((l) => l.id === v))
		)
			return segmented(options, value, onChange);
		const select = document.createElement('select');
		for (const [v, label] of options) select.add(new Option(label, v));
		select.value = value;
		select.onchange = () => onChange(select.value);
		return select;
	};
}
function inspectorStyleHeader(ctx) {
	// Style picker on top, the "+N" of overrides, and the three exits from them.
	ctx.styleHeader = (ids) => {
		const objs = ids.map(byId),
			kind = nodeStyleKind(objs[0]);
		const same = objs.every((o) => o.cat === objs[0].cat) ? objs[0].cat : '*';
		const keys = (o) => [...new Set((o.overrides || []).map((k) => ROW_OF[k] || k))];
		const nOver = same === '*' ? 0 : Math.max(...objs.map((o) => keys(o).length));
		const picker = styleChoice(kind, same, (v) => {
			if (v !== '*') {
				if (kind === 'box') {
					store.lastCat = v;
				}
				post({ op: 'batch', ops: ids.map((id) => ({ op: 'node', id, cat: v })) });
			}
		});
		const r = ctx.row('Style', picker);
		if (nOver) {
			const c = document.createElement('span');
			c.className = 'override-count';
			c.textContent = `+${nOver}`;
			c.title = `${nOver} propert${nOver === 1 ? 'y differs' : 'ies differ'} from the style`;
			r.append(c);
		}
		const plainProps =
			same === '' && objs.some((o) => STYLE_KEYS.some((k) => o.style?.[k] !== undefined && o.style[k] !== ''));
		const def = styleDef(same);
		if (nOver || plainProps) {
			const wrap = document.createElement('div');
			wrap.className = 'buttons style-actions';
			const button = (text, title, fn) => {
				const b = document.createElement('button');
				b.type = 'button';
				b.textContent = text;
				b.title = title;
				b.onclick = fn;
				wrap.append(b);
				return b;
			};
			if (nOver) {
				button('Reset to style', 'Remove the overrides of this object', () => post({ op: 'resetStyle', ids }));
			}
			if (nOver && ids.length === 1 && def) {
				const others = styleUsers(def) - 1;
				button(
					'Update style from this object',
					others > 0
						? `The style "${show(def.name)}" takes this look; ${others} other ${others === 1 ? 'object changes' : 'objects change'}`
						: 'The style takes this look',
					() => post({ op: 'styleUpdate', key: def.key, id: ids[0] }),
				);
				if (others > 0) {
					const note = document.createElement('p');
					note.className = 'style-note';
					note.textContent = `Changes ${others} other ${kind === 'label' ? 'label' : 'box'}${others === 1 ? '' : 'es'}.`;
					wrap.append(note);
				}
			}
			if (ids.length === 1) {
				button('New style from this object', 'Make a new style with this look', () => addStyle(kind, { id: ids[0] }));
			}
			ctx.getSection('Style').append(wrap);
		}
		const dismissed = dismissedHints();
		const hint =
			kind === 'box'
				? store.shared.find(
						(g) => !dismissed.has(JSON.stringify([g.cat, g.props])) && ids.some((id) => g.ids.includes(id)),
					)
				: null;
		if (hint) {
			const box = document.createElement('div');
			box.className = 'style-hint';
			const text = document.createElement('span');
			text.textContent = `${hint.ids.length} boxes share the same overrides: make a style?`;
			const actions = document.createElement('div');
			actions.className = 'buttons';
			const make = document.createElement('button');
			make.type = 'button';
			make.textContent = 'Make style';
			make.onclick = () => addStyle('box', { id: hint.ids[0] }, { ids: hint.ids });
			const no = document.createElement('button');
			no.type = 'button';
			no.textContent = 'Dismiss';
			no.onclick = () => {
				persist({ dismissedHints: [...dismissed, JSON.stringify([hint.cat, hint.props])] });
				renderInspectorRaw();
			};
			actions.append(make, no);
			box.append(text, actions);
			ctx.getSection('Style').append(box);
		}
	};
}

calls.renderInspector = renderInspector;
