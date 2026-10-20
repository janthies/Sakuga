"""Combine the rasterized PDF pages into the review catalog."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent
pages=[Image.open(p).convert('RGB') for p in sorted(root.glob('catalog-page-*.png'), key=lambda p: int(p.stem.rsplit('-', 1)[1]))]
assert pages, 'Rasterize catalog.pdf first'
w=max(p.width for p in pages); h=max(p.height for p in pages)
out=Image.new('RGB',(2*w,((len(pages)+1)//2)*h),(230,230,230))
for k,p in enumerate(pages): out.paste(p,((k%2)*w,(k//2)*h))
out.save(root/'catalog.png')
