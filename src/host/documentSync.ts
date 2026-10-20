import type { DocumentPort } from './ports';

/** The smallest edit that turns `old` into `text`: replace [start, end) of `old` by `insert`. Null when equal. */
export function minDiff(old: string, text: string): { start: number; end: number; insert: string } | null {
	if (old === text) {
		return null;
	}
	let a = 0;
	while (a < old.length && a < text.length && old[a] === text[a]) {
		a++;
	}
	let b = 0;
	while (b < old.length - a && b < text.length - a && old[old.length - 1 - b] === text[text.length - 1 - b]) {
		b++;
	}
	return { start: a, end: old.length - b, insert: text.slice(a, text.length - b) };
}

// Replace only the part of the document that changed, so the text editor keeps its place.
export async function writeDocument(doc: DocumentPort, text: string): Promise<void> {
	const diff = minDiff(doc.text(), text);
	if (diff) {
		await doc.replace(diff.start, diff.end, diff.insert);
	}
}
