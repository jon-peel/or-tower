# Clean the magic-wand fringe from the 4x upscaled tower.
# 1. Peel light (non-outline) pixels inward from the outside, max PEEL px, stopping at the dark outline.
# 2. Clear trapped background: cool near-white regions inside the silhouette (sky seen through gaps).
# 3. Drop small specks detached from the main tower.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
PEEL = 10            # max pixels to peel at 4x (~2.5 px of the original)
OUTLINE_LUM = 95     # pixels darker than this are the black outline: never peeled
SPECK_PX = 400       # detached blobs smaller than this are removed

im = np.array(Image.open(src).convert('RGBA')).astype(np.int32)
rgb, a = im[..., :3], im[..., 3]
lum = (rgb[..., 0] * 299 + rgb[..., 1] * 587 + rgb[..., 2] * 114) // 1000
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

solid = a >= 40
removed_peel = 0
for _ in range(PEEL):
    outside = ~solid
    touching = ndimage.binary_dilation(outside, structure=np.ones((3, 3))) & solid
    peel = touching & ((lum > OUTLINE_LUM) | (a < 200))
    n = int(peel.sum())
    if n == 0:
        break
    solid &= ~peel
    removed_peel += n

# Trapped background: cool, light pixels (sky/white), seeded by near-white cool pixels.
# Colour alone can't tell background from the white radar or blue glass, so only look inside
# regions identified by eye as background seen through a gap (4x coordinates).
TRAPPED_BOXES = [(120, 955, 170, 1025)]  # under the left wall's notch
in_box = np.zeros_like(solid)
for x0, y0, x1, y1 in TRAPPED_BOXES:
    in_box[y0:y1, x0:x1] = True
cool_light = solid & in_box & (lum > 140) & (b >= r) & (b >= g - 6)
seed = solid & (lum > 225) & (b >= r - 2)
labels, n = ndimage.label(cool_light, structure=np.ones((3, 3)))
trapped = np.zeros_like(solid)
print('trapped-background candidates (label: pixels, bbox x0,y0-x1,y1, mean rgb):')
for i, sl in enumerate(ndimage.find_objects(labels), start=1):
    comp = labels[sl] == i
    size = int(comp.sum())
    if size < 60 or not seed[sl][comp].any():
        continue
    ys, xs = sl
    mean = rgb[sl][comp].mean(axis=0).astype(int).tolist()
    print(f'  {i}: {size}px  {xs.start},{ys.start}-{xs.stop},{ys.stop}  {mean}')
    trapped[sl] |= comp
solid &= ~trapped

# Specks: keep only blobs attached to something big.
labels, n = ndimage.label(solid, structure=np.ones((3, 3)))
sizes = ndimage.sum(solid, labels, range(1, n + 1))
keep = np.isin(labels, [i + 1 for i, s in enumerate(sizes) if s >= SPECK_PX])
specks = int((solid & ~keep).sum())
solid &= keep

# Soften the new edge by one pixel so it doesn't look jagged.
alpha = np.where(solid, a, 0).astype(np.float32)
edge = solid & ndimage.binary_dilation(~solid, structure=np.ones((3, 3)))
alpha[edge] = np.minimum(alpha[edge], 200)

out = im.copy()
out[..., 3] = alpha.astype(np.int32)
Image.fromarray(out.astype(np.uint8), 'RGBA').save(dst, optimize=True)
print(f'peeled {removed_peel}px of halo, cleared {int(trapped.sum())}px trapped background, removed {specks}px of specks')
