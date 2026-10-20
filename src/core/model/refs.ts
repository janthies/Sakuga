// Reference to an arrow label (index, slot) or a frame title (group).
export type LabelRef = { group?: string; index?: number; slot?: number };
// A reference to something the user selected.
export type ObjectRef = { k: 'node'; id: string } | { k: 'edge'; index: number } | { k: 'group'; id: string };
