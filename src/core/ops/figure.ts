// Operations on the figure as a whole.
import { FONT_SIZES } from '../model/constants';
import { Figure } from '../model/figure';
import { insert } from '../model/lines';
import { nodes } from '../model/queries';
import type { FigureOp, Run } from './types';

export function applyFigure(fig: Figure, op: FigureOp, run: Run): void {
	switch (op.op) {
		case 'sheet': {
			if (!Number.isFinite(op.width) || op.width < 50 || op.width > 400) break;
			fig.lines = fig.lines.filter((l) => !(l.t === 'raw' && /^%\s*sakuga sheet\s+/.test(l.text)));
			if (op.width !== 146) fig.lines.unshift({ t: 'raw', text: `% sakuga sheet ${op.width}` });
			break;
		}
		case 'font':
			if (FONT_SIZES.includes(op.size)) {
				fig.lines = fig.lines.filter((l) => !(l.t === 'raw' && /^% sakuga font /.test(l.text)));
				fig.lines.unshift({ t: 'raw', text: `% sakuga font ${op.size}` });
			}
			break;
		case 'arrows': {
			const f = fig.lines.find((l) => l.t === 'arrowsflag');
			if (f && f.t === 'arrowsflag') {
				f.style = op.style;
			} else {
				insert(fig, { t: 'arrowsflag', style: op.style });
			}
			break;
		}
		case 'legend': {
			const f = fig.lines.find((l) => l.t === 'legendflag');
			if (f && f.t === 'legendflag') {
				f.on = op.on;
			} else {
				insert(fig, { t: 'legendflag', on: op.on });
			}
			break;
		}
	}
}
