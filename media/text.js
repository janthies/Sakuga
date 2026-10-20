// House-font advances measured from the shipped Open Sans and TeX Gyre Cursor.
// Shared by the webview and serializer: widths are TeX points converted to mm.
(function (root) {
	'use strict';
	const ADV = {
		sans: {
			upem: 2048,
			w: {
				' ': 532,
				'!': 547,
				'"': 821,
				'#': 1323,
				$: 1171,
				'%': 1686,
				'&': 1495,
				"'": 453,
				'(': 606,
				')': 606,
				'*': 1130,
				'+': 1171,
				',': 502,
				'-': 659,
				'.': 545,
				'/': 752,
				0: 1171,
				1: 1171,
				2: 1171,
				3: 1171,
				4: 1171,
				5: 1171,
				6: 1171,
				7: 1171,
				8: 1171,
				9: 1171,
				':': 545,
				';': 545,
				'<': 1171,
				'=': 1171,
				'>': 1171,
				'?': 879,
				'@': 1841,
				A: 1296,
				B: 1327,
				C: 1292,
				D: 1493,
				E: 1139,
				F: 1057,
				G: 1491,
				H: 1511,
				I: 571,
				J: 547,
				K: 1257,
				L: 1063,
				M: 1849,
				N: 1544,
				O: 1595,
				P: 1233,
				Q: 1595,
				R: 1266,
				S: 1124,
				T: 1133,
				U: 1491,
				V: 1219,
				W: 1896,
				X: 1182,
				Y: 1147,
				Z: 1169,
				'[': 674,
				'\\': 752,
				']': 674,
				'^': 1110,
				_: 918,
				'`': 1182,
				a: 1139,
				b: 1255,
				c: 975,
				d: 1255,
				e: 1149,
				f: 694,
				g: 1122,
				h: 1257,
				i: 518,
				j: 518,
				k: 1075,
				l: 518,
				m: 1905,
				n: 1257,
				o: 1237,
				p: 1255,
				q: 1255,
				r: 836,
				s: 977,
				t: 723,
				u: 1257,
				v: 1026,
				w: 1593,
				x: 1073,
				y: 1032,
				z: 958,
				'{': 776,
				'|': 1128,
				'}': 776,
				'~': 1171,
				'\u00a0': 532,
				'\u00b5': 1268,
				'\u2013': 1024,
				'\u2014': 2048,
				'\u00e4': 1139,
				'\u00f6': 1237,
				'\u00fc': 1257,
			},
		},
		mono: {
			upem: 1000,
			w: {
				' ': 600,
				'!': 600,
				'"': 600,
				'#': 600,
				$: 600,
				'%': 600,
				'&': 600,
				"'": 600,
				'(': 600,
				')': 600,
				'*': 600,
				'+': 600,
				',': 600,
				'-': 600,
				'.': 600,
				'/': 600,
				0: 600,
				1: 600,
				2: 600,
				3: 600,
				4: 600,
				5: 600,
				6: 600,
				7: 600,
				8: 600,
				9: 600,
				':': 600,
				';': 600,
				'<': 600,
				'=': 600,
				'>': 600,
				'?': 600,
				'@': 600,
				A: 600,
				B: 600,
				C: 600,
				D: 600,
				E: 600,
				F: 600,
				G: 600,
				H: 600,
				I: 600,
				J: 600,
				K: 600,
				L: 600,
				M: 600,
				N: 600,
				O: 600,
				P: 600,
				Q: 600,
				R: 600,
				S: 600,
				T: 600,
				U: 600,
				V: 600,
				W: 600,
				X: 600,
				Y: 600,
				Z: 600,
				'[': 600,
				'\\': 600,
				']': 600,
				'^': 600,
				_: 600,
				'`': 600,
				a: 600,
				b: 600,
				c: 600,
				d: 600,
				e: 600,
				f: 600,
				g: 600,
				h: 600,
				i: 600,
				j: 600,
				k: 600,
				l: 600,
				m: 600,
				n: 600,
				o: 600,
				p: 600,
				q: 600,
				r: 600,
				s: 600,
				t: 600,
				u: 600,
				v: 600,
				w: 600,
				x: 600,
				y: 600,
				z: 600,
				'{': 600,
				'|': 600,
				'}': 600,
				'~': 600,
				'\u00a0': 600,
				'\u00b5': 600,
				'\u2013': 600,
				'\u2014': 600,
				'\u00e4': 600,
				'\u00f6': 600,
				'\u00fc': 600,
			},
		},
	};
	const PT = 25.4 / 72.27,
		sizes = { tiny: 6, scriptsize: 8, footnotesize: 9, small: 10, normalsize: 10.95, large: 12 };
	const smaller = (s) =>
		({
			tiny: 'tiny',
			scriptsize: 'tiny',
			footnotesize: 'scriptsize',
			small: 'footnotesize',
			normalsize: 'small',
			large: 'normalsize',
		})[s] || 'footnotesize';
	const show = (s) =>
		(s || '')
			.replace(/\\\\\[[^\]]*\]/g, '\\\\')
			.replace(/\\([_&%#$])/g, '$1')
			.replace(/\\[a-zA-Z]+\*?/g, '')
			.replace(/[{}$^]/g, '')
			.replace(/ +/g, ' ');
	function mm(s, pt, family = 'sans') {
		const f = ADV[family];
		let w = 0;
		for (const c of s) w += f.w[c] ?? f.upem * 0.55;
		return (w / f.upem) * pt * PT;
	}
	const codeSize = (n, font = 'small') => n.codeFont || smaller(n.style?.font || font);
	function need(n, font = 'small') {
		const pt = sizes[n.style?.font || font] || 10,
			inset = n.icon && n.icon !== 'none' && ['left', 'right'].includes(n.iconPosition || 'left') ? 4 : 0;
		let value = n.code ? mm(show(n.code), sizes[codeSize(n, font)], 'mono') + inset : 0,
			content = show(n.code);
		for (const word of n.title
			.replace(/\\\\\[[^\]]*\]/g, '\\\\')
			.split('\\\\')
			.flatMap((part) => show(part).split(/\s+/))) {
			const w =
				mm(word, pt) + (n.icon && n.icon !== 'none' && ['left', 'right'].includes(n.iconPosition || 'left') ? 4 : 0);
			if (w > value) {
				value = w;
				content = word;
			}
		}
		return { width: value, content };
	}
	function actual(n, font = 'small') {
		if (n.kind) return n.width;
		return Math.max(n.wantWidth ?? n.width ?? 26, Math.ceil(need(n, font).width * 100) / 100);
	}
	function normalize(n, font = 'small') {
		if (n.kind) return;
		if (n.codeFont && !sizes[n.codeFont]) delete n.codeFont;
		if (n.wantWidth !== undefined && !(Number.isFinite(n.wantWidth) && n.wantWidth > 0)) delete n.wantWidth;
		const wanted = n.wantWidth ?? n.width ?? 26;
		n.width = actual(n, font);
		if (Math.abs(n.width - wanted) > 0.00001) n.wantWidth = wanted;
		else delete n.wantWidth;
		if (n.codeFont === smaller(n.style?.font || font)) delete n.codeFont;
	}
	function lines(n, font = 'small') {
		const out = [],
			pt = sizes[n.style?.font || font] || 10;
		for (const part of n.title.replace(/\\\\\[[^\]]*\]/g, '\\\\').split('\\\\')) {
			let line = '';
			for (const word of show(part).trim().split(/\s+/)) {
				const next = line ? line + ' ' + word : word;
				if (
					line &&
					mm(next, pt) + (n.icon && n.icon !== 'none' && ['left', 'right'].includes(n.iconPosition || 'left') ? 4 : 0) >
						n.width * 0.97
				) {
					out.push(line);
					line = word;
				} else line = next;
			}
			out.push(line);
		}
		return out;
	}
	function layout(n, font = 'small') {
		if (n.kind === 'icon') return { w: n.width, h: n.minh || n.width, lines: [] };
		const ls = lines(n, font),
			pt = sizes[n.style?.font || font] || 10,
			baseline = { 6: 7, 8: 9.5, 9: 11, 10: 12, 10.95: 13.6, 12: 14 }[pt];
		if (n.kind === 'label' && n.style?.compact)
			return {
				w: n.width + 2 * PT,
				h: Math.max(ls.length * pt * PT * 1.25, n.style?.step ? 3.6 : 0) + 2 * PT,
				lines: ls,
			};
		let w = n.width + 2.2675,
			h = Math.max(
				Math.max(6.16, (pt + 7.45 + (ls.length - 1) * baseline + (n.code ? baseline - 1 : 0)) * PT) +
					(n.icon && n.icon !== 'none' && !['left', 'right'].includes(n.iconPosition || 'left') ? 4 : 0),
				n.minh || 0,
			);
		if (n.style?.shape === 'circle') w = h = Math.hypot(w - 0.158, h - 0.158) + 0.158;
		if (n.style?.shape === 'ellipse') {
			w = (w - 0.158) * Math.SQRT2 + 0.158;
			h = (h - 0.158) * Math.SQRT2 + 0.158;
		}
		if (n.style?.shape === 'diamond') w = h = w + h - 0.183;
		if (n.style?.shape === 'cylinder') {
			const r = ((pt + 7 + (ls.length - 1) * baseline + (n.code ? baseline - 1 : 0)) * PT) / 2,
				c = Math.sqrt(1 - ((r - 3.5 * PT) / r) ** 2);
			w += r * (3 - c);
			h = r * 2 + 0.158;
		}
		return { w, h, lines: ls };
	}
	const api = { mm, show, sizes, smaller, codeSize, need, actual, normalize, lines, layout };
	if (typeof module === 'object' && module.exports) module.exports = api;
	else root.SakugaText = api;
})(typeof globalThis === 'object' ? globalThis : this);
