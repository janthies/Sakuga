import type { KeyInfo } from './types';

// A key pattern is `ctrl+alt+shift+key` in any order. ctrl and alt must be down when listed and up when not. shift must be
// down when listed, up as `-shift`, and is ignored when absent. The key is compared with ev.key in lower case, or with
// ev.code as `code:KeyC`; `char` is any single printable character.
export function matchKey(pattern: string, k: KeyInfo): boolean {
	const parts = pattern.split('+');
	const key = parts.pop() as string;
	const has = (m: string) => parts.includes(m);
	if (has('ctrl') !== k.ctrl || has('alt') !== k.alt) return false;
	if (has('shift') && !k.shift) return false;
	if (has('-shift') && k.shift) return false;
	if (key === 'char') return Array.from(k.key).length === 1;
	if (key.startsWith('code:')) return k.code === key.slice(5);
	return k.key.toLowerCase() === key;
}

const NAMES: Record<string, string> = {
	delete: 'Del',
	escape: 'Esc',
	arrowleft: '←',
	arrowright: '→',
	arrowup: '↑',
	arrowdown: '↓',
};
// The pattern as the help table shows it: `ctrl+alt+c` becomes `Ctrl+Alt+C`.
export function formatKey(pattern: string): string {
	const parts = pattern.split('+').filter((p) => !p.startsWith('-'));
	const key = (parts.pop() as string).replace(/^code:(Key|Digit)?/, '');
	const name = NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1));
	return [...parts.map((p) => p[0].toUpperCase() + p.slice(1)), name].join('+');
}
