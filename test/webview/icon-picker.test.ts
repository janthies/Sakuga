import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Session } from '../lib/session';
import { figure } from '../lib/figure';
import { read } from '../lib/env';

// The icon panel and the visual style choice (ported from scripts/check-icon-picker.cjs).
const icons: { name: string; category: string; paths: unknown[] }[] = JSON.parse(read('icons/icons.json'));
const panel = (s: Session) => s.document.querySelector('.icon-panel');
const entries = (s: Session): any[] => [...panel(s).querySelectorAll('button')];
const entry = (s: Session, value: string) => entries(s).find((b) => b.dataset.value === value);
const search = (s: Session, q: string) => {
	const input = panel(s).querySelector('input');
	input.value = q;
	input.dispatchEvent(new s.window.Event('input'));
};

test('grouped previews, filtering, keyboard selection, clearing, dismissal and preview reuse', () => {
	const s = new Session(figure([['p', 0, 0, { icon: 'board' }]]));
	const toolbar = s.document.querySelector('#addIcon button.icon-picker');
	s.click(toolbar);
	assert.equal(panel(s).hidden, false);
	assert.equal(entries(s).length, icons.length + 1);
	assert.equal(entries(s)[0].textContent, 'No icon');
	assert.equal(panel(s).querySelectorAll('section').length, new Set(icons.map((i) => i.category)).size);
	assert.equal(entry(s, 'board').children[0].children.length, icons.find((i) => i.name === 'board')!.paths.length);
	const preview = entry(s, 'board');
	search(s, 'board');
	assert.equal(entry(s, 'board').hidden, false);
	assert.equal(entry(s, 'bus').hidden, true);
	// First filtered entry is No icon; ArrowRight moves to the matching preview.
	const press = (key: string) =>
		panel(s)
			.querySelector('input')
			.dispatchEvent(new s.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	press('ArrowRight');
	press('Enter');
	assert.equal(s.lastOp.icon, 'board');
	assert.equal(panel(s).hidden, true);
	s.click(toolbar);
	assert.equal(entry(s, 'board'), preview, 'Opening must reuse the rendered previews');
	s.key('Escape');
	assert.equal(panel(s).hidden, true);
	// Clearing from the inspector of a box that has an icon.
	s.down(0, 0, s.node('p'));
	s.up(0, 0);
	s.click(s.row('Icon').querySelector('button.icon-picker'));
	s.click(entries(s)[0]);
	assert.equal(s.lastOp.icon, 'none');
	s.click(toolbar);
	search(s, 'unlikely-no-matches');
	assert.equal(entries(s).filter((b) => !b.hidden).length, 1, 'No icon remains available for an empty result');
	s.pointer('pointerdown', 0, 0, s.document.body);
	assert.equal(panel(s).hidden, true);
});

test('visual style choice shows swatch and icon and picks by keyboard', () => {
	const s = new Session(figure([['p', 0, 0, { cat: 'work' }]], [], [{ op: 'styleEdit', key: 'work', icon: 'board' }]), {
		palette: { peach: { hex: 'FFDDCC', mix: 100 } },
	});
	s.down(0, 0, s.node('p'));
	s.up(0, 0);
	const choice = s.row('Style').querySelector('button.visual-choice');
	s.click(choice);
	assert.equal(choice.children[0].style.background, 'rgb(255, 221, 204)');
	assert.equal(choice.children[1].tagName.toLowerCase(), 'svg');
	const panelEl = s.document.querySelector('.choice-panel');
	s.document.activeElement.dispatchEvent(
		new s.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
	);
	assert.equal(s.document.activeElement.textContent, 'Plain');
	assert.ok(panelEl.contains(s.document.activeElement));
	s.click(s.document.activeElement);
	assert.equal(s.lastOp.ops[0].category, '');
});
