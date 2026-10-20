# Architecture figures

The architecture controls extend the existing inspector and arrow toolbar. New groups have a light tint, a dashed outline in a darker group colour, and a bold title above-left; grouping existing frames creates a solid outer frame with no fill. Old group comments retain their original title placement and weight until edited.

Arrow endpoints can be dragged to a box side or frame edge. Selected arrows expose endpoint handles. Start/end side selectors and the U route are also in the inspector. Frame ports project onto the other endpoint's row or column, so protocol messages terminate at the outer boundary. Nested frame sizes include child frames, their titles and internal U routes. Shared millimetre geometry in `media/routes.js` drives the canvas and generated paths.

Parallel arrows share automatic lanes, 3.5 mm either side of the centre for a pair; further arrows add lanes at 7 mm spacing. The first arrow uses the upper horizontal lane. A numeric Lane value overrides this arrangement; clearing the field restores automatic placement. Step numbers use the next unused positive integer when **Set next step** is clicked. Existing numbers never change automatically; clearing the Step field removes a badge.

**Colour from source** uses 60% of each RGB channel of the source category's base colour, equivalent to mixing 60% colour with 40% black. The colour is stored explicitly. Arrow labels and badges follow it. Grey arrows use dark grey badges. Frame outlines inherit a darker group colour, and title colour defaults to a darker shade of the outline. Explicit outline and title colours remain independent.

Copy/Paste style and Ctrl+Alt+C/V work for boxes, labels, arrows and groups. Arrow style includes lane, route, heads, label placement, colour, width and tip dimensions; it excludes the step number and endpoint identities/anchors. Group style includes region/border colours, width, padding and title settings. Across types, paste transfers colour. Copying an arrow attached to a group also includes that group's members and nesting so the pasted TikZ has valid endpoints.

## Added dialect

Typical generated arrow options:

```tex
\draw[arr, sg straight, sg route=straight, sg step=1, sg lane=3.5,
  draw=sgc708596, line width=0.65pt, sg line width=0.65,
  sg tip length=2, sg tip width=1.5,
  {}-{Latex[length=2mm, width=1.5mm]}]
  ([xshift=0mm,yshift=3.5mm]ver.west) --
  node[sg elabel, above, text=sgc708596]
  {\sgstep{1}\ \shortstack{nonce $N$}}
  ([xshift=0mm,yshift=30mm]att.east);
```

The generated theme defines `\sgstep` and centres multiline arrow labels. U routes use `sg fixed, sg route=u`, two explicit corners and anchored endpoints such as `bl1.south` and `rec.south`. `sg mid` and `sg bend` retain manual routing parameters when coordinates are generated. `sg implicit from` / `sg implicit to` distinguish automatic endpoints from explicit `.center` anchors. `sg label side` / `sg label position` retain label settings while an arrow has no label; a standalone badge stays at the middle.

The group comment accepts these additional fields:

```tex
% sakuga group att {Attester (constrained device)} solid grey titlePosition=above-center titleBold=true titleFont=small lineWidth=1
```

Available title positions are `above-left`, `above-center`, `inside-top-left`, `inside-top-right`, and `below-left`. `legacy` preserves the old placement (inside top left for regions, no title on other frames). Optional group fields are `frameColor=#RRGGBB`, `titleColor=#RRGGBB`, `padding=<mm>`, `lineWidth=<pt>`, and `titleFont=<box font size>`. Existing `in=<parent>` nesting remains unchanged. Explicit fields are omitted at their dialect defaults. Compatibility defaults for old group comments are `titlePosition=legacy`, `titleBold=false` and `titleFont=scriptsize`; new groups explicitly store their changed title defaults. Automatic lanes and default arrow dimensions (0.45 pt, 1.5/1.2 mm tips) are omitted.

## Reference 02

Run `npm run compile`, then `node scripts/build-rats-architecture.cjs`. This writes `examples/rats-architecture.sakuga.tikz` and a standalone LuaLaTeX document under `work/feature-arch/`. The figure has 15 nodes (including the note and footnote as labels), four nested frames and 11 arrows, including steps 1–4. It needs no handwritten TikZ additions. The zigzag is intentionally omitted.

The rendered comparison is `work/feature-arch/sakuga-02-v3.png`. Its three worlds use tinted fills, coloured dashed outlines, white boxes and bold titles above-left. The sign label demonstrates a colour/weight override; evidence demonstrates a free offset, with badge 2 centred before the two text lines. This workspace cannot write to the brief's sibling research directory, so render artifacts are kept in the repository's work directory.

Checks: `node --check media/editor.js`, `npm run compile`, and all `scripts/check-*.cjs` scripts. Architecture checks cover all frame/title combinations, routes, tip shapes and dimensions, label sides, default omission, source colours, style transfer without renumbering, frame endpoint drops and clipboard membership. LuaLaTeX probes compare actual fit-node endpoint coordinates with the shared canvas geometry within 0.03 mm. The example round trip is byte-identical. Interactive VS Code verification remains manual; the available Chromium launcher cannot start in this sandbox.


## Independent fill and outline; attached labels

Frame comments add `fill=none|tint`, `fillStrength=<0–100>` (default 30), and `outline=none|solid|dashed|dotted`. `frameColor` and `lineWidth` still control the outline. The original frame word retains its padding/corner preset and compatibility defaults: `region` supplies tint only; `solid`, `dashed` and `dotted` supply outline only; `none` supplies neither. Changing fill does not change outline. Boxes and frames expose separate Fill and Outline sections.

Click arrow text/badges or a frame title to select the label; click the parent line/edge to select its parent. Selection draws a light rectangle and a dashed leader. Dragging arrow labels projects onto the path, snaps to .25/.5/.75, chooses a side, and keeps a free millimetre offset. A routed arrow also retains its segment index. Frame title drags snap to the existing title presets. Reset position clears free placement. Label edits preserve selection after the source document updates.

The label inspector offers text, font, bold, italic, colour and white knock-out. Font defaults to the figure font for arrows and the existing title font for frames. Colour follows the arrow or frame title shade until explicitly overridden. All style controls support Inherit; false bold/italic/background overrides differ from inheritance and are retained. Ctrl+Alt+C/V transfers label typography without moving the destination.

`Detach` produces a free label in one operation, preserving position, effective style and any step badge. Drop a free label onto an arrow or frame edge using the existing attachment gesture (Alt suppresses attachment), or choose its parent in the inspector. A frame attachment becomes its title, replacing the previous title in the same undo step. An arrow attachment becomes its main label if empty; otherwise it adds another independently selectable path node.

Generated TikZ uses native label `pos=`, side, `shift={(dx mm,dy mm)}`, `font`, `text` and `fill` options. A no-op `sg labels=<hex JSON>` draw option retains explicit-vs-inherited values, legacy placement and additional label texts/styles. A frame's `labelStyle=<hex JSON>` comment field retains its own title overrides. Hex encoding keeps TeX comment characters and nested braces out of option metadata. The native options draw the actual label; metadata preserves editability. Only nondefault own values are stored. The `segment` field identifies a polyline leg; `pos` is relative to that leg, as in TikZ. Curves use their cubic parameter. Editing a label preserves the parent's routing geometry.

`\sglabel{step}{text}` centres a badge before a multiline label. Detached labels use `sg compact` to preserve tight label spacing instead of box padding; the existing free-label node dialect otherwise stays unchanged. Combined bold+italic typography now round-trips on free labels too.

`node scripts/check-attached-labels.cjs` exercises actual pointer and clipboard handlers, document-echo selection, inheritance, additional nodes, badge detach/attach, all legacy frame presets and byte-identical saves. Native LuaLaTeX probes verify an offset arrow label and frame title against canvas coordinates within 0.035 mm. All new artifacts are under `work/`. A live VS Code interaction pass remains manual; no feature is intentionally deferred.
