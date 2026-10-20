# Round 1 object tree

`Figure.items` is the shared tree: Shape, Frame, Text, Icon, Line and Connector.
Every item has an id, one parent (an item or layer id), sibling order and its own
hidden/locked flags. `childrenOf`, `ancestors`, `descendants`, `itemsOfLayer` and
`subtreeState` are model queries. `titleOf` returns the first Text child. Text
children carry optional code and path placement; connector ends carry id/port.

The source line list preserves foreign TikZ. Node, group and edge payloads are
compatibility adapters for existing geometry, named styles and panels. Their
`treeParent` stores the canonical parent; `group`, `layer` and attachment parent
are derived by `projectTree`. Old panel operations are reconciled in `apply`.
New structural callers should use `reparent`, `detach`, `ungroup`, `deleteItem`,
`addText`, `addLine`, `line`, `text` and `endpoint`. Connector placement is always
recomputed from its endpoints, including after reparenting and ungrouping.
Deleting a frame deletes its subtree; the explicit Ungroup operation preserves
its members in the parent container.

The reader accepts the previous node/category/group/attachment/arrow dialect.
The writer emits `sg shape`, `sg text`, `sg conn`, `sg frame` and `sg line`;
inline path labels use `sg label`. Named styles are retained for round 2.
`sg id` identifies paths. `% sakuga tree` encodes structural metadata in UTF-8
hex (the existing label-metadata convention): inline Text ids, sibling order,
parent, own hidden/locked flags and normalized ports. Content and geometry stay
in TikZ. Missing metadata is rebuilt deterministically from legacy syntax.
Generated Line anchors allow connector ports to address Lines by id.

The current view model/store expose `items` and `lines` alongside their existing
node/group/edge projections. Lines and labels render on the canvas; their new
creation/selection controls belong to the later interaction/panel rounds.

Legacy attachments with an explicit different layer are detached at their resolved
position during import. This preserves the appearance of the formerly visible
child on a hidden layer's parent in `labels-and-attachments`, while every actual
child now inherits its parent's layer and hidden/locked state.

Goldens regenerated with `UPDATE_GOLDEN=1` for the new structural model and dialect
(the canvas, scene and geometry goldens remain unchanged):

```text
test/golden/model/box-decorations.json
test/golden/model/components.json
test/golden/model/icon-positions.json
test/golden/model/labels-and-attachments.json
test/golden/model/rats-architecture.json
test/golden/model/routing-fuzz-1a.json
test/golden/model/routing-fuzz-1b.json
test/golden/model/routing-fuzz-50a.json
test/golden/model/routing-fuzz-50b.json
test/golden/model/routing-fuzz-65a.json
test/golden/model/routing-fuzz-65b.json
test/golden/model/routing-fuzz-70a.json
test/golden/model/routing-fuzz-70b.json
test/golden/model/routing-fuzz-78a.json
test/golden/model/routing-fuzz-78b.json
test/golden/model/state-machine.json
test/golden/ops/build-rats-architecture-standalone.tex
test/golden/ops/build-rats-architecture.tikz
test/golden/ops/components/bottom-keyed-att.tikz
test/golden/ops/components/bottom.tikz
test/golden/ops/components/centerX-keyed-att.tikz
test/golden/ops/components/centerX.tikz
test/golden/ops/components/centerY-keyed-att.tikz
test/golden/ops/components/centerY.tikz
test/golden/ops/components/distributeX.tikz
test/golden/ops/components/distributeY.tikz
test/golden/ops/components/left-keyed-att.tikz
test/golden/ops/components/left.tikz
test/golden/ops/components/right-keyed-att.tikz
test/golden/ops/components/right.tikz
test/golden/ops/components/sameH.tikz
test/golden/ops/components/sameW.tikz
test/golden/ops/components/tidy-figure.tikz
test/golden/ops/components/tidy-selection.tikz
test/golden/ops/components/top-keyed-att.tikz
test/golden/ops/components/top.tikz
test/golden/ops/rats-architecture/bottom-keyed-rtos.tikz
test/golden/ops/rats-architecture/bottom.tikz
test/golden/ops/rats-architecture/centerX-keyed-rtos.tikz
test/golden/ops/rats-architecture/centerX.tikz
test/golden/ops/rats-architecture/centerY-keyed-rtos.tikz
test/golden/ops/rats-architecture/centerY.tikz
test/golden/ops/rats-architecture/distributeX.tikz
test/golden/ops/rats-architecture/distributeY.tikz
test/golden/ops/rats-architecture/left-keyed-rtos.tikz
test/golden/ops/rats-architecture/left.tikz
test/golden/ops/rats-architecture/right-keyed-rtos.tikz
test/golden/ops/rats-architecture/right.tikz
test/golden/ops/rats-architecture/sameH.tikz
test/golden/ops/rats-architecture/sameW.tikz
test/golden/ops/rats-architecture/tidy-figure.tikz
test/golden/ops/rats-architecture/tidy-selection.tikz
test/golden/ops/rats-architecture/top-keyed-rtos.tikz
test/golden/ops/rats-architecture/top.tikz
test/golden/ops/sequence-styles-labels-layers-paste.tikz
test/golden/roundtrip/box-decorations.tikz
test/golden/roundtrip/components.tikz
test/golden/roundtrip/icon-positions.tikz
test/golden/roundtrip/labels-and-attachments.tikz
test/golden/roundtrip/rats-architecture.tikz
test/golden/roundtrip/routing-fuzz-1a.tikz
test/golden/roundtrip/routing-fuzz-1b.tikz
test/golden/roundtrip/routing-fuzz-50a.tikz
test/golden/roundtrip/routing-fuzz-50b.tikz
test/golden/roundtrip/routing-fuzz-65a.tikz
test/golden/roundtrip/routing-fuzz-65b.tikz
test/golden/roundtrip/routing-fuzz-70a.tikz
test/golden/roundtrip/routing-fuzz-70b.tikz
test/golden/roundtrip/routing-fuzz-78a.tikz
test/golden/roundtrip/routing-fuzz-78b.tikz
test/golden/roundtrip/state-machine.tikz
test/golden/state/box-decorations.json
test/golden/state/components.json
test/golden/state/icon-positions.json
test/golden/state/labels-and-attachments.json
test/golden/state/rats-architecture.json
test/golden/state/routing-fuzz-1a.json
test/golden/state/routing-fuzz-1b.json
test/golden/state/routing-fuzz-50a.json
test/golden/state/routing-fuzz-50b.json
test/golden/state/routing-fuzz-65a.json
test/golden/state/routing-fuzz-65b.json
test/golden/state/routing-fuzz-70a.json
test/golden/state/routing-fuzz-70b.json
test/golden/state/routing-fuzz-78a.json
test/golden/state/routing-fuzz-78b.json
test/golden/state/state-machine.json
```
