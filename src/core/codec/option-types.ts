// The shape of an option codec.
import { ObjectStyle } from '../model/figure';
import { PropKey } from '../schema';

export type Target = 'node' | 'arrow';

export interface EmitCtx {
	arrow: boolean;
	forceDefaults?: boolean;
	effective?: ObjectStyle;
	// Height of the box in mm, for pill corners.
	height: number;
	// The style defines a line width, so a thin box must say so to override it.
	thin?: boolean;
	// The style removes the border, so a solid box must draw it again.
	redraw?: boolean;
}

export interface ReadCtx {
	arrow: boolean;
	// The object uses a named style, whose definition may carry the defaults it omits.
	styled: boolean;
}

export interface OptionCodec {
	owns: PropKey[];
	// Which objects get these options written; reading looks at every option and guards itself.
	kinds: Target[];
	emit(p: ObjectStyle, c: EmitCtx): string[];
	// Takes the option into `p` and returns true, or returns false and leaves it to the next codec.
	read(opt: string, p: ObjectStyle, c: ReadCtx): boolean;
	// Corrections once all options are read (an explicit `sg` option wins over its TikZ twin).
	finish?(options: string[], p: ObjectStyle): void;
}
