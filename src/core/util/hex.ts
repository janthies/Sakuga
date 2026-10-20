// Hex encoding of UTF-8 text without Node's Buffer, so the codec runs in the extension host and in the webview.
// TextEncoder/TextDecoder exist in Node and in browsers; tsconfig.core.json has neither DOM nor Node types.
declare const TextEncoder: new () => { encode(s: string): Uint8Array };
declare const TextDecoder: new () => { decode(b: Uint8Array): string };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toHex(text: string): string {
	let out = '';
	for (const b of encoder.encode(text)) out += b.toString(16).padStart(2, '0');
	return out;
}

export function fromHex(hex: string): string {
	const bytes: number[] = [];
	// Like Buffer.from(hex, 'hex'): stop at the first character pair that is not hex.
	for (let i = 0; i + 1 < hex.length; i += 2) {
		const pair = hex.slice(i, i + 2);
		if (!/^[0-9a-fA-F]{2}$/.test(pair)) break;
		bytes.push(parseInt(pair, 16));
	}
	return decoder.decode(new Uint8Array(bytes));
}
