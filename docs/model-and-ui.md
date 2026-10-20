# Sakuga: object model, look model and UI

Design of 2026-10-20, revised the same day after Jan's feedback on the round 2 build. Replaces the per-kind named styles and the ad-hoc parent notions (groups, attachments, labels) with one tree and one look cascade, and lays the UI out so that every setting sits where one expects it. Implementation rounds are listed at the end.

## 1 Object model: one tree

```
Figure
└─ Layer            ordered; visible, locked, opacity
   └─ Item          top-level items of the layer
      └─ Item       children (rules below)
```

**Item kinds**

| Kind | What it is | Its rectangle |
|---|---|---|
| Shape | a box or node: rectangle, rounded, pill, circle, ellipse, diamond, triangle, cylinder | set by the user (width) and by its content (height, minimum width) |
| Frame | a group: pure structure, it draws nothing (no outline, no fill, no label). Its members are selected, moved, hidden and locked together | the union of its members; never drawn |
| Text | a piece of text (free, or the label of something) | from its content |
| Icon | a symbol from the icon set | fixed size |
| Line | a free straight line, e.g. the NSW / SW boundary | two end points |
| Connector | an arrow between two items | routed between its end points |

**Names in the UI.** The UI uses the words Jan uses, everywhere (inspector header, wheel, layers tree, menus): Shape = **Box**, Frame = **Group**, Text = **Label**, Connector = **Arrow**, Line = **Line**, Icon = **Icon**. The text of a box, an arrow or a line is its **Label**; the word "title" does not appear in the UI. Code keeps the kind names of this document.

**Groups draw nothing.** Grouping only says "these belong together". Jan: "Just because I group objects they should not get an outline, a tint and a title. If I want that, I put a box behind them as background and set a label relative to that box." A trust boundary or a coloured region is therefore an ordinary Box behind the members (outline dashed or none, fill or none), sent to the back, with its Label attached at an anchor (for example top left inside). Put the box into the group as well if it should move with the members. When a figure is opened, every frame that draws something today (outline, fill or title) is migrated to: a group without any look, containing a new background Box with the frame's outline, fill and current rectangle at the bottom of the group, the frame's title as that box's Label at the same position, and the old members. The figure looks the same afterwards.

**Who may be a child of whom**

| Parent | Allowed children | Meaning of the relation |
|---|---|---|
| Layer | every kind | membership and drawing order |
| Frame (Group): the empty parent | every kind | member: free position; moving, hiding or locking the group does it to all members |
| Shape (Box, any basic shape: rectangle, rounded, pill, circle, ellipse, diamond, triangle, cylinder): the visible parent | every kind: Box, Group, Label, Icon, Line | attached: placed relative to the box by an anchor (3×3 inside, or above/below/left/right outside) plus an offset; moves, hides and locks with the box |
| Connector | Text | label along the path: position 0–1, side, offset |
| Line | Text | label at one side or end of the line |
| Text, Icon | — | leaves |

So there are two parents: the **Box** (visible, children placed relative to it) and the **Group** (empty, children placed freely). Both can be nested in each other to any depth: a group of boxes inside a box, a box with a label and an icon inside a group, and so on. Connectors are never placed by hand (rule 3).

Rules:
1. Every item has exactly one parent. Children move with their parent and are deleted with it. Ungroup (Ctrl+Shift+G) removes one level of structure: on a group it dissolves the group (its members move up one level); on any other child it detaches that child (it moves up one level and keeps its place on the canvas).
2. A Shape's own text is its first Text child, its **label**. It may carry a monospace **code line**. Further texts are ordinary children (notes, captions). A Frame has a name for the layers tree only; it shows nothing on the canvas.
3. A Connector references its two end items (Shape, Frame or Line) by id plus a **port** (side and position 0–1 along it, or the centre for "auto"). It is not a child of either end; it lives in the deepest Frame that contains both ends, otherwise in the layer of its source. This placement is automatic.
4. An item's layer is the layer of its top-level ancestor. Children cannot sit in another layer.
5. Hidden or locked state applies to an item and its whole subtree. Every item can be hidden, groups and single objects alike: a hidden item is not drawn on the canvas and not in the pasted TikZ (its line stays in the source, commented as `% sakuga hidden`), and arrows to it are hidden too.

## 2 Look model: Theme → Category → Item

Every visual property of an item is resolved in this order, later wins:

1. **Theme**: the look and feel of the whole figure. For each kind it sets the base values (corner radius, line widths, outline grey, font, paddings, arrow tips, …), plus the **palette** (named colours) and the figure font size. There is one theme per figure; the default is the Sakuga house theme, and only differences from it are stored. Later the theme can be exported as a `.sty` and shared between figures.
2. **Category**: the meaning of an item ("this work", "TEE", "attacker"). A category has
   - a name;
   - a **marker**: either a colour from the palette or an icon, never both;
   - a **Fill** and an **Outline** (outline colour plus style solid/dashed/dotted). They are two separate settings. With a colour marker they default to the pale and the darker shade of that colour; with an icon marker they default to no fill and the theme outline. Each can be changed on its own;
   - a **legend** flag. Legend membership is a category property only; an item has no "in legend" switch of its own.

   A category has no text or font settings: the look of labels comes from the theme and from the label itself. With an icon marker, the category's boxes carry the icon (inside, top left, by default), and the category list and the legend show the icon, not a colour. Any kind can have a category, and each kind uses it in its own way:

   | Kind | What the category sets |
   |---|---|
   | Shape | fill and outline (and the icon, for an icon marker) |
   | Frame | nothing; a group has no category |
   | Connector, Line | the stroke, in the outline colour |
   | Text, Icon | the colour, in the outline colour |

   Text children without their own category inherit the category of their parent. Deleting a category asks for confirmation; its items keep their look as their own values and lose the category.
3. **Item**: the item's own values, its overrides. They are the exception, not the rule.

Consequences:
- Changing the colour of one item never removes its category; the item keeps its meaning and its legend entry.
- Every property has exactly one place where it is set: the theme row, the category, or the item row with an override marker. The inspector shows which.
- The named per-kind styles are dropped. Box styles become categories; arrow and frame styles become theme values or item overrides. Existing figures are migrated without changing their look (except group fills, see section 1).
- The legend lists exactly the categories with the legend flag. Its marker is the category's marker: the icon or the colour swatch, never both.

## 3 How it maps to TikZ

- Theme: base styles `sg shape`, `sg frame`, `sg conn`, `sg text`, `sg line`, plus `\definecolor` for the palette, in the generated theme block. Only differences from the house theme are written into the header as `% sakuga theme <kind>.<prop>=<value>`.
- Category: one style per used kind, e.g. `cat-tee-shape` and `cat-tee-conn`, plus a header line `% sakuga category tee {TEE} color=green|icon=<name> [fill=…] [outline=…] [legend]`.
- Item: `\node[sg shape, cat-tee-shape, <overrides>, sg in=<frame>, sg layer=<layer>] (id) at (x,y) {Label\\[-1pt]\sgcode{code}};`. Parenthood uses `sg in=<frame>` for group members and today's attachment form for children of shapes. A group writes no drawing, only the comment line the codec needs to restore it. Connectors are `\draw[sg conn, …] (a.<port>) … (b.<port>) node[sg label, pos=…] {…};`, and lines are `\draw[sg line, …] (x1,y1) -- (x2,y2) node[…] {NSW} node[…] {SW};`.
- The key order in each line expresses the cascade: theme style, then category style, then overrides.
- Figure environment: `% sakuga figure place=t label=fig:… caption={…}` (section 4, Drawer).

## 4 UI: everything where one expects it

| Where | What is found there |
|---|---|
| Canvas | the figure on **white**, in every VS Code theme. Creating things happens here and nowhere else. |
| Inspector (right, top) | properties of the selection; with nothing selected, the figure (figure settings, categories) |
| Layers (right, bottom) | the structure: the tree of section 1 |
| Drawer (left, ☰) | three parts, top to bottom: Preamble, Figure, TikZ (below) |
| Context menu (right click) | actions on the selection |
| Top bar | ☰, help (?), Preview, Export SVG. Nothing else. |

**Creating**
- A double click on empty canvas, or a tap of Ctrl alone, opens the wheel at the mouse. It offers Box (last used category), Label, Line and Icon. Grouping is Ctrl+G or the context menu, since a group is not something one draws.
- Tab adds a connected box to the right, Shift+Tab one below.
- Hovering a box shows small handles on its sides; dragging from a handle draws an arrow.

**Selecting**
- **Click:** selects the deepest item under the mouse, children included: an attached label, an icon on a box, a box attached to a box, a box inside a group. Dragging it moves only that item: an attached child changes its offset to its parent, a group member moves alone. The one exception is a box's own label inside the box: it is part of the box, so a click there selects the box (a double click edits the text). A group has no area of its own on the canvas: it is selected by Escape from a member or by its row in the layers tree.
- **Parent and child together:** select both, with a band or Shift click, or select the parent (children always move with their parent). A child whose parent is also selected moves once, with the parent.
- **Escape** selects the parent of the selected item; a second Escape clears the selection.
- **Selection stays:** pressing on an item that is already selected keeps the whole selection, so dragging moves all of it. A click without dragging narrows the selection to that item.
- **Adding to the selection:** Shift or Ctrl click toggles an item. A band selects the items inside it, and the connectors it touches.
- **Layer rows:** clicking a layer row selects all items of that layer.

**Building structure**
- **Group:** Ctrl+G groups the selection into a new group (in the deepest common parent). Ctrl+Shift+G ungroups or detaches (rule 1).
- **Make a child:** drag an item while holding Alt onto a box or a group: the target is highlighted, and on release the item becomes its child, staying where it was dropped (a box child gets the anchor nearest to the drop point plus the remaining offset). Alt-dragging a child out onto empty canvas detaches it. In the layers tree, dragging a row onto a box or group row does the same.
- **Place in parent:** an item whose parent is a box shows a "Place" row in the inspector, right under Content: the 3×3 grid plus the four outside positions, and the offset in More.
- **One selection:** canvas and layers tree show the same selection. Selecting on the canvas highlights the rows in the tree, opens their ancestors and scrolls the first one into view; selecting a row selects the item on the canvas.

**Inspector for a selection**
1. Header line: the kind and the name, e.g. "Box · Application", "Arrow · App → RTOS", "3 items".
2. Category: a dropdown with markers; "None" is allowed.
3. Content, per kind:
   - Shape: label, code line.
   - Text: text.
   - Connector: label, step number.
   - Frame: its name (layers tree only).
   - Line: the label on each side.
4. Look, at most four rows per kind:
   - Shape: fill, outline, shape.
   - Frame: none.
   - Connector: route, line, tips.
   - Text: size, colour, bold/italic.
   - Line: line, width.
5. **More**, the only disclosure, closed by default. It holds every other property as one flat list: position, size, text size, weight and colour, label position, pattern, corner mark, double border, opacity, numeric widths, tip size, lane. There is no "in legend" row.

A value inherited from the theme or the category is shown in grey; hovering it shows its source. A value set on the item is shown normally, with a small × to reset it. When an override is set, one action, "Apply to category" (or "Apply to theme" if the item has no category), appears next to it.

**Figure (nothing selected)**
- **Figure settings**: one disclosure, closed by default and remembered, holding every global setting as a flat list: export target (section 4a), font size (8–12 pt), the default arrow route, the palette (swatches; click one to edit it), grid size in mm (0 switches the grid and snapping off).
- **Categories**, always visible below it: one row each with marker (icon or swatch), name, use count, legend checkbox and, right of the checkbox, a small trash can that deletes the category after a confirmation. "New category" at the end. Clicking a row edits it in place: name, marker (colour or icon), Fill, Outline (colour and style), each on its own row.
- No other collapsibles.

**Layers tree**
- Rows follow section 1: Layer ▸ Group ▸ Box ▸ Label. Arrows are listed in their container with an arrow glyph.
- Every row, layer rows included, is built the same way from the left: indentation by depth, disclosure arrow (or an empty slot of the same width for leaves), kind icon or marker, name. A layer's arrow therefore sits at the same x as the arrows of top-level groups, not to the right of anything.
- Right-aligned on every row, in fixed columns: the count (layers and groups), then the eye, then the lock. They line up vertically across all rows.
- Dragging a row reorders it, or reparents it into a group, onto a box or into another layer. The drop target is highlighted.
- At the foot: + Layer, Duplicate, Merge down, Delete (it deletes whatever is selected).

**Context menu** (right click; the entries depend on what is under the mouse and offer what is useful there; each shows its shortcut):
- On an item: Edit label (Enter), Add label, Add icon, Category ▸, Group (Ctrl+G), Ungroup / Detach (Ctrl+Shift+G), Align ▸ and Distribute ▸ (relative to the parent when the item has one), Copy look, Paste look, Reset look, Apply look to category, Hide, Lock, Move to layer ▸, Bring forward, Send backward, Send to back, Delete.
- On empty canvas: Box, Label, Line, Icon (as in the wheel), Paste, Select all, Tidy up figure.

**Arrange commands** (align, distribute, same size, tidy up):
- **Relative to the parent:** when every selected item has the same parent box or group, align and distribute work inside that parent: one item is aligned to the parent's left, centre, right, top, middle or bottom (for a box parent this sets the anchor); several items are distributed across the parent and aligned to its edge or centre line. Without a common parent they work on the selection as today. The inspector's arrange row shows which reference applies ("in Application" or "to each other").
- They act only on an explicit command: menu, inspector row or key.
- Each is applied at once as one undo step.
- There is **no preview**, on hover or while a key is held. Nothing on the canvas moves unless the user asked for it.
- Afterwards no connector crosses a shape it does not end at.

**Drawer (☰)**
1. **Preamble**: a small fixed-height box with Copy, on top; tooltip "goes into the preamble of your document".
2. **Figure**: the figure environment to paste into the document: `\begin{figure}[<place>]` (`figure*` for a full-width target in a two-column paper), `\centering`, `\input{<path>}` of the TikZ file, `\caption{…}`, `\label{…}`. Caption, label and placement are edited right in this box and stored in the header line of section 3. Copy button.
3. **TikZ**: the Sakuga source, taking the rest of the height.

**Removed**:
- the + Box / + Label / + Icon buttons;
- the floating arrow toolbar and its "More" popover (the inspector has everything);
- the hover and hold previews of Tidy up;
- the empty style lists, and the per-item "in legend" switch;
- every look of groups: outline, fill ("tint") and title;
- section headers around single rows.

## 4a Figure size and preview

**Export target**, per figure, in Figure settings: Thesis 146 mm · Paper column 88 mm · Paper full width 180 mm · Custom (mm). The figure font follows the target (thesis `\small`, paper `\footnotesize`) and can be changed. Stored as `% sakuga export width=<mm> font=<name>` only when it differs from the defaults (VS Code settings `sakuga.export.width`, `sakuga.export.font`); the old `% sakuga sheet <mm>` line is read as the export width. The pasted TikZ adapts to `\linewidth` by itself, so the same paste works in the thesis and in a two-column paper (method and numbers: Sakuga-Research/work/export-size/export-size.md). The canvas stays infinite; the status bar shows "export 146 mm · text 10 pt", amber below 7 pt.

**Preview** (top bar): opens a page next to the editor showing the figure where it will end up: one page of lorem ipsum in a chosen venue, with the figure placed by its figure environment (caption and label included) at real size. Venues: Thesis (A4, 146 mm text width, 11 pt), Two-column paper (generic, 10 pt), and IEEE, LNCS, ACM with their real classes when TeX finds them (Debian/Ubuntu package texlive-publishers); a venue whose class is missing says so in its menu entry. The list is a VS Code setting, so another venue is a class line plus options. It compiles locally with LuaLaTeX through the host's TexRunner when the preview opens and on its Refresh button, never while one is editing.

## 5 Implementation rounds

1. **Model** (core): the tree of section 1, including the new Line kind and automatic connector placement; the ops reparent, detach and ungroup; codec and migration. Done.
2. **Look** (core): the cascade of section 2, with source information for every resolved value; migration of named styles; the legend marker rule. Done.
3. **Interaction** (webview): the selection rules, the wheel, the context menu, connector handles, Tab, and Shift+Enter in every text editor; arrange commands without preview and without crossings; the white canvas; the floating toolbar removed.
3b. **Look corrections and parents** (core): the child rules of section 1 (box and group as parents of every kind, nested to any depth), the reparent op with keep-in-place, ungroup/detach as one op; category marker colour XOR icon, Fill and Outline as separate category settings, no text settings in categories, legend only through categories, groups that draw nothing plus the background-box migration, hiding any item, category delete op; the figure header line (place, label, caption).
4. **Panels** (webview): the inspector of section 4 with sources and overrides and the Place row, the Figure inspector with its one Figure settings disclosure and the category rows, the drawer with its three parts, the top bar, the UI names.
4b. **Structure** (webview): the layers tree with its row layout, eye and lock per row and drag-to-reparent; one selection between canvas and tree; Alt-drag to make a child; Ctrl+G and Ctrl+Shift+G; the context menu by target; arrange relative to the parent.
5. **Figure size** (core + host + webview): the export target of section 4a.
6. **Preview** (host + webview): the venue page of section 4a.
