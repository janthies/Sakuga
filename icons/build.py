"""Rebuild the icon set from local upstream outlines and original drawings."""
from pathlib import Path
import json, xml.etree.ElementTree as ET, shutil
ROOT=Path(__file__).resolve().parent
SRC=Path('/home/jan/Documents/Claude/Sakuga-Research/tabler/package')
icons=[]
def add(name,cat,paths,source='own'):
    icons.append(dict(name=name,category=cat,source=source,paths=paths))
def tab(name,cat,file):
    paths=[]
    for el in ET.parse(SRC/'icons/outline'/f'{file}.svg').getroot():
        tag=el.tag.split('}')[-1]; a=el.attrib
        if a.get('stroke')=='none': continue
        if tag=='path': paths.append(a['d'])
        elif tag=='circle':
            x,y,r=map(float,(a['cx'],a['cy'],a['r']))
            paths.append(f'M{x-r:g} {y:g}a{r:g} {r:g} 0 1 0 {2*r:g} 0a{r:g} {r:g} 0 1 0 {-2*r:g} 0')
        elif tag=='rect':
            x,y,w,h=map(float,(a.get('x',0),a.get('y',0),a['width'],a['height']))
            r=min(float(a.get('rx',0)),w/2,h/2)
            paths.append(f'M{x+r:g} {y:g}h{w-2*r:g}q{r:g} 0 {r:g} {r:g}v{h-2*r:g}q0 {r:g} {-r:g} {r:g}h{-w+2*r:g}q{-r:g} 0 {-r:g} {-r:g}v{-h+2*r:g}q0 {-r:g} {r:g} {-r:g}z')
        elif tag=='line': paths.append(f"M{a['x1']} {a['y1']}L{a['x2']} {a['y2']}")
        elif tag in ('polyline','polygon'): paths.append('M'+a['points']+('z' if tag=='polygon' else ''))
        else: raise ValueError((file,tag))
    add(name,cat,paths,'tabler:'+file+'.svg')
mapping={
'hardware': 'cpu:cpu microcontroller:cpu-2 flash:device-sd-card sensor:radar radio:antenna server:server laptop:device-laptop phone:device-mobile iot-device:access-point network:network cloud:cloud router:router usb:usb clock:clock interrupt:bolt dma:arrows-transfer-up-down power:power reset:refresh peripheral:plug-connected',
'software': 'code:code firmware-image:file-digit file:file library:package function:function api:api process:terminal-2 thread:git-fork update:refresh-dot download:download configuration:settings log:file-text bug:bug git-branch:git-branch binary:binary bootloader:file-power',
'security': 'lock:lock unlocked:lock-open key:key shield:shield shield-check:shield-check certificate:certificate signature:signature hash:hash fingerprint:fingerprint password:password user:user authenticated-user:user-check attacker:spy malware:bug-off forbidden:forbid warning:alert-triangle verified:check failed:x eye:eye eye-off:eye-off integrity:file-check nonce:dice encryption:lock-up decryption:lock-down public-key:key private-key:lock-password',
 'trusted-computing': 'chain-of-trust:link measurement:ruler-measure attestation-evidence:file-certificate verifier:shield-search relying-party:user-shield attester:device-desktop-check secure-boot:shield-bolt privilege-level:stairs-up'
}
for cat,entries in mapping.items():
    for pair in entries.split():
        name,file=pair.split(':'); tab(name,cat,file)
# Original symbols use the same 24-unit outline grid. No text or filled shapes.
chip='M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1H6a1 1 0 0 1 -1 -1V6a1 1 0 0 1 1 -1z M9 3v2m6 -2v2M9 19v2m6 -2v2M3 9h2m-2 6h2M19 9h2m-2 6h2'
box='M4 4h16v16H4z'
lock='M9 11h6v6H9z M10 11V9a2 2 0 0 1 4 0v2'
custom={
'hardware':{
'soc':[chip,'M8 8h4v4H8z M15 8v4 M8 15h8'],
'ram':['M3 7h18v10H3z M6 10v4m4 -4v4m4 -4v4m4 -4v4 M6 17v3m4 -3v3m4 -3v3m4 -3v3'],
'rom-otp':[chip,lock],
'fuses':['M3 7h18v10H3z M5 12h5l4 -3m0 3h5'],
'cache':[chip,'M15 9h-4v6h4'],
'register':['M3 7h18v10H3z M9 7v10m6 -10v10'],
'bus':['M3 9h18M3 15h18M6 4v5m6 6v5m6 -16v5'],
'board':[box,'M8 8h6v6H8z M14 11h3v6h-6v3 M4 11h4'],
'debug-probe':['M7 4h10v11H7z M10 8h4 M12 15v4 M6 21v-2h12v2'],
},
'software':{'os-kernel':['M8 8h8v8H8z M12 3v5m0 8v5M3 12h5m8 0h5 M5 5l3 3m8 8l3 3M19 5l-3 3M8 16l-3 3']},
'security':{'key-pair':['M3 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M9 7h11m-3 0v3m3 -3v2 M15 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M4 17h11M4 17v3m3 -3v2']},
 'trusted-computing':{
 'sealed-storage':['M4 6c0 -4 16 -4 16 0c0 4 -16 4 -16 0z M4 6v12c0 4 16 4 16 0V6',lock],
 'tee':[box,lock],
 'enclave':['M3 3h18v18H3z M7 7h10v10H7z'],
 'secure-world':['M12 3l8 3v6c0 4 -4 7 -8 9c-4 -2 -8 -5 -8 -9V6z', 'M9 11h6v5H9z M10 11V9a2 2 0 0 1 4 0v2'],
 'normal-world':[box,'M8 9h8M8 13h8M8 17h4'],
 'secure-call':['M12 3v6m0 6v6M3 12h18m-4 -4l4 4l-4 4 M9 7V3h6v4 M9 17v4h6v-4'],
 'root-of-trust':['M12 3l7 3v5c0 3 -4 5 -7 7c-3 -2 -7 -4 -7 -7V6z M8 11l3 3l5 -6 M12 18v3M7 21h10'],
 'tpm':[chip,'M8 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M12 10h4v3m-2 -3v2'],
 'measured-boot':['M6 3h9l4 4v14H6z M15 3v5h4 M9 12h7M9 16h7M11 12v2m3 2v2'],
 'pcr':['M3 6h18v12H3z M8 6v12m8 -12v12 M5 21h14 M11 10h2m-2 4h2'],
 'isolation':['M3 4h7v16H3z M14 4h7v16h-7z'],
 'mpu-region':['M3 3h18v18H3z M3 10h18M10 10v11 M14 14h4v4h-4z'],
 'sau-region':['M3 3h18v18H3z M12 3v18 M15 10h4v7h-4z M16 10V8a1 1 0 0 1 2 0v2'],
}}
for cat,entries in custom.items():
    for name,paths in entries.items(): add(name,cat,paths)
# Keep categories adjacent and retain a stable order.
icons.sort(key=lambda i: (list(mapping).index(i['category']), i['name']))
from architecture import architecture, SOURCES
icons.extend(architecture())
assert len({i['name'] for i in icons}) == len(icons)
for source in ('lucide', 'iconoir'):
    license_path = SOURCES[source].parent / 'LICENSE'
    if source == 'iconoir': license_path = SOURCES[source].parents[1] / 'LICENSE'
    shutil.copyfile(license_path, ROOT/f'LICENSE-{source}.txt')
(ROOT/'icons.json').write_text(json.dumps(icons,indent=2)+'\n')
shutil.copyfile(SRC/'LICENSE', ROOT/'LICENSE-tabler.txt')
tex=['% Tabler Icons 3.49, MIT License; Copyright (c) 2020-2026 Paweł Kuna',
'% Lucide 1.59.0, ISC; Copyright (c) 2026 Lucide Icons and Contributors',
'% Iconoir 7.12.1, MIT; Copyright (c) 2021 Luca Burgio',
'% Keep LICENSE-tabler.txt, LICENSE-lucide.txt, and LICENSE-iconoir.txt with copies.',
'% Original Sakuga drawings and generated integration: MIT (see README.md).',
'% Requires TikZ and \\usetikzlibrary{svg.path}. Coordinates are in points.',
'\\tikzset{sg icon stroke/.style={draw=black!60,line width=0.6pt,line cap=round,line join=round}}']
for i in icons:
    tex += ['\\tikzset{sg icon/'+i['name']+'/.pic={%', '\\begin{scope}[x=1pt,y=1pt,scale=0.356,yscale=-1,sg icon stroke]']
    tex += ['\\draw svg "'+p+'";' for p in i['paths']]
    tex += ['\\end{scope}}}']
tex += [r'\providecommand{\sgicon}[1]{\tikz[baseline=-0.3pt]{\path[use as bounding box] (0,0) rectangle (8.544pt,8.544pt);\pic at (0,8.544pt) {sg icon/#1};}}']
(ROOT/'sakuga-icons.tex').write_text('\n'.join(tex)+'\n')
cat=[r'\documentclass[10pt,a4paper]{article}',r'\usepackage[margin=13mm]{geometry}',r'\usepackage{tikz}',r'\usepackage{graphicx}',r'\usetikzlibrary{svg.path}',r'\usepackage[T1]{fontenc}',r'\input{sakuga-icons.tex}',r'\pagestyle{empty}',r'\setlength{\parindent}{0pt}',r'\begin{document}']
categories = list(mapping) + ['architecture']
for catname in categories:
    subset=[i for i in icons if i['category']==catname]
    # Limit each architecture page to seven rows, with room for actual-size samples.
    chunks = [subset[k:k+35] for k in range(0, len(subset), 35)] if catname == 'architecture' else [subset]
    for page, chunk in enumerate(chunks):
        title = 'Computer architecture' if catname == 'architecture' else 'Sakuga icons: '+catname.replace('-', ' ').title()
        if page: title += ' (continued)'
        cat += [r'\section*{'+title+'}',r'{\small Previews at 2.5$\times$; actual icons use 0.6\,pt strokes and black!60.}\par\medskip',r'\begin{tabular}{@{}'+ 'c'*5 +r'@{}}']
        for k in range(0,len(chunk),5):
            row=[]
            for i in chunk[k:k+5]:
                label=i['name'].replace('-',r'-\allowbreak ')
                row.append(r'\begin{minipage}[c][20mm][c]{32mm}\centering\scalebox{2.5}{\sgicon{'+i['name']+r'}}\par\vspace{2mm}{\ttfamily\scriptsize '+label+r'}\end{minipage}')
            cat.append(' & '.join(row)+r' \\')
        cat += [r'\end{tabular}']
        if catname == 'architecture':
            cat += [r'\par\bigskip{\small Actual size (about 3 mm), in preview order:}\par\medskip',
                    ' '.join(r'\sgicon{'+i['name']+r'}\hspace{2mm}' for i in chunk)]
        if catname != categories[-1] or page < len(chunks)-1: cat += [r'\newpage']
cat += [r'\par\bigskip Inline sample (9 pt): {\fontsize{9}{11}\selectfont Secure \sgicon{key} key; \sgicon{tee} TEE; \sgicon{attestation-evidence} evidence.}',r'\end{document}']
(ROOT/'catalog.tex').write_text('\n'.join(cat)+'\n')
print(len(icons),'icons;',sum(i['source']=='own' for i in icons),'original')
