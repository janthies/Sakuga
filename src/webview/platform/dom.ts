// @ts-nocheck

// 100 % zoom = true size on screen

export const svg = document.getElementById('canvas');
export const inspector = document.getElementById('inspector');
export const input = document.getElementById('edit');
export const src = document.getElementById('src');
export const etools = document.getElementById('etools');
// ---- layout v2: tabs, drawer, splitter ----
export const $ = (id) => document.getElementById(id);
export const isTyping = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
