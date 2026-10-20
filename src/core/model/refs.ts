// A reference to something the user selected.
export type ObjectRef = { k: 'node'; id: string } | { k: 'edge'; index: number } | { k: 'group'; id: string };
