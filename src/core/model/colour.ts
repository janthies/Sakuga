// Fill colours and the TeX names they map to.

// The figure file is TikZ. Sakuga understands one node or one arrow per line, category lines
// in the header and two generated blocks (theme and legend); every other line is kept as it is.

// Fill colours a category can take, in the look of Fig. 5.2 of the Masterarbeit.
export const PALETTE: Record<string, { name: string; hex: string; mix: number }> = {
	blue: { name: 'sgBlue', hex: 'BBCCEE', mix: 85 },
	green: { name: 'sgGreen', hex: 'CCDDAA', mix: 85 },
	peach: { name: 'sgPeach', hex: 'FFDDCC', mix: 100 },
	grey: { name: 'sgGrey', hex: 'DDDDDD', mix: 70 },
	yellow: { name: 'sgYellow', hex: 'EEEEBB', mix: 85 },
	cyan: { name: 'sgCyan', hex: 'CCEEFF', mix: 100 },
	red: { name: 'sgRed', hex: 'FFCCCC', mix: 100 },
	accent: { name: 'palRose', hex: 'CC6677', mix: 100 },
	black: { name: 'black', hex: '000000', mix: 100 },
	white: { name: 'white', hex: 'FFFFFF', mix: 100 },
};

export function darkerColor(color: string): string {
	const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : (PALETTE[color] || PALETTE.grey).hex;
	return (
		'#' +
		[0, 2, 4]
			.map((i) =>
				Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.6)
					.toString(16)
					.padStart(2, '0'),
			)
			.join('')
			.toUpperCase()
	);
}

// The colour a box style shows on screen: a hex colour as it is, a palette colour mixed with white.
export function cssFill(color: string | undefined): string {
	if (color && /^#[0-9a-f]{6}$/i.test(color)) return color;
	const p = color ? PALETTE[color] : undefined;
	if (!p) return '#ffffff';
	const k = p.mix / 100;
	const ch = (i: number) => Math.round(parseInt(p.hex.slice(i, i + 2), 16) * k + 255 * (1 - k));
	return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
}

export function fill(color: string): string {
	if (/^#[0-9a-f]{6}$/i.test(color)) {
		return 'sgc' + color.slice(1).toUpperCase();
	}
	if (color === 'black!25') {
		return color;
	}
	const p = PALETTE[color] ?? PALETTE.white;
	return p.mix === 100 ? p.name : `${p.name}!${p.mix}`;
}
