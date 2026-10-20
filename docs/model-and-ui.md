# Sakuga: object model, look model and UI

Design of 2026-10-20. Replaces the per-kind named styles and the ad-hoc parent notions (groups, attachments, labels) with one tree and one look cascade, and lays the UI out so that every setting sits where one expects it. Implementation rounds are listed at the end.

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
| Shape | a box or node: rectangle, rounded, pill, circle, ellipse, diamond, cylinder | set by the user (width) and by its content (height, minimum width) |
| Frame | a container: trust boundary, region, group | always fitted around its members plus padding, never sized by hand |
| Text | a piece of text (free, or the label of something) | from its content |
| Icon | a symbol from the icon set | fixed size |
| Line | a free straight line, e.g. the NSW / SW boundary | two end points |
| Connector | an arrow between two items | routed between its end points |

**Who may be a child of whom**

| Parent | Allowed children | Meaning of the relation |
|---|---|---|
| Layer | every kind | membership and drawing order |
| Frame | Shape, Frame, Text, Icon, Line, Connector | member: the frame grows around it; moving the frame moves its members |
| Shape | Text, Icon, Shape | attached: placed by an anchor (3×3 inside, or above/below/left/right outside) plus an offset |
| Connector | Text | label along the path: position 0–1, side, offset |
| Line | Text | label at one side or end of the line |
| Text, Icon | — | leaves |

Rules:
1. Every item has exactly one parent. Children move with their parent and are deleted with it; "Ungroup" on a frame is the one exception (members move up one level).
2. A Shape's own text is its first Text child, the **title**. It may carry a monospace **code line**. Further texts are ordinary children (notes, captions). A Frame's title is likewise its first Text child.
3. A Connector references its two end items (Shape, Frame or Line) by id plus a **port** (side and position 0–1 along it, or the centre for "auto"). It is not a child of either end; it lives in the deepest Frame that contains both ends, otherwise in the layer of its source. This placement is automatic.
4. An item's layer is the layer of its top-level ancestor. Children cannot sit in another layer.
5. Hidden or locked state applies to an item and its whole subtree.

## 2 Look model: Theme → Category → Item

Every visual property of an item is resolved in this order, later wins:

1. **Theme**: the look and feel of the whole figure. For each kind it sets the base values (corner radius, line widths, outline grey, font, paddings, arrow tips, …), plus the **palette** (named colours) and the figure font size. There is one theme per figure; the default is the Sakuga house theme, and only differences from it are stored. Later the theme can be exported as a `.sty` and shared between figures.
2. **Category**: the meaning of an item ("this work", "TEE", "attacker"). A category has a name, a colour from the palette, optionally an icon, optionally an outline style and an emphasis, and a legend flag. Any kind can have a category, and each kind uses the colour in its own way:

   | Kind | Category colour becomes |
   |---|---|
   | Shape | the pale fill |
   | Frame | a tint plus a darker outline and title colour |
   | Connector, Line | the stroke, in a darker shade |
   | Text, Icon | the colour, in a darker shade |

   Text children without their own category inherit the category of their parent.
3. **Item**: the item's own values, its overrides. They are the exception, not the rule.

Consequences:
- Changing the colour of one item never removes its category; the item keeps its meaning and its legend entry.
- Every property has exactly one place where it is set: the theme row, the category, or the item row with an override marker. The inspector shows which.
- The named per-kind styles of today are dropped. Box styles become categories; arrow and frame styles become theme values or item overrides. Existing figures are migrated without changing their look.
- The legend lists the categories with the legend flag. Its marker is the icon if the category has one, otherwise the colour swatch, never both.

## 3 How it maps to TikZ

- Theme: base styles `sg shape`, `sg frame`, `sg conn`, `sg text`, `sg line`, plus `\definecolor` for the palette, in the generated theme block. Only differences from the house theme are written into the header as `% sakuga theme <kind>.<prop>=<value>`.
- Category: one style per used kind, e.g. `cat-tee-shape` and `cat-tee-conn`, plus a header line `% sakuga category tee {TEE} green [icon=…] [legend]`.
- Item: `\node[sg shape, cat-tee-shape, <overrides>, sg in=<frame>, sg layer=<layer>] (id) at (x,y) {Title\\[-1pt]\sgcode{code}};`. Parenthood uses `sg in=<frame>` for frame members and today's attachment form for children of shapes. Connectors are `\draw[sg conn, …] (a.<port>) … (b.<port>) node[sg label, pos=…] {…};`, and lines are `\draw[sg line, …] (x1,y1) -- (x2,y2) node[…] {NSW} node[…] {SW};`.
- The key order in each line expresses the cascade: theme style, then category style, then overrides.

## 4 UI: everything where one expects it

| Where | What is found there |
|---|---|
| Canvas | the figure on **white**, in every VS Code theme. Creating things happens here and nowhere else. |
| Inspector (right, top) | properties of the selection; with nothing selected, the figure (theme, categories, grid) |
| Layers (right, bottom) | the structure: the tree of section 1 |
| Drawer (left, ☰) | the Preamble as a small box on top, the TikZ source below |
| Context menu (right click) | actions on the selection |
| Top bar | ☰, help (?), Export SVG. Nothing else. |

**Creating**
- A double click on empty canvas, or a tap of Ctrl alone, opens the wheel at the mouse. It offers Shape (last used category), Text, Frame (around the selection), Line and Icon.
- Tab adds a connected shape to the right, Shift+Tab one below.
- Hovering a shape shows small handles on its sides; dragging from a handle draws a connector.

**Selecting**
- **Click:** selects the most specific Shape, Connector or Line under the mouse. A click on a frame's border, title or empty inside selects the Frame.
- **Children:** a second click on a child of the selected item (its title, an icon) selects that child. Escape goes up one level.
- **Selection stays:** pressing on an item that is already selected keeps the whole selection, so dragging moves all of it. A click without dragging narrows the selection to that item.
- **Adding to the selection:** Shift or Ctrl click toggles an item. A band selects the items inside it, and the connectors it touches.
- **Layer rows:** clicking a layer row selects all items of that layer.

**Inspector for a selection**
1. Header line: the kind and the name, e.g. "Shape · Application", "Connector · App → RTOS", "3 items".
2. Category: a dropdown with swatches; "None" is allowed.
3. Content, per kind:
   - Shape: title, code line.
   - Text: text.
   - Connector: label, step number.
   - Frame: title.
   - Line: the label on each side.
4. Look, at most four rows per kind:
   - Shape: fill, outline, shape.
   - Frame: fill, outline.
   - Connector: route, line, tips.
   - Text: size, colour, bold/italic.
   - Line: line, width.
5. **More**, the only disclosure, closed by default. It holds every other property as one flat list: position, size, text size, weight and colour, title position, pattern, corner mark, double border, opacity, numeric widths, tip size, label position, lane.

A value inherited from the theme or the category is shown in grey; hovering it shows its source. A value set on the item is shown normally, with a small × to reset it. When an override is set, one action, "Apply to category" (or "Apply to theme" if the item has no category), appears next to it.

**Figure (nothing selected)**
- Theme: font size (8–12 pt), the default connector route, the palette (swatches; click one to edit it).
- Categories: one row each with marker, name, use count and legend checkbox, plus "New category". Clicking a row edits it in place: colour, icon, outline, emphasis.
- Grid: size in mm and a snap toggle.
- There are no collapsible sections.

**Layers tree**
- Rows follow section 1: Layer ▸ Frame ▸ Shape ▸ Text. Connectors are listed in their container with an arrow glyph.
- Each row has an eye and a lock.
- Dragging a row reorders it, or reparents it into a frame, onto a shape or into another layer. The drop target is highlighted.
- At the foot: + Layer, Duplicate, Merge down, Delete (it deletes whatever is selected).

**Context menu**: Add text, Add icon, Frame selection (Ctrl+G), Ungroup, Detach from parent, Reset look, Apply look to category, Align ▸, Distribute ▸, Tidy up, Move to layer ▸, Bring forward, Send backward, Delete.

**Arrange commands** (align, distribute, same size, tidy up):
- They act only on an explicit command: menu, inspector row or key.
- Each is applied at once as one undo step.
- There is **no preview**, on hover or while a key is held. Nothing on the canvas moves unless the user asked for it.
- Afterwards no connector crosses a shape it does not end at.

**Removed**:
- the + Box / + Label / + Icon buttons;
- the floating arrow toolbar and its "More" popover (the inspector has everything);
- the hover and hold previews of Tidy up;
- the empty style lists;
- section headers around single rows.

## 5 Implementation rounds

1. **Model** (core): the tree of section 1, including the new Line kind and automatic connector placement; the ops reparent, detach and ungroup; codec and migration.
2. **Look** (core): the cascade of section 2, with source information for every resolved value; migration of named styles; the legend marker rule.
3. **Interaction** (webview): the selection rules, the wheel, the context menu, connector handles, Tab, and Shift+Enter in every text editor; arrange commands without preview and without crossings; the white canvas; the floating toolbar removed.
4. **Panels** (webview): the inspector of section 4 with sources and overrides, the Figure inspector, the layers tree with drag-to-reparent, the drawer order.
