// @ts-nocheck
import { store } from '../store/store';
import { byId, catOf, post } from '../store/model';
import { darkerColor } from '../render/svg';
import { nextStyleName } from '../store/layers';
import { labelTarget } from '../render/labelgeom';
import { render } from '../render/scene';

// Style of a box: category, width and height; of an arrow: its line.
export function copyStyle() {
	if (store.selN.label) {
		store.styleClip = { labelStyle: { ...labelTarget().style } };
		render();
		return;
	}
	const ids = [...store.selN],
		ix = [...store.selE];
	const g = typeof store.groups !== 'undefined' && store.groups.find((g) => g.id === store.selG);
	if (g) {
		store.styleClip = {
			groupStyle: Object.fromEntries(
				[
					'frame',
					'fill',
					'fillStrength',
					'outline',
					'color',
					'frameColor',
					'padding',
					'lineWidth',
					'titlePosition',
					'titleBold',
					'titleFont',
					'titleColor',
				].map((k) => [k, g[k]]),
			),
			color: g.frameColor || g.color,
		};
		render();
		return;
	}
	store.styleClip = null;
	if (ids.length) {
		const n = byId(ids[0]);
		store.styleClip = {
			color:
				n.style?.color ||
				n.style?.textColor ||
				n.style?.fill ||
				(typeof catOf !== 'undefined' ? catOf(n.cat)?.color : ''),
			nodeStyle: { ...n.style },
			codeFont: n.codeFont || '',
			cat: n.cat,
			width: n.wantWidth ?? n.width,
			minh: n.minh,
			kind: store.styleClip && store.styleClip.kind,
		};
	}
	if (ix.length) {
		const e = store.edges[ix[0]];
		store.styleClip = {
			...(store.styleClip || {}),
			color: e.style?.color || '',
			edgeStyle: {
				...Object.fromEntries(Object.entries(e.style || {}).filter(([k]) => k !== 'step')),
				lineWidth: e.style?.lineWidth ?? ({ medium: 0.8, thick: 1.2 }[e.style?.weight] || 0.45),
			},
			lane: e.lane,
			kind: e.kind,
			route: e.route,
			head: e.head,
		};
	}
	render();
}
export function pasteStyle() {
	if (!store.styleClip) {
		return;
	}
	if (store.selN.label) {
		const st = store.styleClip.labelStyle || {};
		labelChange(Object.fromEntries(['font', 'bold', 'italic', 'color', 'background'].map((k) => [k, st[k] ?? null])));
		return;
	}
	const ops = [];
	const g = typeof store.groups !== 'undefined' && store.groups.find((g) => g.id === store.selG);
	if (g) {
		post({
			op: 'groupProps',
			id: g.id,
			...(store.styleClip.groupStyle
				? Object.fromEntries(
						Object.entries(store.styleClip.groupStyle).map(([k, v]) => [
							k,
							v ??
								{
									frame: 'dashed',
									fill: '',
									fillStrength: 30,
									outline: '',
									color: 'grey',
									titlePosition: 'legacy',
									titleBold: false,
								}[k] ??
								(k === 'lineWidth' || k === 'padding' ? 0 : ''),
						]),
					)
				: { frameColor: store.styleClip.color || '' }),
		});
		return;
	}
	if (!store.styleClip.nodeStyle && store.selN.size)
		ops.push({
			op: 'style',
			ids: [...store.selN],
			style: { color: store.styleClip.color || '', textColor: store.styleClip.color || '' },
		});
	if (!store.styleClip.edgeStyle && store.selE.size)
		ops.push({ op: 'style', indices: [...store.selE], style: { color: store.styleClip.color || '' } });
	if (store.styleClip.width !== undefined) {
		for (const id of store.selN) {
			ops.push({
				op: 'node',
				id,
				cat: store.styleClip.cat,
				width: store.styleClip.width,
				minh: store.styleClip.minh,
				codeFont: store.styleClip.codeFont,
			});
		}
	}
	if (store.styleClip.kind) {
		for (const i of store.selE) {
			ops.push({
				op: 'arrow',
				index: i,
				kind: store.styleClip.kind,
				route: store.styleClip.route,
				head: store.styleClip.head,
				lane: store.styleClip.lane ?? null,
			});
		}
	}
	if (store.styleClip.nodeStyle) {
		ops.push({
			op: 'style',
			ids: [...store.selN],
			style: {
				opacity: store.styleClip.nodeStyle.opacity ?? 1,
				...Object.fromEntries(
					[
						'shape',
						'fill',
						'border',
						'color',
						'weight',
						'text',
						'font',
						'pattern',
						'patternColor',
						'mark',
						'markCorner',
						'markSize',
						'markColor',
						'textColor',
					].map((k) => [k, store.styleClip.nodeStyle[k] || '']),
				),
			},
		});
	}
	if (store.styleClip.edgeStyle) {
		ops.push({
			op: 'style',
			indices: [...store.selE],
			style: {
				opacity: store.styleClip.edgeStyle.opacity ?? 1,
				...Object.fromEntries(
					['border', 'color', 'weight', 'position', 'side', 'start', 'end', 'lineWidth', 'tipLength', 'tipWidth'].map(
						(k) => [k, store.styleClip.edgeStyle[k] ?? { lineWidth: 0.45, tipLength: 1.5, tipWidth: 1.2 }[k] ?? ''],
					),
				),
			},
		});
	}
	if (ops.length) {
		post({ op: 'batch', ops });
	}
}
// A new style takes its look from an object (or is empty), then opens in the Styles list for naming.
export function addStyle(kind, from, assign) {
	const name = nextStyleName(kind),
		props = {};
	if (!from) {
		if (kind === 'box') {
			props.fill =
				Object.keys(store.palette).filter((k) => k !== 'white' && !store.cats.some((c) => c.color === k))[0] || 'grey';
		}
		if (kind === 'frame') {
			props.frame = 'dashed';
			props.color = 'grey';
		}
	}
	const colour = from ? byId(from.id)?.style?.fill : props.fill;
	store.pendingStyleFocus = name;
	post({
		op: 'styleAdd',
		kind,
		name,
		props,
		from,
		assign,
		legend: kind === 'box' && !!colour && colour !== 'white' && colour !== 'none',
	});
}
export function resetToAuto(indices = [...store.selE]) {
	post({ op: 'batch', ops: indices.map((index) => ({ op: 'arrow', index, resetAuto: true })) });
}
export function sourceColour(indices) {
	post({
		op: 'batch',
		ops: indices.map((i) => {
			const n = byId(store.edges[i].from),
				g = typeof store.groups !== 'undefined' && store.groups.find((g) => g.id === store.edges[i].from);
			return { op: 'style', indices: [i], style: { color: darkerColor(catOf(n?.cat)?.color || g?.color || 'grey') } };
		}),
	});
}
export function nextStep() {
	let n = 1;
	const used = new Set(store.edges.map((e) => e.style?.step));
	while (used.has(n)) n++;
	return n;
}
export function labelChange(style, ref = store.selN.label) {
	post({ op: 'label', ...ref, style });
}
