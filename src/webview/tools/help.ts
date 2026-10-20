// The gestures of the tools, as rows of the "?" table. `at` places them among the shortcut rows of the commands.
export const GESTURE_HELP: { at: number; keys: string; text: string }[] = [
	{ at: 0, keys: 'Double-click', text: 'new box, or edit title' },
	{ at: 1, keys: 'Drag the dot', text: 'arrow, or new connected box' },
	{ at: 2, keys: 'Drag on empty space', text: 'select with a rectangle' },
	{ at: 3, keys: 'Ctrl+click / Shift+click', text: 'toggle / add to selection; set alignment reference' },
	{ at: 5, keys: 'Shift+drag', text: 'move horizontally or vertically only' },
	{ at: 6, keys: 'Alt+drag', text: 'copy' },
	{ at: 17, keys: 'Shift+drag a corner', text: 'scale the selection evenly' },
	{ at: 18, keys: 'Ctrl after you start dragging', text: 'no grid, no guides' },
	{ at: 21, keys: 'Esc in a new empty box', text: 'cancel box and arrow' },
	{ at: 36, keys: 'Space+drag, middle mouse', text: 'pan' },
	{ at: 37, keys: 'Ctrl+wheel', text: 'zoom' },
];
