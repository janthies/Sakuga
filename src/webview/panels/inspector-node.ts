// @ts-nocheck
import { store } from '../store/store';
import { ANCHORS, r1, show, sizes, tex } from '../store/constants';
import { attachmentFor, byId, catOf, descendant, effectiveIcon, isBox, layout, post } from '../store/model';
import { anchorPicker, styleColour, styleSelect } from '../ui/stylecontrols';
import { iconPicker } from '../ui/iconpicker';
import { projectLabel } from '../render/labelgeom';
import { emphasisToggle, numberControl, unit } from '../ui/controls';

export function inspNode(ctx) {
	ctx.section(ctx.n.kind === 'icon' ? 'Free icon' : ctx.n.kind === 'label' ? 'Label' : 'Box');
	if (ctx.n.kind !== 'icon') {
		ctx.styleHeader([ctx.n.id]);
	}
	if (ctx.n.kind === 'icon') {
		ctx.row(
			'Font size',
			ctx.choice([['', 'Figure'], ...Object.keys(sizes).map((v) => [v, v])], ctx.n.style?.font || '', (font) =>
				post({ op: 'style', ids: [ctx.n.id], style: { font } }),
			),
		);
		ctx.row(
			'Text',
			styleSelect('text', ['', 'bold', 'italic', 'bold-italic'], [ctx.n], (style) =>
				post({ op: 'style', ids: [ctx.n.id], style }),
			),
		);
	}
	if (ctx.n.kind !== 'label') {
		ctx.row(
			'Icon',
			iconPicker(effectiveIcon(ctx.n), (icon) =>
				post({ op: 'node', id: ctx.n.id, icon: icon || (ctx.n.kind === 'icon' ? '' : 'none') }),
			),
		);
	}
	if (isBox(ctx.n)) {
		ctx.row(
			'Position',
			ctx.choice(
				[
					['left', 'Left of title'],
					['above', 'Above title'],
					['right', 'Right of title'],
					['nw', 'Top left'],
					['ne', 'Top right'],
					['sw', 'Bottom left'],
					['se', 'Bottom right'],
				],
				ctx.n.iconPosition || 'left',
				(iconPosition) => post({ op: 'node', id: ctx.n.id, iconPosition }),
			),
		);
		const inherit = document.createElement('input');
		inherit.type = 'checkbox';
		inherit.setAttribute('aria-label', 'Use style icon in this box');
		inherit.checked = ctx.n.icon === 'category' || (!ctx.n.icon && catOf(ctx.n.cat)?.boxes);
		inherit.onchange = () => post({ op: 'node', id: ctx.n.id, icon: inherit.checked ? 'category' : 'none' });
		ctx.row('Style icon', inherit);
	}
	ctx.row(
		ctx.n.kind === 'icon' ? 'Label' : 'Title',
		ctx.field(show(ctx.n.title.split('\\\\').join(' / ')), (v) =>
			post({ op: 'node', id: ctx.n.id, title: v.split(' / ').map(tex).join('\\\\') }),
		),
	);
	if (isBox(ctx.n)) {
		ctx.row(
			'Code',
			ctx.field(show(ctx.n.code), (v) => post({ op: 'node', id: ctx.n.id, code: tex(v) }), { mono: true }),
		);
	}

	if (isBox(ctx.n)) {
		ctx.row(
			'Title position',
			anchorPicker(ctx.n.titlePosition || 'center', (titlePosition) =>
				post({ op: 'node', id: ctx.n.id, titlePosition }),
			),
		);
	}
	const attach = (attachment) => post({ op: 'attach', id: ctx.n.id, attachment });
	ctx.row(
		'Attached to',
		ctx.choice(
			[
				['', 'None'],
				...store.nodes
					.filter((p) => isBox(p) && p.id !== ctx.n.id && !descendant(p.id, ctx.n.id))
					.map((p) => [p.id, show(p.title) || p.id]),
				...(ctx.n.kind === 'label'
					? [
							...store.edges.map((e, i) => ['arrow:' + i, 'Arrow ' + (i + 1)]),
							...store.groups.map((g) => ['frame:' + g.id, 'Frame ' + g.id]),
						]
					: []),
			],
			ctx.n.attachment?.parent || '',
			(id) =>
				id.startsWith('arrow:')
					? post({
							op: 'attachLabel',
							id: ctx.n.id,
							index: +id.slice(6),
							style: projectLabel(store.edges[+id.slice(6)], ctx.n),
						})
					: id.startsWith('frame:')
						? post({ op: 'attachLabel', id: ctx.n.id, group: id.slice(6) })
						: attach(id ? attachmentFor(ctx.n, byId(id), 'center') : null),
		),
	);
	if (ctx.n.attachment) {
		const a = ctx.n.attachment;
		ctx.row(
			'Parent anchor',
			anchorPicker(a.anchor, (anchor) => attach({ ...a, anchor })),
		);
		ctx.row(
			'Own anchor',
			anchorPicker(a.ownAnchor, (ownAnchor) => attach({ ...a, ownAnchor })),
		);
		ctx.row(
			'Offset X',
			ctx.field(a.dx, (v) => attach({ ...a, dx: +v }), { type: 'number' }),
			unit('mm'),
		);
		ctx.row(
			'Offset Y',
			ctx.field(a.dy, (v) => attach({ ...a, dy: +v }), { type: 'number' }),
			unit('mm'),
		);
		const detach = document.createElement('button');
		detach.textContent = 'Detach';
		detach.onclick = () => attach(null);
		ctx.row('', detach);
	}
	if (ctx.n.kind === 'label') {
		const frame = document.createElement('input');
		frame.type = 'checkbox';
		frame.setAttribute('aria-label', 'Thin frame');
		frame.checked = !!ctx.n.style?.border && ctx.n.style.border !== 'none';
		frame.onchange = () =>
			post({ op: 'style', ids: [ctx.n.id], style: { border: frame.checked ? 'solid' : 'none', weight: 'thin' } });
		ctx.row('Thin frame', frame);
		if (ctx.n.attachment) {
			ctx.row(
				'Placement',
				ctx.choice(
					[
						['', 'Choose…'],
						...ANCHORS.map((a) => ['inside:' + a, 'Inside ' + a]),
						...ANCHORS.filter((a) => a !== 'center').map((a) => ['outside:' + a, 'Outside ' + a]),
					],
					'',
					(v) => {
						if (!v) {
							return;
						}
						const [mode, anchor] = v.split(':'),
							opposite = {
								'north west': 'south east',
								north: 'south',
								'north east': 'south west',
								west: 'east',
								center: 'center',
								east: 'west',
								'south west': 'north east',
								south: 'north',
								'south east': 'north west',
							};
						const sign = mode === 'inside' ? -1 : 1;
						attach({
							...ctx.n.attachment,
							anchor,
							ownAnchor: mode === 'inside' ? anchor : opposite[anchor],
							dx: anchor.includes('west') ? -sign * 1.5 : anchor.includes('east') ? sign * 1.5 : 0,
							dy: anchor.includes('north') ? sign * 1.5 : anchor.includes('south') ? -sign * 1.5 : 0,
						});
					},
				),
			);
		}
	}
	ctx.row(
		'Width',
		ctx.field(ctx.n.wantWidth ?? ctx.n.width, (v) => post({ op: 'node', id: ctx.n.id, width: +v }), {
			type: 'number',
		}),
		unit('mm'),
	);
	ctx.row(
		'Height',
		ctx.field(r1(layout(ctx.n).h), (v) => post({ op: 'node', id: ctx.n.id, minh: +v }), { type: 'number' }),
		unit('mm'),
	);
}
export function inspGroup(ctx) {
	ctx.section('Group');
	ctx.row(
		'Name',
		ctx.field(ctx.group.name, (name) => post({ op: 'groupProps', id: ctx.group.id, name })),
	);
	const prop = (values) => post({ op: 'groupProps', id: ctx.group.id, ...values });
	ctx.row(
		'Padding',
		numberControl(
			ctx.group.padding || (ctx.group.frame === 'dashed' ? 2.8 : ctx.group.frame === 'dotted' ? 1.8 : 3),
			(v) => prop({ padding: v || 0 }),
			{ step: 0.5 },
		),
		unit('mm'),
	);
	ctx.section('Fill');
	ctx.row(
		'Fill',
		ctx.choice(
			[
				['none', 'None'],
				['tint', 'Tint'],
			],
			ctx.group.fill || (ctx.group.frame === 'region' ? 'tint' : 'none'),
			(fill) => prop({ fill }),
		),
	);
	ctx.row(
		'Colour',
		styleColour('color', ctx.group.color, (v) => prop({ color: v.color || 'grey' })),
	);
	ctx.row(
		'Strength',
		numberControl(ctx.group.fillStrength ?? 30, (v) => prop({ fillStrength: Math.min(100, v ?? 30) }), { step: 5 }),
		unit('%'),
	);
	ctx.section('Outline');
	ctx.row(
		'Line',
		ctx.choice(
			['none', 'solid', 'dashed', 'dotted'].map((v) => [v, v]),
			ctx.group.outline || (['region', 'none'].includes(ctx.group.frame) ? 'none' : ctx.group.frame),
			(outline) => prop({ outline, frame: ctx.group.frame === 'none' ? 'solid' : ctx.group.frame }),
		),
	);
	ctx.row(
		'Colour',
		styleColour('color', ctx.group.frameColor || '', (v) => prop({ frameColor: v.color })),
	);
	ctx.row(
		'Line width',
		numberControl(
			ctx.group.lineWidth || (ctx.group.frame === 'dotted' ? 1.5 : 0.7),
			(v) => prop({ lineWidth: v || 0 }),
			{
				min: 0.05,
			},
		),
		unit('pt'),
	);
	ctx.row(
		'Title at',
		ctx.choice(
			[
				['above-left', 'Above left'],
				['above-center', 'Above centre'],
				['inside-top-left', 'Inside top left'],
				['inside-top-right', 'Inside top right'],
				['below-left', 'Below left'],
				['legacy', 'Original placement'],
			],
			ctx.group.titlePosition || 'legacy',
			(titlePosition) => prop({ titlePosition }),
		),
	);
	ctx.row(
		'Bold title',
		emphasisToggle('bold', !!ctx.group.titleBold, (titleBold) => prop({ titleBold })),
	);
	ctx.row(
		'Title size',
		ctx.choice(
			Object.keys(sizes).map((v) => [v, v]),
			ctx.group.titleFont || 'scriptsize',
			(titleFont) => prop({ titleFont }),
		),
	);
	ctx.row(
		'Title colour',
		styleColour('textColor', ctx.group.titleColor || '', (v) => prop({ titleColor: v.textColor })),
	);
}
