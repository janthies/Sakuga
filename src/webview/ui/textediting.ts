// Single-line controls store TeX line breaks literally, so the caret remains usable.
export function initTextEditing() {
	document.addEventListener(
		'keydown',
		(e) => {
			const field = e.target;
			if (
				!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) ||
				field.id === 'src' ||
				(field instanceof HTMLInputElement && field.type !== 'text') ||
				field.placeholder.toLowerCase().includes('search')
			)
				return;
			if (e.isComposing || e.key !== 'Enter') return;
			if (e.shiftKey) {
				e.preventDefault();
				e.stopImmediatePropagation();
				const start = field.selectionStart ?? field.value.length,
					end = field.selectionEnd ?? start;
				field.setRangeText('\\\\', start, end, 'end');
				field.dispatchEvent(new Event('input', { bubbles: true }));
			} else if (field.id !== 'edit') {
				e.preventDefault();
				e.stopImmediatePropagation();
				field.dispatchEvent(new Event('change', { bubbles: true }));
				field.blur();
			}
		},
		true,
	);
}
