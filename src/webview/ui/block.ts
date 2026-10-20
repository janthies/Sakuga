import { Control } from './control';

// A piece of the inspector that is not a value: a list, a note, a block of buttons. It sits in a row like a control.
export class Block implements Control<never> {
	constructor(readonly el: HTMLElement) {}
	set(): void {}
	onCommit(): void {}
}
