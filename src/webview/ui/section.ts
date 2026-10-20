import { h } from './control';

// Where a section remembers whether it is open, per section id.
export interface SectionMemory {
	read(id: string): boolean | undefined;
	write(id: string, open: boolean): void;
}

// A collapsible group of rows. It stays in the layout even when empty, and hides itself instead.
export class Section {
	readonly el: HTMLDetailsElement;
	readonly body: HTMLDivElement;
	private readonly summary: HTMLElement;

	constructor(
		readonly id: string,
		title: string,
		collapsed: boolean,
		memory: SectionMemory,
	) {
		this.summary = h('summary', '', {}, title);
		this.body = h('div', 'section-body');
		this.el = h('details', 'inspector-section', {}, this.summary, this.body);
		this.el.open = memory.read(id) ?? !collapsed;
		this.el.ontoggle = () => memory.write(id, this.el.open);
	}

	set title(title: string) {
		this.summary.textContent = title;
	}

	// Hide the section when it has no rows.
	settle(): void {
		this.el.hidden = !this.body.children.length;
	}
}
