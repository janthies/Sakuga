// Option codecs: each owns some appearance properties and knows how to write them as TikZ options and read them back.
// The order of CODECS is the order options are written in (byte identity with the files already in the wild);
// reading tries the codecs in the same order, so a codec that could mistake another one's option steps aside.
import type { EmitCtx, OptionCodec, ReadCtx, Target } from './option-types';
import { ObjectStyle } from '../model/figure';
import { fillCodecs } from './opt-fill';
import { strokeCodecs } from './opt-stroke';

export const CODECS: OptionCodec[] = [...fillCodecs, ...strokeCodecs];

export function emitOptions(st: ObjectStyle = {}, c: Partial<EmitCtx> = {}): string[] {
	const ctx: EmitCtx = { arrow: false, height: 6.16, ...c },
		target: Target = ctx.arrow ? 'arrow' : 'node';
	return CODECS.filter((k) => k.kinds.includes(target)).flatMap((k) => k.emit(st, ctx));
}

export function readOptions(options: string[], arrow = false, styled = false): { style: ObjectStyle; extra: string[] } {
	const style: ObjectStyle = {},
		extra: string[] = [],
		ctx: ReadCtx = { arrow, styled };
	for (const o of options) {
		if (!CODECS.some((k) => k.read(o, style, ctx))) {
			extra.push(o);
		}
	}
	for (const k of CODECS) {
		k.finish?.(options, style);
	}
	return { style, extra };
}

export type { EmitCtx, OptionCodec, ReadCtx, Target };
