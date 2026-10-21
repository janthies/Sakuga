import type { AttachedLabel, LabelStyle } from '../model/figure';
import { opts } from './lexer';
import { readColor } from './keys';

export function pathLabels(path: string): AttachedLabel[] {
	const labels: AttachedLabel[] = [];
	const re = /node\[([^\]]*)\]\s*\{/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(path))) {
		let d = 1,
			k = re.lastIndex;
		for (; k < path.length && d; k++) {
			let slash = 0;
			for (let j = k - 1; j >= 0 && path[j] === '\\'; j--) slash++;
			if (slash % 2) continue;
			if (path[k] === '{') d++;
			if (path[k] === '}') d--;
		}
		if (d) break;
		const st: LabelStyle = {};
		for (const o of opts(m[1])) {
			if (/^pos=/.test(o)) st.pos = +o.slice(4);
			if (o === 'near start') st.pos = 0.25;
			if (o === 'near end') st.pos = 0.75;
			if (/^(above|below|left|right)(?:=|$)/.test(o)) st.side = o.split('=')[0];
			const shift = /^shift=\{\((-?[\d.]+)(?:mm)?,(-?[\d.]+)(?:mm)?\)\}$/.exec(o);
			if (shift) {
				st.dx = +shift[1];
				st.dy = +shift[2];
			}
			if (o.startsWith('text=')) st.color = readColor(o.slice(5));
			if (o.startsWith('font=')) {
				st.font = /\\(tiny|scriptsize|footnotesize|small|normalsize|large)/.exec(o)?.[1];
				if (o.includes('\\bfseries')) st.bold = true;
				if (o.includes('\\itshape')) st.italic = true;
			}
			if (o === 'fill=white') st.background = true;
			if (o === 'fill=none') st.background = false;
		}
		labels.push({ text: path.slice(re.lastIndex, k - 1), ...(Object.keys(st).length ? { style: st } : {}) });
		re.lastIndex = k;
	}
	return labels;
}
