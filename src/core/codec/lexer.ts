// Line patterns and the option lexer of the figure dialect.

export const PIC =
	/^\s*\\pic\[(.*)\]\s*\(([\w-]+)\)\s*at\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*\{sg object=\{([\w-]*)\}\{([\d.]+)\}\{([\d.]+)\}\};\s*$/;

export const NODE =
	/^\s*\\node\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*\(([\w-]+)\)\s*at\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*\{(.*)\};\s*$/;

export const EDGE = /^\s*\\draw\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*(\(.*\));\s*$/;

export const ARROWSFLAG = /^%\s*sakuga arrows\s+(straight|manhattan|curved)\s*$/;

export const GROUP = /^%\s*sakuga group\s+([\w-]+)\s+\{([^}]*)\}\s+(\w+)\s+([#\w-]+)(?:\s+in=([\w-]+))?(.*)$/;

export const LAYER =
	/^%\s*sakuga layer\s+([\w-]+)\s+\{([^}]*)\}(?:\s+(hidden))?(?:\s+(locked))?(?:\s+opacity=([\d.]+))?\s*$/;

export const HIDDEN = /^%\s*sakuga hidden\s+(.*)$/;

export const CAT =
	/^%\s*sakuga category\s+([\w-]+)\s+\{([^}]*)\}\s+([#\w]+)(?:\s+icon=([\w-]+))?(?:\s+(boxes))?(?:\s+(no-legend))?\s*$/;

export const STYLE = /^%\s*sakuga style\s+(box|arrow|frame|label)\s+([\w-]+)\s+\{([^}]*)\}(.*)$/;

export const LEGENDFLAG = /^%\s*sakuga legend\s+(on|off)\s*$/;

export const CODE = /\\\\\[-1pt\]\\sgcode\{(.*)\}$/;

export function opts(s: string): string[] {
	const out: string[] = [];
	let start = 0,
		depth = 0;
	for (let i = 0; i < s.length; i++) {
		if (s[i - 1] === '\\') {
			continue;
		}
		if ('{['.includes(s[i])) {
			depth++;
		} else if ('}]'.includes(s[i])) {
			depth--;
		} else if (s[i] === ',' && depth === 0) {
			out.push(s.slice(start, i).trim());
			start = i + 1;
		}
	}
	out.push(s.slice(start).trim());
	return out.filter(Boolean);
}
