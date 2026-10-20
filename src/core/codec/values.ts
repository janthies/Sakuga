// Writing and reading one property value as a token, driven by the type the schema declares for the key.
import { cleanLabel } from '../styles/appearance';
import { PropDef, anyDef, isBooleanProp, isNumberProp } from '../schema';
import { fromHex, toHex } from '../util/hex';

export function readValue(key: string, text: string, structured = false): unknown {
	if (isNumberProp(key)) return +text;
	if (isBooleanProp(key)) return text === 'true';
	return structured && anyDef(key)?.type === 'json' ? JSON.parse(fromHex(text)) : text;
}

export function writeValue(def: Pick<PropDef, 'key' | 'type'>, value: any): string {
	return def.type === 'json' ? toHex(JSON.stringify(cleanLabel(value))) : String(value);
}
