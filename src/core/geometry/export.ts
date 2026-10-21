// A cheap common estimate for adaptive paste and the export readout, including paths and labels.
import { mm, sizes, smaller } from '../text';
import type { FigureGeometry } from './figure-geometry';
export function naturalWidth(geo: FigureGeometry): number {
	const spans = geo
		.objects()
		.filter((o) => !o.hidden)
		.map((o) => [o.x - o.w / 2, o.x + o.w / 2]);
	const hidden = (id: string) => geo.objects().find((o) => o.id === id)?.hidden;
	for (const e of geo.input.edges) {
		if (e.hidden || hidden(e.from) || hidden(e.to)) continue;
		const g = geo.edge(e);
		for (const p of g?.pts || []) spans.push([p[0], p[0]]);
		for (const l of [{ text: e.label, style: e.labelStyle }, ...(e.labels || [])]) {
			if (!l.text || l.style?.hidden) continue;
			const b = geo.label(e, l.style || {}, l.text);
			if (b) spans.push([b.p[0] - b.w / 2, b.p[0] + b.w / 2]);
		}
	}
	const left = spans.length ? Math.min(...spans.map((s) => s[0])) : 0;
	geo.input.categories
		.filter((c) => c.legend)
		.forEach((c, i) => {
			const x = left + Math.floor(i / 3) * 34;
			spans.push([x, x + 4.6 + mm(c.name, sizes[smaller(geo.font)] || 9)]);
		});
	return spans.length
		? Math.max(1, Math.max(...spans.map((s) => s[1])) - Math.min(...spans.map((s) => s[0])) + 0.3)
		: 1;
}
