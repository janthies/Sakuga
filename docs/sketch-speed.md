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
files were inspected instead. Notices are in `media/sketch.LICENSE.txt`.
