# Icons

Click an icon button to open the floating picker. All 163 previews are grouped by
catalogue category. Type to filter names or groups, use the arrow keys to move,
Enter to choose, and Escape to close. The first entry clears the icon. The grid
scrolls within 60% of the window height; hover a preview to see its name.

Select a box and use **Position** to put its icon left of the title, above it,
right of it, or in any corner. These controls also work with several boxes
selected. **Category icon** follows the current category's symbol.

In **Categories**, the icon button chooses the legend symbol. The checkbox next
to it enables that symbol in every box of the category, including future boxes.
Choosing **No icon** on a box overrides that default. Category menus show each
category's colour and symbol; category colour menus show swatches.

Use **Add icon** in the top bar to place an independent icon at the centre of the
canvas. Drag to move, use its handles or Width/Height to resize, and set its Label
in the inspector (or double-click). Free icons also support selection, copy,
paste, duplication, grouping and layers.

Box icon choices and positions are stored as TikZ options. A generated block
beside each box draws its icon; these blocks follow the layer order. Independent
icons have their own `\pic` line, including dimensions and label. The generated
theme includes only the icon definitions needed by the figure. Legacy inline
`\sgicon` titles remain readable.

Verification:

```sh
node --check media/editor.js
npm run compile
node scripts/check-icon-picker.cjs
node scripts/check-icons.cjs
node scripts/check-layers.cjs
node scripts/check-styling.cjs
```

The picker checks run in a DOM harness. The figure checks use
`nice -n 19 lualatex`, assert an identical serialize/parse round trip, and compare
PDF box heights against the canvas dimensions for all seven positions. Each
figure check prints the temporary directory containing its TikZ, TeX and PDF.
