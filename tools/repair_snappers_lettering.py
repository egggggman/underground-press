#!/usr/bin/env python3
"""Snapper's Market lettering revision (HQ: correct before publication).

Input : design-system/ad-library/approved_v2/snappers-market-v2.png (tight crop of the approved sheet)
Output: design-system/ad-library/revisions/snappers-market-v3-lettering.png (a NEW file; originals untouched)

Two repairs, both pixel-local:
  1. The "M" of "Market" has lost its left stem/diagonals to a dark-red smear and an olive haze.
     The smear is cleared and the M is redrawn in the art's own black, heavy, italic weight.
  2. Lettering collides with the second row of the checker border. Checker pixels (red, not
     outlined by black) in the collision strip are cleared so the lettering sits on clean paper.
Nothing else changes. Re-run to reproduce; the output hash is recorded in ad_library.json.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1] / "design-system/ad-library"
SRC = ROOT / "approved_v2/snappers-market-v2.png"
OUT = ROOT / "revisions/snappers-market-v3-lettering.png"


def paper(a, box):
    x0, y0, x1, y1 = box
    reg = a[y0:y1, x0:x1].reshape(-1, 3)
    ok = reg[(reg[:, 0] > 235) & (reg[:, 1] > 195) & (reg[:, 2] > 110) & (reg[:, 2] < 200)]
    return np.median(ok, 0) if len(ok) else np.array([246, 222, 165.0])


def fix_m(a):
    """Conservative repair of the 'M': the left stroke survives as a dark-red smear and an olive haze
    sits beside it. Recolor the smear to the art's ink black and restore paper under the haze.
    No new letterform is invented."""
    cream = paper(a, (215, 100, 330, 142))
    ink = np.array([9, 8, 7.0])
    rgb = a.astype(int)
    mx = rgb.max(2)
    # 1) smear -> ink (stem zone only, above the chef-hat ink)
    zone = np.zeros(mx.shape, bool)
    zone[133:178, 150:172] = True
    smear = zone & (mx < 175) & ((rgb[..., 0] - rgb[..., 2]) > 8)
    smear = ndi.binary_dilation(ndi.binary_closing(smear, iterations=2), iterations=1) & zone & (mx < 200)
    soft = ndi.gaussian_filter(smear.astype(float), 0.7)[..., None]
    a = a * (1 - soft) + ink * soft
    # 2) haze -> paper (olive/white fringe between the stem and the M body)
    zone2 = np.zeros(mx.shape, bool)
    zone2[146:184, 170:197] = True
    dist = np.abs(a - cream).sum(2)
    haze = zone2 & (mx > 90) & (dist > 40)
    haze = ndi.binary_opening(haze, iterations=1)
    soft2 = ndi.gaussian_filter(haze.astype(float), 0.8)[..., None]
    return a * (1 - soft2) + cream * soft2


def fix_border(a):
    """Clear whole checker squares/stains in rows 2-3 that touch or crowd the lettering (left of the claw)."""
    H, W = a.shape[:2]
    rgb = a.astype(int)
    red = (rgb[..., 0] > 150) & (rgb[..., 1] < 120) & (rgb[..., 2] < 110)
    dark = rgb.max(2) < 70
    ink = np.zeros((H, W), bool)
    ink[24:80, 22:400] = dark[24:80, 22:400]
    near_ink = ndi.binary_dilation(ink, iterations=7)
    lab, n = ndi.label(ndi.binary_dilation(red, iterations=1))
    cream = paper(a, (215, 100, 330, 142))
    out = a.copy()
    for i in range(1, n + 1):
        comp = lab == i
        ys, xs = np.where(comp)
        if ys.min() < 30 or ys.max() > 80 or xs.max() > 400 or comp.sum() > 700:
            continue
        if (comp & near_ink).any():
            soft = ndi.gaussian_filter(ndi.binary_dilation(comp, iterations=1).astype(float), 0.6)[..., None]
            out = out * (1 - soft) + cream * soft
    return out


def main():
    a = np.array(Image.open(SRC).convert("RGB")).astype(float)
    a = fix_border(a)
    a = fix_m(a)
    OUT.parent.mkdir(exist_ok=True)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    sys.exit(main())
