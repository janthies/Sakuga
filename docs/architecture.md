# Sakuga: target architecture and migration plan

Design of 2026-10-20 against `main` @ b42f7d8. Line numbers refer to b42f7d8. Progress is tracked in the table of section 7.

## 0 What the code tells us
- Code is shared through UMD globals: `src/tikz.ts` `require`s `media/routes.js` and `media/text.js`; `media/editor.js` reads `SakugaRoutes`, `SakugaText`, `SakugaSketch` from `window`.
- Copies that already drift: `editor.js` has its own `boxHalf` (382, fixed 6.16/9.55 mm heights, while `tikz.ts:574` uses the text layout) and `resolveRoute` (385, a copy of `tikz.ts:580`); its frame-obstacle filter (416) differs from `routeObjects`; `textMm` (210) uses the browser's `measureText` instead of the advance tables; `darkerColor`, `fillOf`, `resolveAttached` are copied; a second serializer for the clipboard lives at 1730–1780.
- The host sends a derived snapshot (`send()` in `extension.ts`); ops are applied to a fresh parse of the document, followed by a min-diff write.
- Every render and every serialize reroutes each arrow plus all earlier arrows (`prior`, editor.js 417, tikz.ts 732): O(E²) A* per pointermove.
- Knowledge about properties sits in more than six places: `STYLEABLE`, `STYLE_GROUPS`, `NUMBER_PROPS`, `BOOLEAN_PROPS`, `PRIMARY`, `groupDefaults`, the order-sensitive `styleOptions`/`readStyle`, and inspector rows routed to sections by their label string.
- The codec uses Node-only `Buffer` (tikz.ts 129, 135, 491, 507, 742), so it cannot run in the webview as is.
- 9 of the 19 checks slice `editor.js` by text markers into `vm`, so any reformat breaks them; 11 checks need LuaLaTeX.

## 1 Module map
One npm package; folders act as packages; TS project references and dependency-cruiser enforce the boundaries.

| Module | Responsibility |
|---|---|
| core/model | Types (Figure, Line, FigNode, FigEdge, Group, Layer, StyleDef, ObjectRef) and queries |
| core/text | Font advance tables, text width, line breaking, box size (today text.js) |
| core/schema | Property declarations per object kind, option codecs, defaults, inspector hints |
| core/geometry | Anchors, attachments, frame bounds, arrow paths (ports, loops, chains), label positions; memoised per revision |
| core/styles | Resolve, merge, override, settle, shared overrides |
| core/codec | Dialect: option lexer, parse, serialize, generated blocks, legacy readers, `serializeSubset`, `standaloneTex` |
| core/ops | Typed op union, one handler per op family, apply, paste |
| core/layout | A* router, align/distribute/same size, tidy; `LayoutEngine` port for ELK; generators |
| core/scene | `buildScene(fig)`: what the canvas draws, as plain primitives in mm |
| bridge | Versioned message protocol and typed channel |
| host | VS Code adapters: provider, document sync, settings, commands, export and preview through `TexRunner`, icon and template stores |
| webview/platform | The only module that touches `acquireVsCodeApi`: host channel, view-state persistence |
| webview/store | Document (text, Figure, revision), selection (`ObjectRef[]`), view, transient preview |
| webview/render | Scene to SVG DOM (keyed patch, one view transform) plus overlays (selection, handles, guides) |
| webview/tools | Interaction state machine: one Tool per gesture, fed normalised `CanvasEvent`s |
| webview/commands | Command registry: keys, help table, wheel, toolbar, VS Code `sakuga.*` commands |
| webview/panels | Inspector (schema-driven), layers, figure tab, drawer, zoom bar, floating toolbar |
| webview/ui | Control kit: Row, Number, Segmented, Colour, Select, Toggle, AnchorPicker, IconPicker, Popover |

Inside core, imports go leftwards only: model → text → schema → geometry → styles → codec → ops → layout → scene.

## 2 APIs between the parts
```ts
// bridge/protocol.ts: the only types host and webview share besides core/model
export const PROTOCOL = 1;
export type ToWebview = { t: 'init'; protocol: number; settings: Settings; icons: Icon[] }
  | { t: 'doc'; text: string; version: number }            // replaces the derived 'state' snapshot
  | { t: 'select'; refs: ObjectRef[] } | { t: 'command'; id: CommandId; args?: unknown }
  | { t: 'preview'; key: string; svg: string; bbox: Rect }; // compiled overlay (later)
export type ToHost = { t: 'ready'; protocol: number } | { t: 'op'; op: Op; baseVersion: number }
  | { t: 'setText'; text: string } | { t: 'paste'; text: string; at: Point; layer: string }
  | { t: 'export'; profile: ExportProfile } | { t: 'clipboard'; text: string; notice: string }
  | { t: 'previewRequest'; key: string; tikz: string } | { t: 'log'; level: 'error' | 'info'; text: string };
// host ports (adapters in host/vscode/*, fakes in test/fakes/*)
interface DocumentPort { text(): string; version(): number; write(text: string): Promise<void>; onChange(f: () => void): Disposable }
interface TexRunner { run(j: { tex: string; fontsDir: string; output: 'pdf' | 'svg-pdftocairo' | 'svg-dvisvgm'; timeoutMs: number }):
  Promise<{ ok: true; file: Uint8Array } | { ok: false; error: string; log: string }> }
interface ClipboardPort { writeText(t: string): Promise<void> }
interface SettingsPort { get<K extends keyof Settings>(k: K): Settings[K]; onChange(f: () => void): Disposable }
interface UiPort { status(m: string, ms?: number): void; error(m: string): void; saveAs(name: string, ext: string): Promise<string | undefined> }
// webview ports
interface ViewStatePort { get<K extends keyof Prefs>(k: K): Prefs[K]; set<K extends keyof Prefs>(k: K, v: Prefs[K]): void }
interface HostPort { send(m: ToHost): void; on(f: (m: ToWebview) => void): void }
// core: an explicit context instead of module globals (today setIcons, figureFont)
interface CoreCtx { icons: IconCatalog; metrics: TextMetrics; settings: { exportWidth: number; font: FontSize } }
type ObjectRef = { k: 'node'; id: string } | { k: 'edge'; index: number } | { k: 'group'; id: string } | { k: 'label'; of: ObjectRef; slot?: number };
type Op = NodeOp | EdgeOp | StyleOp | LabelOp | LayerOp | GroupOp | FigureOp | { op: 'batch'; ops: Op[] };
interface OpHandler<O extends Op> { op: O['op']; apply(fig: Figure, op: O, ctx: CoreCtx): void } // one file per family
declare function parse(text: string, ctx: CoreCtx): Figure;
declare function serialize(fig: Figure, ctx: CoreCtx, o?: { profile?: ExportProfile }): string;
declare function serializeSubset(fig: Figure, refs: ObjectRef[], ctx: CoreCtx): string;   // clipboard
declare function buildScene(fig: Figure, ctx: CoreCtx, o?: { appear?: number }): Scene;  // keyed prims carrying ObjectRef
// webview
interface Renderer { draw(scene: Scene, overlay: Overlay, view: View): void; hit(target: EventTarget): HitRef | null }
interface Tool { down(e: CanvasEvent): Step; move(e: CanvasEvent): Step; up(e: CanvasEvent): Step; key?(e: KeyEvent): Step }
type Step = { preview?: Op; commit?: Op; select?: ObjectRef[]; next?: Tool };  // CanvasEvent = { p: mm, button, mods, hit }
interface Command { id: string; title: string; keys?: string[]; when(s: AppState): boolean; run(s: AppState): Op | void }
interface SectionSpec { id: 'style' | 'text' | 'appearance' | 'arrange'; title: string; collapsed?: boolean; rows: RowSpec[] }
type RowSpec = { prop: PropKey } | { label: string; props: PropKey[] } | { label: string; custom(c: PanelCtx): Control<unknown> };
interface Control<V> { el: HTMLElement; set(v: V | typeof MIXED, s: { inherited: boolean }): void; onCommit(f: (v: V | null) => void): void }
```
A panel declares its controls as `SectionSpec[]`; rows come from the schema's `ui` hints; `custom` covers special controls (anchor picker, route editor). Tools never see the DOM: the renderer turns event targets into a `HitRef`.

## 3 Property schema
```ts
interface PropDef { key: PropKey; kinds: Kind[]; type: PropType; default: unknown | ((c: CoreCtx) => unknown); styleable: boolean;
  travel?: 'font' | 'stroke' | 'tips' | 'mark'; length?: 'geometry' | 'stroke'; ui?: { section: SectionId; label: string; row?: string; order: number } }
interface OptionCodec { owns: PropKey[]; kinds: Kind[]; emit(p: Props, c: EmitCtx): string[]; read(opt: string, p: Props, c: ReadCtx): boolean }
```
- **Fits:** all appearance properties (fill, colour, border, weight/line width, shape, font, text colour, opacity, pattern, corner mark, tips, frame fill/outline/padding/title, label typography), every `% sakuga style` line and group field. One declaration drives style merge/override/travel, the style-line codec, inspector rows, copy/paste style, styles for arrows and frames (`styleable`), `appear=n`, and `\sgu` scaling (lengths formatted by `length` class).
- **Does not fit (hand-written structural codecs per kind):** node content encodings (`\sgcontent`, title position `\parbox`, `\\[-1pt]\sgcode`, `\sglabel`/`\sgstep`), arrow paths (routes, chains, loops, port shifts), attachments, computed options (`sg label height`, `sg icon height`, `text height/depth`), legacy readers, interplay rules.
- **Byte identity:** codec order equals today's `styleOptions` order; options no codec claims stay verbatim in `extra`.

## 4 Shared code
- esbuild makes two bundles from one source tree: `out/extension.js` (Node, CommonJS, `vscode` external) and `media/dist/webview.js` (IIFE, ES2022). Both contain core; no globals, no UMD.
- `tsconfig.core.json` has `lib: ES2022`, `types: []`, so DOM, Node and `Buffer` cannot creep in; `util/hex.ts` uses `TextEncoder`.
- Canvas, serializer, clipboard and tidy preview call the same `geometry.edge()` and `text.layout()`; a cache keyed by figure revision ends the O(E²) rerouting.
- The webview parses `doc.text` itself; the host stays authoritative for ops (ADR-2).

## 5 Dependency rules (`.dependency-cruiser.cjs`, part of `npm run check`)
- `core-pure`: `src/core` imports nothing outside `src/core`, no Node builtins, no `vscode`. `core-layers`: leftwards only (§1). `no-circular` everywhere.
- `bridge-thin`: `src/bridge` imports only `src/core/model` (type-only). `host-no-webview`, `webview-no-host` (and no `vscode`, no Node builtins): host and webview talk only through `src/bridge`.
- Webview: `panels` → `ui`; `render`, `tools`, `commands` do not import `panels`; only `platform` touches `acquireVsCodeApi`.
- Fitness rules (`scripts/fitness.cjs`): no file over 400 lines (generated tables excepted), `prettier --check`, no `@ts-nocheck` after S14.

## 6 Test strategy
- **Safety net first (S0):** today's code produces golden outputs under `test/golden/`, compared byte-exact by `expectGolden()`; `UPDATE_GOLDEN=1` rewrites them, allowed only in steps marked re-baseline, with the reason in the commit message. Goldens: (1) per example and per fixture (`work/routing-fuzz-*.tikz` copied): `serialize(parse(t)) === t`, model JSON, host `state` payload; (2) geometry dumps from both sides (serializer `routeObjects`, `specialGeometry`, `boxHalf`; canvas `edgeGeom`, `layout`, frame/label geometry via a guarded `window.__sakugaTest` hook), today's differences recorded in `test/golden/drift.json`; (3) canvas SVG per example: real `editor.js` in jsdom with a fake `acquireVsCodeApi`, 1200×800 viewport, `measureText` backed by the advance tables, fixed view; (4) op sequences → TikZ: `build-rats-architecture`, every arrange command and tidy on components and rats, one style/label/layer/paste sequence.
- **Unit tests per core module**; host tests on fake ports; tools tested through `CanvasEvent` without DOM; panels in jsdom; after S11 a seeded property-based round trip from the schema.
- **Existing scripts:** S2 ports the 9 slicing checks to the jsdom harness before any reformat; logic checks move to `test/` and import modules; LuaLaTeX probes move to `test/tex/`.
- **Commands:** `npm run check` (`tsc -b`, depcruise, prettier, fitness, `node --test` via tsx; under 60 s, no TeX, no browser); `check:tex` (LuaLaTeX parity probes, `nice -n 19`) and `check:visual` (puppeteer + pixelmatch) locally before merging geometry, codec or renderer steps.
- **CI:** `.github/workflows/check.yml`, one job: ubuntu-latest, Node 22, npm cache, `npm ci && npm run check`, on push and PR to `main`.

## 7 Migration steps (strangler: each step one commit or PR, goldens identical unless marked re-baseline)
| # | Step | Touches | Done when | Effort | State |
|---|---|---|---|---|---|
| S0 | Goldens, jsdom harness, test hook | test/**, editor.js (hook only) | Goldens committed; green twice in a row; drift.json filled | 1 R | done |
| S1 | `check`, `check:tex`, CI workflow | package.json, .github/ | CI green | 0.2 R | done |
| S2 | Port the 9 slicing UI checks to the harness | scripts → test/webview | No test reads editor.js as text | 1 R | done |
| S3 | Tooling: esbuild, tsconfig per layer, depcruise, prettier config, blame-ignore | build files, install.sh | VSIX installs, examples open, goldens identical | 0.5 R | done |
| S4 | Prettier on all files (formatting only) | all | `prettier --check` in check | 0.1 R | done |
| S5 | text/routes/sketch.js → core TS; `util/hex`; IIFE shim keeps old globals | media/*.js, tikz.ts, script requires | media copies deleted | 0.5 R | done |
| S6 | Split tikz.ts into core modules; tikz.ts becomes a barrel | src/core/** | No core file over 400 lines; core rules on | 1.5 R | open |
| S7 | Host ports, bridge, `viewModel()` into core | extension.ts, export.ts, host/, bridge/ | extension.ts under 80 lines; fake-port tests | 1 R | open |
| S8 | Webview to TS (`@ts-nocheck`), imports core, shim removed | editor.js, page() scripts | SVG goldens identical; VS Code smoke test (CSP, fonts) | 0.5 R | open |
| S9 | Mechanical webview split: state → `store`, functions → modules | src/webview/** | No file over 400 lines; goldens identical | 1 R | open |
| S10 | **Re-baseline:** one geometry; delete webview copies; clipboard via `serializeSubset`; advance-table metrics; revision memo | core/geometry, webview/render | drift.json empty; parity test enforced; tex/visual reviewed | 1.5 R | open |
| S11 | Schema: PropDefs replace the six tables; option codecs replace styleOptions/readStyle/styleLine/groupOptions | core/schema, styles, codec | Goldens identical; read∘emit tests | 1.5 R | open |
| S12 | Scene renderer: buildScene, keyed SVG patch, view transform | core/scene, webview/render | Pixel goldens equal; perf budget test | 1 R | open |
| S13 | Tools and command registry; VS Code `sakuga.*` commands via `command` | webview/tools, commands | Tool tests without DOM; handlers under 150 lines | 1 R | open |
| S14 | Schema-driven inspector on the UI kit; remove the barrel and the last `@ts-nocheck` | panels, ui | All fitness rules on; Jan tries it | 1.5 R | open |

Parallel waves in separate git worktrees: A after S0: S1 ∥ S2 ∥ S3. B after S4 and S5: S6 ∥ S7 ∥ S8. C after S9: S10 ∥ S11. D after S10: S12 ∥ S13.

## 8 How the planned features land
- **Export size and `\sgu`:** `length` class on PropDefs, length formatter in the codec, a header codec for `% sakuga export`, `SettingsPort`.
- **Named arrow and frame styles:** `styleable` flags plus the generic Style section.
- **Compiled overlay for foreign TikZ:** core `standaloneTex()` shared with SVG export; host PreviewService over `TexRunner('svg-dvisvgm')` with a hash cache; a scene layer for raw lines.
- **Template gallery:** host TemplateStore (`templates/`) and a webview panel drawing thumbnails with `buildScene`.
- **Build steps:** one `appear` PropDef, a scene filter, a stepper in the zoom bar.
- **Packet/memory-map tables, sequence charts, trees, timelines:** `Generator { id; params: PropDef[]; generate(p, ctx): Op[] }` in core/layout/generators; parameter form as a schema-driven panel.
- **ELK layout:** `LayoutEngine` port, elkjs adapter in a webview worker; results become move/arrow ops.
- **Parked fix round 1** (`stash@{0}` and ~/Documents/Claude/Sakuga-Research/fix1-brief.md): rebuilt after S14 on the new structure (toolbar, box text as child, object wheel and inspector skeleton land on the command registry and panel kit).

## 9 Risks and guards
- **Canvas/TikZ geometry drift** (already real, §0): drift.json and a parity test that becomes an invariant in S10; `check:tex` on every geometry or codec step; one implementation afterwards.
- **Losing byte identity during codec moves:** round-trip and op goldens, fuzz corpus, explicit codec order, property-based round trip.
- **Webview CSP with bundles:** one nonce'd `dist/webview.js` (esbuild emits no eval), maps excluded by `.vscodeignore`, manual VS Code smoke test at S3 and S8; the ELK worker will need `worker-src`.
- **Canvas performance:** revision memo (S10), keyed DOM patch with one transform (S12), perf budget test.
- **Hidden behaviour in closure state:** moves are scripted and change no logic; logic changes only in re-baseline steps.
- **Agents colliding:** parallel work only on disjoint files, S9 in a single round, each step rebased with check green.

## 10 Decisions
- **ADR-1 One pure core, bundled twice.** Geometry, metrics, routing, styles, codec and ops exist once in `src/core` (no DOM, Node or vscode), bundled into both the extension and the webview. Canvas = TikZ then holds by construction; clipboard, drag preview and thumbnails reuse the codec. Rejected: UMD files in `media/` (untyped, global, drifting) and host-only geometry (round trip per pointermove). Cost: about 150 KB more webview JS.
- **ADR-2 The TikZ text stays the truth; the host applies ops.** The webview gets `{text, version}`, parses with the same core, sends typed ops; the host applies them to the current text and writes a min diff, so undo stays VS Code's text undo. The webview may preview an op on a clone. Rejected: webview-authoritative writes (race with text edits), a separate model file.
- **ADR-3 Schema for appearance, hand-written codecs for structure** (§3). Rejected: fully schema-driven dialect (too irregular for byte identity) and the status quo (a new property touches six places).
- **ADR-4 Safety net before structure; strangler steps.** Goldens freeze today's output before the first move; only re-baseline steps rewrite them, with a reviewed diff. Fast tests in one CI job; LuaLaTeX and browser checks stay local.
- **Decided 2026-10-20:** the parked fix round waits until after S14 (Jan: "architecture first, then fix"); arrows keep index references behind `ObjectRef` (revisit with sequence charts); CI runs Node 22, local Node 18 stays until an upgrade is wanted.
