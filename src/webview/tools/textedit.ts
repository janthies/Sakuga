import type { CanvasEvent, EditTarget, KeyEvent, Step, Tool, ToolCtx } from './types';

// Editing a title or an arrow label in the text field. The dispatcher shows the field (`edit`); Enter and blur commit,
// Escape drops the change, a click on the canvas commits and then acts as a normal click.
export class TextEditTool implements Tool {
	overlay = undefined;
	constructor(
		private c: ToolCtx,
		readonly target: EditTarget,
	) {}
	open(text?: string): Step {
		return { edit: { open: this.target, text }, next: this, render: this.target.kind !== 'edge' };
	}
	down(e: CanvasEvent): Step {
		return { ...this.finish(true, e.text ?? ''), redispatch: true };
	}
	move(): Step {
		return { render: false };
	}
	up(): Step {
		return { render: false };
	}
	key(e: KeyEvent): Step {
		if (e.key === 'Enter' || e.key === 'blur') return this.finish(true, e.text ?? '');
		if (e.key === 'Escape') return this.finish(false, e.text ?? '');
		return { render: false };
	}
	finish(commit: boolean, text: string): Step {
		const c = this.c,
			t = this.target;
		const step: Step = { edit: 'close', next: undefined };
		if (t.kind === 'draft') {
			c.dropDraft(t.draft);
			const from = new Set<string>([t.draft.edge.from]);
			step.select = { ...c.sel(), nodes: from };
			if (commit || text.trim()) {
				t.draft.batch.ops[0].title = text
					.split(' / ')
					.map((s) => c.tex(s))
					.join('\\\\');
				step.pendingSelect = [t.id];
				step.commit = t.draft.batch;
			}
		} else if (t.kind === 'edge') {
			if (commit) step.commit = { op: 'arrow', index: t.index, label: c.tex(text) };
		} else if (commit) {
			step.commit = {
				op: 'batch',
				ops: [
					{
						op: 'node',
						id: t.id,
						title: text
							.split(' / ')
							.map((s) => c.tex(s))
							.join('\\\\'),
					},
				],
			};
		}
		return step;
	}
}
