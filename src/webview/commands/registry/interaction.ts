import type { Command } from './types';

export const interactionCommands: Command[] = [
	['canvas.wheel', 'Create an item'],
	['create.shape', 'Box'],
	['create.text', 'Label'],
	['create.icon', 'Icon'],
	['create.line', 'Line'],
	['selection.hide', 'Hide'],
	['selection.lock', 'Lock'],
	['selection.setCategory', 'Category'],
	['selection.detach', 'Detach from parent'],
	['selection.resetLook', 'Reset look'],
	['selection.applyLook', 'Apply look to category'],
	['selection.toLayer', 'Move to layer'],
	['selection.forward', 'Bring forward'],
	['selection.backward', 'Send backward'],
	['selection.back', 'Send to back'],
	['layer.select', 'Select layer items'],
].map(([id, title]) => ({ id, title, when: () => true, run: (s, args) => s.interaction?.(id, args) }));
