# Sketch controls

Select two or more boxes, labels or icons to reveal the compact layout controls
in the inspector. Selected arrows remain connected as their endpoints move.
Each command sends one existing `batch` operation, hence one document edit.

| Action | Key |
| --- | --- |
| Align left / horizontal centre / right | Alt+A / Alt+C / Alt+D |
| Align top / vertical centre / bottom | Alt+W / Alt+V / Alt+S |
| Distribute horizontal / vertical edge gaps | Alt+X / Alt+Y |
| Same width / height | Alt+U / Alt+B |
| Tidy up selection / whole figure if empty | Alt+T (hold to preview, release to apply) |
| Next connected box / box below | Tab / Shift+Tab |
| Edit existing title | Enter / F2 |

Shift+click adds a node and sets it as the alignment/size reference. Ctrl+click
adds or removes a node; adding sets the reference. This also works in the layer
list, where Shift retains range selection. Without a reference, alignment uses
the selection bounds and size matching uses the largest rendered dimension.
Fully selected groups, including nested groups, move as rigid units. Locked or
hidden nodes are excluded; a fully selected group with an unavailable member
cannot move. Distribution requires three independent units in the inspector and
uses gaps between edges, including negative gaps for overlapping selections.
Matching sizes uses existing shape geometry and respects intrinsic text/shape
minimums: a node that cannot shrink to the reference dimension is left as is.

Tab copies the category, width, minimum height, icon and object style of the
selected box. It continues the dominant horizontal/vertical direction from the
last incoming arrow, defaulting right. Shift+Tab always goes below. Spacing uses
the median nearest-neighbour edge gap across rows and columns of visible boxes,
falling back to 8 mm. Placement advances past occupied objects. The title and
code start empty. The box and arrow preview locally until Enter or blur accepts
the title; then one creation batch saves both. Escape cancels an empty draft
without touching the document or undo history. Escape with a nonempty draft
accepts it. Existing title edits still cancel on Escape.

Typing a printable character replaces a selected box/label title and starts
editing. Ctrl/Alt/Meta combinations, IME composition, Space (pan), D/R (arrow
shortcuts), category digits when assigned, and Shift+1 (fit) retain priority.
Enter/F2 starts editing the existing title instead. All shortcuts appear in `?`.

## Shortcut audit

Checked the installed Volute package and user keybindings. Avoided Alt+H/J/K/L,
Alt+Shift+H/J/K/L and Alt+Q. Inspected the installed VS Code workbench: Alt+C/W
have find-widget commands and Alt+A has an accessibility-view command, gated by
those contexts. Other chosen combinations have no matching plain-Alt workbench
binding in the inspected build. Menu mnemonics can also consume plain Alt keys.

To make dispatch explicit, `package.json` contributes a command for each layout
action with `activeCustomEditorId == sakuga.figure && webviewFocus`. The provider
forwards it to its active webview, whose normal typing/floating/editing guards
still apply. Canvas key handling also supports direct browser delivery. This
avoids relying solely on DOM `preventDefault()` to defeat host bindings.
Physical key delivery in a live VS Code session remains a manual smoke check;
no extension was installed or packaged for this task.

## Verification and attribution

Run `npm run compile`, `node --check media/editor.js`, and
`node scripts/check-sketch.cjs`. The regression script loads the shipped layout
module, applies real TikZ operations, exercises the actual key/edit/pointer
handlers, checks controls and their scoped bindings, and verifies draft creation
and cancellation. The existing `scripts/check-*.cjs` checks also run unchanged.

Bounding-box translation, rigid-group handling and gap accumulation were adapted
from Excalidraw's MIT `packages/element/src/align.ts` and `distribute.ts`.
The research's pinned revision could not be fetched; accessible upstream master
files were inspected instead. Notices are in `media/sketch.LICENSE.txt` (the code lives in `src/core/layout/sketch-*.ts`).

## Tidy up and content widths

The Arrange section offers **Tidy up** (or **Tidy up figure** without a selection).
Hover previews ghost outlines; clicking applies one batch, including neighbour pushes
and manual-route repairs. Alt+T previews while held and applies on release; Escape
or losing focus cancels. The command palette applies directly. Alt+T does not conflict
with the installed Volute extension or Sakuga's align/size keys.

Tidy preserves nesting and order. It cuts the drawing into rows and columns, uses
median positive figure gaps with a 4 mm minimum (8 mm across labelled arrows),
justifies rows spanning at least 85% of their container, and equalizes plain-box row
heights. Frames include padding and titles. Columns are planned separately. Free
labels/icons stay in place unless selected or pushed by growth. Growth pushes
unselected neighbours below/right, including footnotes and chains of neighbours;
locked and hidden objects remain excluded. Fixed routes retain their interior and
re-anchor their end segments; explicit U detours retain endpoint clearance.

Width in Arrange is the wanted width. Actual text width is at least that value and
at least the longest title word or code line, using advances from the shipped fonts.
A side icon reserves 4 mm. Shortening content or selecting a smaller **Code size**
in Text lets the box shrink back. Code size defaults to one step below the title,
with choices down to tiny. A quiet hint identifies the content that widened a box.
Canvas and serializer share wrapped title lines and frame geometry in `src/core/text`.

The dialect adds `sg want=26` only when wanted width differs from actual `text width`,
and `sg code font=tiny` only for a nondefault code size. Files without `sg want` use
the existing text width as wanted width. Copy/paste preserves both values. Coordinates
and explicit minimum heights now retain hundredths of a millimetre so these plans
round-trip without changing frame bounds.

Cross-column alignment would need shared constraints for originally aligned rows
and associations between free labels and those rows. Arbitrary TeX macros, maths,
and inline font changes still use the existing plain-text measurement approximation.
Physical Alt+T delivery in VS Code remains a manual smoke check; no install is run.
Run `node scripts/check-tidy.cjs` for layout fixtures, pushes, persistence, frame fit,
manual routes, and actual preview/key handlers.
