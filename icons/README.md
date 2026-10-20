# Sakuga figure icons

163 monochrome outline icons for embedded systems, software, security, trusted computing, and computer architecture. Use these beside labels; specialized symbols are conventions, not standardized architectural notation.

- `icons.json`: name, category, provenance, and literal SVG path data on a 24×24 grid. All geometry, including circles and rounded rectangles, is represented as paths.
- `sakuga-icons.tex`: TikZ pics and the inline `\sgicon` macro. Fixed 0.6 pt rounded strokes in `black!60`; the 24-unit box is 8.544 pt (about 3 mm).
- `catalog.tex`, `catalog.pdf`, `catalog.png`: grouped catalog with 2.5× previews, including an inline text sample. The PNG combines all six PDF pages.
- `LICENSE-tabler.txt`: upstream MIT license for Tabler Icons 3.49.
- `LICENSE-lucide.txt`: upstream ISC license for Lucide 1.59.0 (includes the upstream Feather notice).
- `LICENSE-iconoir.txt`: upstream MIT license for Iconoir 7.12.1.
- `architecture.py`: architecture drawings and selected upstream paths.
- `build.py`: reproducible JSON and TeX generation from the local upstream source path configured near the top.

## Overleaf

Upload `sakuga-icons.tex` beside your document. Keep all three license files with copies of the icon library.

```tex
\usepackage{tikz}
\usetikzlibrary{svg.path}
\input{sakuga-icons.tex}

A \sgicon{key} key and a \sgicon{tee} trusted execution environment.

\begin{tikzpicture}
  \pic {sg icon/key};
  \node[anchor=west] at (12pt,-4.272pt) {Key};
\end{tikzpicture}
```

The inline macro reserves a consistent box and aligns the icon near the text baseline. Pics have their SVG top-left at the placement point and extend right/down; their size is independent of the surrounding picture's coordinate units. No additional TikZ libraries or fonts are required. Keep the default size for 8–10 pt figure labels; visually dense icons work best in the 10 pt context.

## Provenance and license

72 icons are taken from Tabler, with exact source filenames recorded as `tabler:<filename>.svg`. Tabler copyright (c) 2020–2026 Paweł Kuna; MIT license.

24 original drawings in the existing categories (`source: "own"`): board, bus, cache, debug-probe, fuses, ram, register, rom-otp, soc, os-kernel, key-pair, enclave, isolation, measured-boot, mpu-region, normal-world, pcr, root-of-trust, sau-region, sealed-storage, secure-call, secure-world, tee, tpm. These original drawings and integration files are also provided under the MIT license terms in `LICENSE-tabler.txt`, copyright (c) 2026 Sakuga contributors.

Public/private keys and secure/normal worlds require their accompanying labels. Nonce is represented by a die, measurement by a ruler, and privilege level by steps; these are visual metaphors. ROM/OTP shares a locked chip symbol; fuses has a separate circuit symbol. PCR denotes a measurement register rather than an ordinary register. MPU and SAU have distinct region symbols.


## Computer architecture

70 new icons in `architecture`, consistently named `arch-<concept>` to preserve every existing name and definition. The catalog adds two “Computer architecture” pages, with enlarged previews and a complete actual-size strip on each page. All use the existing 24×24 grid, SVG path drawing, 0.6 pt stroke, and 3 mm bounding box.

Sources for the new icons: 3 Tabler (`arch-branch`, `arch-core`, `arch-reset`), 2 Lucide (`arch-timer`, `arch-gpu`), 1 Iconoir (`arch-asic`), and 64 original drawings. Lucide copyright (c) 2026 Lucide Icons and Contributors, ISC; Iconoir copyright (c) 2021 Luca Burgio, MIT. Keep all three license files with redistributed copies. Original architecture drawings are MIT, copyright (c) 2026 Sakuga contributors.

Original architecture drawings (`arch-` prefix omitted):

register, register-file, alu, adder, multiplier, multiplexer, demultiplexer, decoder, encoder, comparator, and, or, not, nand, nor, xor, buffer-gate, flip-flop, latch, counter, shift-register, fifo, stack, buffer, finite-state-machine, pipeline, instruction, program-counter, multicore, cache, cache-line, tlb, mmu, mpu, memory-hierarchy, sram, dram, flash, rom, memory-mapped-io, address, data-word, bit, byte, bus, crossbar, bridge, dma, nvic, exception, clock, clock-domain, power-domain, gpio, uart, spi, i2c, adc, dac, watchdog, accelerator, crypto-engine, fpga, soc.

`arch-buffer-gate` is the triangular logic buffer; `arch-buffer` is a storage buffer. `arch-fifo` denotes FIFO/queue; `arch-crossbar` denotes crossbar/interconnect; `arch-nvic` denotes an interrupt controller; `arch-i2c` denotes I²C. The byte has eight cells; data-word is a schematic word of unspecified width. Gate inputs face left and outputs face right; NAND, NOR, and NOT have open inversion bubbles. Flip-flop has an edge-trigger triangle, while latch has a level-enable mark. Multiplexer and demultiplexer have bottom select pins.

These are label companions, not complete circuit symbols or standard peripheral diagrams. In particular SRAM/DRAM/ROM, TLB/MMU/MPU, interfaces, watchdog, FPGA/ASIC/SoC, and protection domains need labels. SRAM uses a static cell bank; DRAM uses a capacitor motif; ROM uses fixed crossing lines. ADC and DAC show opposite conversion directions between a curve and steps. The ASIC is a generic packaged chip, and GPU is a graphics-card metaphor. Similarity between these concepts at 3 mm is intentional; do not use them as unlabeled encodings.

## Rebuild

From this directory, with Python 3, TeX Live, Poppler, and Pillow installed:

```sh
python3 build.py
mkdir -p /tmp/sakuga-tex-cache
TEXMFCACHE=/tmp/sakuga-tex-cache nice -n 19 lualatex -interaction=nonstopmode -halt-on-error catalog.tex
pdftoppm -scale-to 1800 -png catalog.pdf catalog-page
python3 render_catalog.py
```
