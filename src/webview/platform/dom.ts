// 100 % zoom = true size on screen

// The elements of webview.html. They exist before main.js runs, so the lookups are asserted, not checked.
const el = <T extends Element>(id: string) => document.getElementById(id) as unknown as T;
export const svg = el<SVGSVGElement>('canvas');
export const inspector = el<HTMLElement>('inspector');
export const input = el<HTMLInputElement>('edit');
export const src = el<HTMLTextAreaElement>('src');
export const etools = el<HTMLElement>('etools');
// ---- layout v2: tabs, drawer, splitter ----
export const $ = (id: string) => el<HTMLElement>(id);
export const isTyping = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '');
