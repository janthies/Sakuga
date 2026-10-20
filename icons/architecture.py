"""Original 24-grid architecture symbols; imported outlines retain provenance."""
from pathlib import Path
import xml.etree.ElementTree as ET

BASE = Path('/home/jan/Documents/Claude/Sakuga-Research')
SOURCES = {
    'tabler': BASE/'tabler/package/icons/outline',
    'lucide': BASE/'iconsets/lucide-static-1.59.0/package/icons',
    'iconoir': BASE/'iconsets/iconoir-7.12.1/package/icons/regular',
}

def architecture():
    icons = []
    def own(name, *paths):
        icons.append(dict(name='arch-'+name, category='architecture', source='own', paths=list(paths)))
    def upstream(name, source, filename):
        root = ET.parse(SOURCES[source]/(filename+'.svg')).getroot()
        assert root.attrib['viewBox'] == '0 0 24 24'
        paths = []
        for el in root:
            a = el.attrib
            if a.get('stroke') == 'none': continue
            assert 'transform' not in a
            assert a.get('fill', root.attrib.get('fill')) == 'none'
            tag = el.tag.split('}')[-1]
            if tag == 'path': paths.append(a['d'])
            elif tag == 'line': paths.append(f"M{a['x1']} {a['y1']}L{a['x2']} {a['y2']}")
            elif tag == 'circle':
                x,y,r = (float(a[k]) for k in ('cx','cy','r'))
                paths.append(f'M{x-r:g} {y:g}a{r:g} {r:g} 0 1 0 {2*r:g} 0a{r:g} {r:g} 0 1 0 {-2*r:g} 0')
            else: raise ValueError(tag)
        icons.append(dict(name='arch-'+name, category='architecture', source=source+':'+filename+'.svg', paths=paths))
    chip = 'M5 5h14v14H5z M9 3v2m6 -2v2M9 19v2m6 -2v2M3 9h2m-2 6h2M19 9h2m-2 6h2'
    block = 'M5 5h14v14H5z'
    reg = 'M3 7h18v10H3z M9 7v10m6 -10v10'
    own('register', reg)
    own('register-file', 'M4 3h16v18H4z M4 9h16M4 15h16M10 3v18')
    own('alu', 'M3 4h6l3 4l3 -4h6l-4 16H7z M9 13h6M12 10v6')
    own('adder', 'M5 5h14v14H5z M8 12h8M12 8v8 M2 8h3m-3 8h3M19 12h3')
    own('multiplier', 'M5 5h14v14H5z M9 9l6 6m0 -6l-6 6 M2 8h3m-3 8h3M19 12h3')
    own('multiplexer', 'M7 3l10 4v10l-10 4z M2 7h5m-5 10h5M17 12h5M12 19v3')
    own('demultiplexer', 'M17 3L7 7v10l10 4z M2 12h5M17 7h5m-5 10h5M12 19v3')
    own('decoder', block, 'M2 9h3m-3 6h3M19 7h3m-3 5h3m-3 5h3 M9 8l6 4l-6 4')
    own('encoder', block, 'M2 7h3m-3 5h3m-3 5h3M19 9h3m-3 6h3 M15 8l-6 4l6 4')
    own('comparator', block, 'M2 8h3m-3 8h3M19 12h3 M9 9h6m-6 6h6')
    and_body = 'M6 5h5a7 7 0 0 1 0 14H6z M2 8h4M2 16h4'
    or_body = 'M5 5Q10 12 5 19Q15 19 19 12Q15 5 5 5z M2 8h4.5M2 16h4.5'
    bubble = 'M18 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0'
    own('and', and_body, 'M18 12h4')
    own('or', or_body, 'M19 12h3')
    own('not', 'M6 5l12 7l-12 7z M2 12h4', bubble, 'M21 12h1')
    own('nand', and_body, bubble, 'M21 12h1')
    # OR family ends at x=18 to leave room for the inversion bubble.
    own('nor', or_body.replace('19 12','18 12'), bubble, 'M21 12h1')
    own('xor', or_body.replace('M2 8h4.5M2 16h4.5','M1 8h2.5M1 16h2.5'), 'M2 5Q7 12 2 19 M19 12h3')
    own('buffer-gate', 'M6 5l12 7l-12 7z M2 12h4M18 12h4')
    own('flip-flop', block, 'M2 8h3M19 8h3M2 16h3l3 -3l-3 -3')
    own('latch', block, 'M2 8h3M19 8h3M2 16h3 M9 14v3')
    own('counter', reg, 'M6 5c0 -4 12 -4 12 0m-2 -2l2 2l2 -2')
    own('shift-register', reg, 'M3 3h18m-3 -2l3 2l-3 2')
    own('fifo', reg, 'M1 12h2M21 12h2 M5 21h14m-3 -2l3 2l-3 2')
    own('stack', 'M6 7v14h12V7 M6 16h12M6 11h12 M9 3v5m-2 -2l2 2l2 -2 M15 8V3m-2 2l2 -2l2 2')
    own('buffer', 'M5 7h14v10H5z M2 12h3M19 12h3 M9 7v10')
    own('finite-state-machine', 'M3 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M9 6h9v9m-2 -2l2 2l2 -2 M15 18H6V9m-2 2l2 -2l2 2')
    own('pipeline', 'M2 7h4v10H2z M10 7h4v10h-4z M18 7h4v10h-4z M6 12h4m4 0h4')
    own('instruction', 'M3 6h18v12H3z M9 6v12 M12 10h6m-6 4h3')
    own('program-counter', 'M3 7h14v10H3z M9 7v10 M17 12h5m-3 -3l3 3l-3 3')
    upstream('branch', 'tabler', 'arrows-split')
    upstream('core', 'tabler', 'cpu')
    own('multicore', chip, 'M8 8h3v3H8z M13 8h3v3h-3z M8 13h3v3H8z M13 13h3v3h-3z')
    own('cache', 'M4 5h16v14H4z M4 10h16 M8 14h8')
    own('cache-line', 'M2 7h20v10H2z M7 7v10 M12 7v10m5 -10v10 M2 21h20')
    own('tlb', block, 'M8 8v8M16 8v8 M10 12h4m-2 -2l2 2l-2 2')
    own('mmu', 'M2 4h7v6H2z M15 14h7v6h-7z M5 10v7h10m-3 -3l3 3l-3 3 M15 4h7v6h-7z')
    own('mpu', 'M3 3h18v18H3z M3 9h18M10 9v12 M14 12l4 1v3l-2 2l-2 -2z')
    own('memory-hierarchy', 'M9 3h6v4H9z M6 10h12v4H6z M3 17h18v4H3z M12 7v3m0 4v3')
    own('sram', chip, 'M8 9h8v6H8z M12 9v6')
    own('dram', chip, 'M8 11h8m-8 3h8 M12 8v3m0 3v2')
    own('flash', chip, 'M13 7l-5 6h4l-1 4l5 -6h-4z')
    own('rom', chip, 'M8 10h8M8 14h8 M10 8v8')
    own('memory-mapped-io', 'M3 3h12v18H3z M3 9h12M3 15h12 M15 12h7m-3 -3l3 3l-3 3')
    own('address', 'M3 5h18v14H3z M3 10h18 M9 13l3 3l3 -3')
    own('data-word', reg, 'M3 3h18M3 2v2m18 -2v2')
    own('bit', 'M7 5h10v14H7z M12 9v6')
    own('byte', 'M2 6h20v12H2z M7 6v12m5 -12v12m5 -12v12 M2 12h20')
    own('bus', 'M2 8h20M2 16h20 M6 3v5m6 8v5m6 -18v5 M9 6l6 12')
    own('crossbar', 'M3 7h18M3 17h18 M7 3v18M17 3v18 M6 6h2v2H6z M16 16h2v2h-2z')
    own('bridge', 'M2 6h6v12H2z M16 6h6v12h-6z M8 10h8M8 14h8')
    own('dma', 'M2 4h6v6H2z M16 14h6v6h-6z M9 6h10v6m-3 -3l3 3l3 -3 M15 18H5v-6m-3 3l3 -3l3 3')
    own('nvic', 'M8 4h11v16H8z M2 6h6M2 12h6M2 18h6 M11 8h5m-5 4h3 M19 12h3')
    own('exception', 'M4 5h16v14H4z M12 8v5m0 3v.1 M2 12h2M20 12h2')
    own('clock', 'M2 16h5V8h5v8h5V8h5')
    own('clock-domain', 'M3 3h18v18H3z M6 15h4V9h4v6h4')
    own('power-domain', block, 'M12 8v5 M9 10a4 4 0 1 0 6 0')
    upstream('reset', 'tabler', 'restore')
    own('gpio', 'M5 4h14v16H5z M2 8h3m-3 8h3M19 8h3m-3 8h3 M9 9l-2 3l2 3m6 -6l2 3l-2 3')
    own('uart', 'M3 4v16M21 4v16 M3 8h14m-3 -3l3 3l-3 3 M21 16H7m3 -3l-3 3l3 3')
    own('spi', 'M3 3v18M21 3v18 M3 6h18M3 12h18M3 18h18 M9 4l2 2l-2 2 M15 10l-2 2l2 2')
    own('i2c', 'M3 6h18M3 12h18 M6 3v9M18 3v9 M9 12v9h6v-9')
    own('adc', 'M2 7h6l8 10h6 M2 17q3 -10 6 0 M16 7h3V3h3')
    own('dac', 'M2 17h6L16 7h6 M2 7h3V3h3 M16 17q3 -10 6 0')
    upstream('timer', 'lucide', 'timer')
    own('watchdog', 'M4 6h16v14H4z M8 3h8 M8 13h3l2 -4l2 8l2 -4h3')
    own('accelerator', chip, 'M8 8l4 4l-4 4 M12 8l4 4l-4 4')
    own('crypto-engine', chip, 'M8 11h8v6H8z M10 11V9a2 2 0 0 1 4 0v2')
    upstream('gpu', 'lucide', 'gpu')
    own('fpga', chip, 'M8 8h8v8H8z M12 8v8M8 12h8')
    upstream('asic', 'iconoir', 'electronics-chip')
    own('soc', chip, 'M8 8h4v4H8z M15 8v4 M8 15h8')
    return icons
