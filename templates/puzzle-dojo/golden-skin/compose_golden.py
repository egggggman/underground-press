#!/usr/bin/env python3
"""Compose the Puzzle Dojo spread, then dress it in the Golden Image print look.

The v1 compositor still places every hash-locked asset untouched. This script
only (a) replaces the flat page fill with a paper layer and (b) adds a
multiply-blended grain/ink-wear layer on top. No puzzle source is edited.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

HERE = Path(__file__).resolve().parent
V1 = HERE.parent / "v1"
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

PAPER_DEFS = """
<filter id="stain" filterUnits="userSpaceOnUse" x="0" y="0" width="792" height="1224">
  <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.006" numOctaves="4" seed="{seed}" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.52  0 0 0 0 0.40  0 0 0 0 0.20  0 0 0 1.25 -0.52"/>
</filter>
<filter id="fiber" filterUnits="userSpaceOnUse" x="0" y="0" width="792" height="1224">
  <feTurbulence type="fractalNoise" baseFrequency="0.55 0.02" numOctaves="2" seed="{seed2}" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0 0.10  0 0 0 1.6 -0.62"/>
</filter>
<filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="792" height="1224">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="{seed3}" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.20  0 0 0 0 0.14  0 0 0 0 0.07  0 0 0 2.4 -1.15"/>
</filter>
<filter id="wear" filterUnits="userSpaceOnUse" x="0" y="0" width="792" height="1224">
  <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="2" seed="{seed4}" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.93  0 0 0 0 0.85  0 0 0 0 0.65  0 0 0 5 -3.25"/>
</filter>
<filter id="bleed" filterUnits="userSpaceOnUse" x="0" y="0" width="792" height="1224">
  <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="{seed4}" result="t"/>
  <feDisplacementMap in="SourceGraphic" in2="t" scale="0.9" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feGaussianBlur in="d" stdDeviation="0.22"/>
</filter>
<radialGradient id="vignette" cx="50%" cy="48%" r="75%">
  <stop offset="0.55" stop-color="#5a3a14" stop-opacity="0"/>
  <stop offset="1" stop-color="#4a2c0c" stop-opacity="0.38"/>
</radialGradient>
<pattern id="halftone" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
  <circle cx="2" cy="2" r="0.55" fill="#3a2810" fill-opacity="0.10"/>
</pattern>
"""


def load_v1():
    spec = importlib.util.spec_from_file_location("puzzle_dojo_compose_v1", V1 / "compose.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def q(tag: str) -> str:
    return f"{{{SVG_NS}}}{tag}"


def paper_layer(page: int) -> ET.Element:
    group = ET.Element(q("g"), {"id": f"paper-{page}"})
    ET.SubElement(group, q("rect"), {"width": "792", "height": "1224", "fill": "#E9D6A4"})
    ET.SubElement(group, q("rect"), {"width": "792", "height": "1224", "filter": "url(#stain)"})
    ET.SubElement(group, q("rect"), {"width": "792", "height": "1224", "filter": "url(#fiber)", "opacity": "0.18"})
    ET.SubElement(group, q("rect"), {"width": "792", "height": "1224", "fill": "url(#vignette)"})
    return group


def finish_layer(page: int) -> ET.Element:
    group = ET.Element(q("g"), {"id": f"finish-{page}", "style": "mix-blend-mode:multiply", "pointer-events": "none"})
    ET.SubElement(group, q("rect"), {"width": "792", "height": "1224", "fill": "url(#halftone)"})
    ET.SubElement(group, q("rect"), {"width": "792", "height": "1224", "filter": "url(#grain)", "opacity": "0.22"})
    wear = ET.Element(q("g"), {"id": f"wear-{page}", "pointer-events": "none"})
    ET.SubElement(wear, q("rect"), {"width": "792", "height": "1224", "filter": "url(#wear)", "opacity": "0.30"})
    return group, wear


def dress(plain: Path, out: Path, seed: int) -> None:
    tree = ET.parse(plain)
    root = tree.getroot()
    defs = ET.fromstring(
        f'<defs xmlns="{SVG_NS}">'
        + PAPER_DEFS.format(seed=seed, seed2=seed + 7, seed3=seed + 13, seed4=seed + 29)
        + "</defs>"
    )
    root.insert(2, defs)
    for page_group in [g for g in root if g.tag == q("g") and g.get("id", "").startswith("page-")]:
        page = page_group.get("id").split("-")[1]
        children = list(page_group)
        flat = children[0]  # v1's hard-coded cream rect
        content = children[1:]
        for child in children:
            page_group.remove(child)
        page_group.append(paper_layer(page))
        inked = ET.SubElement(page_group, q("g"), {"id": f"ink-{page}", "filter": "url(#bleed)", "style": "mix-blend-mode:multiply"})
        for child in content:
            inked.append(child)
        multiply, wear = finish_layer(page)
        page_group.append(multiply)
        page_group.append(wear)
    out.parent.mkdir(parents=True, exist_ok=True)
    tree.write(out, encoding="utf-8", xml_declaration=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assets", type=Path, help="zone-to-asset JSON map (see assets.golden.json)")
    parser.add_argument("output", type=Path, help="dressed spread SVG")
    parser.add_argument("--seed", type=int, default=1991, help="paper texture seed (change per issue)")
    args = parser.parse_args()
    v1 = load_v1()
    plain = args.output.with_name(args.output.stem + ".plain.svg")
    v1.compose((HERE / "layout_contract.golden.json").resolve(), args.assets.resolve(), plain.resolve(), False)
    dress(plain, args.output, args.seed)
    print(json.dumps({"plain": str(plain), "dressed": str(args.output), "seed": args.seed}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
