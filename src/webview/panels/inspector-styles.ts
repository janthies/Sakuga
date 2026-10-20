// @ts-nocheck
import { store } from '../store/store';
import { post, styleUsers } from '../store/model';
import { styleColour, styleSelect, styleSwatch } from '../ui/stylecontrols';
import { KIND_NAMES, STYLE_OPTS, show, sizes, tex } from '../store/constants';
import { iconPicker } from '../ui/iconpicker';
import { addStyle } from '../commands/styles';
import { slug } from '../store/layers';
import { saveState } from '../store/prefs';
import { render } from '../render/scene';
import { unit } from '../ui/controls';
import { setTab } from './chrome';

export function inspectorStyles(ctx) {
	ctx.section('Styles');
	const styleList = ctx.getSection('Styles', ctx.figure);
	const editStyle = (def, change) => post({ op: 'styleEdit', key: def.key, ...change });
	const styleEditor = (def) => {
		const panel = document.createElement('div');
		panel.className = 'category-edit style-edit';
		const fake = [{ style: def.props }];
		const line = (name, control) => {
			const r = document.createElement('div');
			r.className = 'row';
			const l = document.createElement('span');
			l.textContent = name;
			r.append(l, control);
			panel.append(r);
			return r;
		};
		const prop = (name, key, values) =>
			line(
				name,
				styleSelect(key, values, fake, (patch) => editStyle(def, { props: patch })),
			);
		const sizesList = ['', ...Object.keys(sizes)];
		if (def.kind === 'box') {
			prop('Colour', 'fill', ['', ...Object.keys(store.palette), 'none']);
			prop('Outline', 'border', ['', 'solid', 'dashed', 'dotted', 'none', 'double']);
			prop('Outline colour', 'color', ['', ...Object.keys(store.palette)]);
			prop('Width', 'weight', ['', 'medium', 'thick']);
			prop('Shape', 'shape', ['', 'rectangle', 'pill', 'ellipse', 'circle', 'diamond', 'cylinder']);
			prop('Text', 'text', ['', 'bold', 'italic', 'bold-italic']);
			prop('Font size', 'font', sizesList);
			line(
				'Text colour',
				styleColour('textColor', def.props.textColor || '', (patch) => editStyle(def, { props: patch })),
			);
			line(
				'Icon',
				iconPicker(def.icon, (icon) => editStyle(def, { icon })),
			);
			const boxes = document.createElement('input');
			boxes.type = 'checkbox';
			boxes.checked = !!def.boxes;
			boxes.setAttribute('aria-label', 'Use the icon in boxes');
			boxes.onchange = () => editStyle(def, { boxes: boxes.checked });
			line('Icon in boxes', boxes);
		} else if (def.kind === 'label') {
			prop('Text', 'text', ['', 'bold', 'italic', 'bold-italic']);
			prop('Font size', 'font', sizesList);
			line(
				'Text colour',
				styleColour('textColor', def.props.textColor || '', (patch) => editStyle(def, { props: patch })),
			);
			prop('Knock-out', 'fill', ['none', 'white']);
			prop('Outline', 'border', ['', 'solid', 'dashed', 'dotted', 'none']);
		} else if (def.kind === 'arrow') {
			prop('Line', 'border', ['', 'solid', 'dashed', 'dotted']);
			prop('Colour', 'color', ['', ...Object.keys(store.palette)]);
			prop('Line width (pt)', 'lineWidth', null);
			prop('Start', 'start', ['none', 'Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar']);
			prop('End', 'end', ['Latex', 'Stealth', 'triangle', 'barb', 'circle', 'bar', 'none']);
		} else {
			line(
				'Colour',
				styleColour('color', def.props.color || '', (patch) =>
					editStyle(def, { props: { color: patch.color || 'grey' } }),
				),
			);
			line(
				'Outline',
				ctx.choice(
					['none', 'solid', 'dashed', 'dotted', 'region'].map((v) => [v, v]),
					def.props.frame || 'dashed',
					(frame) => editStyle(def, { props: { frame } }),
				),
			);
		}
		if (def.kind === 'box' || def.kind === 'arrow') {
			const flag = document.createElement('input');
			flag.type = 'checkbox';
			flag.checked = !!def.legend;
			flag.setAttribute('aria-label', 'Show in legend');
			flag.onchange = () => editStyle(def, { legend: flag.checked });
			line('In legend', flag);
		}
		const users = styleUsers(def),
			remove = document.createElement('button');
		remove.type = 'button';
		remove.textContent = 'Delete style';
		const confirm = document.createElement('div');
		confirm.className = 'style-delete';
		confirm.hidden = true;
		const where = document.createElement('select');
		where.setAttribute('aria-label', 'Where the objects go');
		where.add(new Option('Keep their look, without a style', ''));
		for (const o of store.styles.filter((s) => s.kind === def.kind && s.key !== def.key))
			where.add(new Option('Move to ' + show(o.name), o.key));
		const ok = document.createElement('button');
		ok.type = 'button';
		ok.textContent = 'Delete';
		ok.onclick = () => post({ op: 'styleDelete', key: def.key, to: where.value });
		const cancel = document.createElement('button');
		cancel.type = 'button';
		cancel.textContent = 'Cancel';
		cancel.onclick = () => {
			confirm.hidden = true;
			remove.hidden = false;
		};
		const ask = document.createElement('span');
		ask.textContent = `${users} object${users === 1 ? '' : 's'} use${users === 1 ? 's' : ''} it. Where do they go?`;
		const row2 = document.createElement('div');
		row2.className = 'buttons';
		row2.append(ok, cancel);
		confirm.append(ask, where, row2);
		remove.onclick = () => {
			if (!users) {
				post({ op: 'styleDelete', key: def.key });
				return;
			}
			remove.hidden = true;
			confirm.hidden = false;
		};
		panel.append(remove, confirm);
		return panel;
	};
	for (const kind of ['box', 'arrow', 'frame', 'label']) {
		const defs = store.styles.filter((s) => s.kind === kind);
		const head = document.createElement('div');
		head.className = 'category-heading style-group';
		const title = document.createElement('span');
		title.textContent = KIND_NAMES[kind] + ' styles';
		const addButton = document.createElement('button');
		addButton.type = 'button';
		addButton.className = 'icon';
		addButton.textContent = '+';
		addButton.title = 'Add a ' + kind + ' style';
		addButton.setAttribute('aria-label', 'Add a ' + kind + ' style');
		addButton.onclick = () => addStyle(kind);
		const legendHeading = document.createElement('span');
		legendHeading.textContent = kind === 'box' ? 'Legend' : '';
		head.append(title, legendHeading, addButton);
		styleList.append(head);
		if (!defs.length) {
			const none = document.createElement('p');
			none.className = 'empty style-empty';
			none.textContent = 'None yet';
			styleList.append(none);
		}
		for (const def of defs) {
			const item = document.createElement('div');
			item.className = 'category-item style-item';
			const line = document.createElement('div');
			line.className = 'category-line style-line';
			const sw = document.createElement('button');
			sw.type = 'button';
			sw.className = 'category-swatch';
			sw.style.background = styleSwatch(def);
			sw.title = 'Edit ' + show(def.name);
			sw.setAttribute('aria-label', sw.title);
			const name = ctx.field(show(def.name), (v) => {
				const next = tex(v);
				if (store.openStyles.has(def.key)) {
					store.openStyles.delete(def.key);
					store.openStyles.add(slug(next, def.key));
				}
				editStyle(def, { name: next });
			});
			name.setAttribute('aria-label', 'Style name');
			name.dataset.styleName = def.key;
			const users = document.createElement('span');
			users.className = 'style-count';
			const count = styleUsers(def);
			users.textContent = String(count);
			users.title = count + (count === 1 ? ' object uses' : ' objects use') + ' this style';
			const inLegend = document.createElement('input');
			inLegend.type = 'checkbox';
			inLegend.disabled = kind !== 'box' && kind !== 'arrow';
			inLegend.hidden = kind !== 'box';
			inLegend.checked = !!def.legend;
			inLegend.title = 'Include in legend';
			inLegend.setAttribute('aria-label', 'Include ' + show(def.name) + ' in legend');
			inLegend.onchange = () => editStyle(def, { legend: inLegend.checked });
			const edit = styleEditor(def);
			edit.hidden = !store.openStyles.has(def.key);
			sw.setAttribute('aria-expanded', String(!edit.hidden));
			const toggle = () => {
				edit.hidden = !edit.hidden;
				if (edit.hidden) store.openStyles.delete(def.key);
				else store.openStyles.add(def.key);
				sw.setAttribute('aria-expanded', String(!edit.hidden));
			};
			sw.onclick = toggle;
			line.onclick = (ev) => {
				if (ev.target === line || ev.target === users) toggle();
			};
			line.append(sw, name, users, inLegend);
			item.append(line, edit);
			styleList.append(item);
		}
	}
}
export function inspectorFigure(ctx) {
	ctx.section('Figure');
	ctx.row(
		'Font size',
		ctx.choice(
			Object.keys(sizes).map((v) => [v, v]),
			store.figureFont,
			(size) => post({ op: 'font', size }),
		),
	);
	const lg = document.createElement('input');
	lg.type = 'checkbox';
	lg.checked = store.legend;
	lg.addEventListener('change', () => post({ op: 'legend', on: lg.checked }));
	ctx.row('Legend', lg);

	ctx.row(
		'Arrows',
		ctx.choice(STYLE_OPTS, store.arrowsStyle, (v) => post({ op: 'arrows', style: v })),
	);
	ctx.row(
		'Grid',
		ctx.field(
			store.grid,
			(v) => {
				store.grid = Math.max(0.5, +v || 1);
				saveState();
				render();
			},
			{ type: 'number' },
		),
		unit('mm'),
	);
	for (const [key, body] of ctx.sections) {
		body.parentElement.hidden = !body.children.length;
	}
	const signature = JSON.stringify([
		[...store.selN],
		[...store.selE],
		store.selG,
		store.selN.label,
		[...store.selectedLayers],
	]);
	const has = !!(store.selN.size || store.selE.size || store.selG || store.selN.label || store.selectedLayers.size);
	if (has && signature !== store.lastInspectorSelection) setTab('selection');
	store.lastInspectorSelection = signature;
	document.getElementById('tab-count').textContent = ctx.count > 1 ? String(ctx.count) : '';
}
export function markOverride(r, ids, indices, props) {
	r.classList.add('overridden');
	const reset = document.createElement('button');
	reset.type = 'button';
	reset.className = 'reset-prop';
	reset.textContent = 'reset';
	reset.title = 'Back to the style';
	reset.onclick = () => post({ op: 'resetStyle', ...(ids ? { ids } : { indices }), keys: props });
	r.append(reset);
}
