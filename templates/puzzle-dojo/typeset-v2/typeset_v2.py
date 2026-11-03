#!/usr/bin/env python3
"""Re-typeset the Issue #1 puzzle assets in the Puzzle Dojo comic/newsprint fonts (v2).

The locked originals are PDF extractions whose lettering is outline glyphs, each tagged with its
character (`data-text`). v2 keeps every non-text element byte-for-byte, drops the glyph outlines and
sets the same characters as live <text> at the same baselines and positions. The originals are
never modified. `verify_v2.py` proves the text and the geometry match.

    python typeset_v2.py ../../../issues/issue_001/assets/puzzle-dojo ../../../issues/issue_001/assets/puzzle-dojo/v2
"""
from __future__ import annotations

import base64
import re
import sys
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path
from xml.sax.saxutils import escape

from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
FONTS = HERE.parent / "golden-skin" / "fonts"
LIB = Path("/usr/share/fonts/truetype/liberation")  # metric stand-ins for the original Arial/Times widths

# family -> (css name, woff file)
FACE = {
    "bang": ("Bangers", "Bangers-Regular-ascii.woff"),
    "bebas": ("Bebas Neue", "BebasNeue-Regular-ascii.woff"),
    "serif": ("PT Serif", "PTSerif-Regular-ascii.woff"),
    "serifi": ("PT Serif Italic", "PTSerif-Italic-ascii.woff"),
    "narrow": ("PT Sans Narrow", "PTSansNarrow-Regular-ascii.woff"),
    "narrowb": ("PT Sans Narrow Bold", "PTSansNarrow-Bold-ascii.woff"),
}

# original glyph-font id -> role, selected by (id, size) -> (face, size multiplier, anchor, letter-spacing)
def role(fid: str, size: float):
    if fid == "3":
        if size > 10:
            return ("bebas", 1.30, "single-or-left", 0.4)   # sudoku givens, cipher text
        return ("bang", 1.18, "left", 0.6)                     # ACROSS / DOWN
    if fid == "5":
        return ("bang", 1.12, "center", 1.0)                   # panel header bars
    if fid == "6":
        return ("serifi", 1.12, "center", 0)                   # subtitles
    if fid == "7":
        if size < 4:
            return ("narrowb", 1.10, "left", 0)                # crossword cell numbers
        return ("narrow", 1.22, "left", 0)                     # clues
    if fid == "8":
        return ("serif", 1.0, "left", 0)                       # cipher instruction
    raise KeyError(fid)


@lru_cache(maxsize=None)
def metrics(fname: str, lib: bool = False):
    f = TTFont((LIB if lib else FONTS) / fname)
    return f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm


def width(text: str, fname: str, size: float, lib: bool = False, ls: float = 0.0) -> float:
    cmap, hmtx, upm = metrics(fname, lib)
    return sum(hmtx[cmap.get(ord(c), cmap.get(32))][0] for c in text) * size / upm + ls * len(text)


NUM = re.compile(r"-?\d*\.?\d+(?:e-?\d+)?")


def glyph_xspan(d: str) -> tuple[float, float]:
    """Approximate ink x-extent (em units) of an outline path with absolute commands."""
    xs: list[float] = []
    for cmd, args in re.findall(r"([MLHVCQZ])([^MLHVCQZ]*)", d):
        nums = [float(n) for n in NUM.findall(args)]
        if cmd in "MLCQ":
            xs += nums[0::2]
        elif cmd == "H":
            xs += nums
    return (min(xs), max(xs)) if xs else (0.0, 0.0)


USE = re.compile(r'<use data-text="([^"]*)" xlink:href="#font_(\d+)_(\d+)" transform="matrix\(([^)]*)\)" fill="([^"]*)"/>')
DEF = re.compile(r'<path id="font_\d+_\d+" d="[^"]*"/>\n?')


def parse_uses(svg: str, W: float, H: float):
    glyphs = {m.group(1): glyph_xspan(m.group(2)) for m in re.finditer(r'<path id="(font_\d+_\d+)" d="([^"]*)"', svg)}
    items = []
    for m in USE.finditer(svg):
        ch, fid, gid, t, fill = m.groups()
        a = [float(v) for v in t.split(",")]
        size, x, y = a[0], a[4], a[5]
        inside = -2 <= x <= W + 2 and -2 <= y <= H + 8
        items.append(dict(span=m.span(), ch=ch, fid=fid, size=size, x=x, y=y, fill=fill,
                          span_x=glyphs[f"font_{fid}_{gid}"], inside=inside))
    return items


def build_runs(items):
    runs, cur = [], None
    for it in items:
        if not it["inside"]:
            continue
        if (cur and it["fid"] == cur[-1]["fid"] and it["fill"] == cur[-1]["fill"] and abs(it["size"] - cur[-1]["size"]) < 1e-6
                and abs(it["y"] - cur[-1]["y"]) < 0.01 and 0 < it["x"] - cur[-1]["x"] <= 1.3 * it["size"]):
            cur.append(it)
        else:
            cur = [it]
            runs.append(cur)
    return runs


def run_element(run) -> str:
    first, last = run[0], run[-1]
    text = "".join(i["ch"] for i in run).rstrip()
    run = run[: len(text)]
    last = run[-1]
    size = first["size"]
    face, k, anchor, ls = role(first["fid"], size)
    css, fname = FACE[face]
    ink_l = first["x"] + first["span_x"][0] * size
    ink_r = last["x"] + last["span_x"][1] * size
    orig_w = max(ink_r - ink_l, 0.1)
    new_size = size * k
    new_w = width(text, fname, new_size, ls=ls)
    if len(run) == 1 and anchor == "single-or-left":
        anchor = "center"
    center = anchor == "center"
    cap = orig_w * (1.25 if center else 1.0)
    if len(run) > 1 and new_w > cap:
        new_size *= cap / new_w
    x = (ink_l + ink_r) / 2 if center else first["x"]
    attrs = f'x="{x:.3f}" y="{first["y"]:.3f}" font-family="\'{css}\'" font-size="{new_size:.3f}" fill="{first["fill"]}"'
    if center:
        attrs += ' text-anchor="middle"'
    if ls:
        attrs += f' letter-spacing="{ls}"'
    return f'<text {attrs}>{escape(text)}</text>'


def typeset_pdf_asset(src: Path, dst: Path, W: float, H: float, faces: set[str]) -> None:
    svg = src.read_text(encoding="utf-8")
    items = parse_uses(svg, W, H)
    runs = build_runs(items)
    repl = {r[0]["span"]: run_element(r) for r in runs}
    drop = {it["span"] for it in items}
    out, pos = [], 0
    for it in items:
        s, e = it["span"]
        out.append(svg[pos:s])
        out.append(repl.get((s, e), ""))
        pos = e
    out.append(svg[pos:])
    new = "".join(out)
    new = DEF.sub("", new)
    css = "".join(
        f"@font-face{{font-family:'{FACE[f][0]}';src:url(data:font/woff;base64,{base64.b64encode((FONTS / FACE[f][1]).read_bytes()).decode()}) format('woff');}}"
        for f in sorted(faces))
    new = new.replace("</defs>", f"<style>{css}</style>\n</defs>", 1)
    dst.write_text(new, encoding="utf-8")


def typeset_neighborhood(src: Path, dst: Path) -> None:
    """Hand-structured SVG with live text: swap faces, keep every x/y."""
    svg = src.read_text(encoding="utf-8")
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ns = "{http://www.w3.org/2000/svg}"
    root = ET.fromstring(svg)

    def swap(el, inherited):
        attrs = dict(inherited)
        for k in ("font-family", "font-size", "font-weight", "font-style", "fill"):
            if el.get(k):
                attrs[k] = el.get(k)
        if el.tag == ns + "text" and el.text:
            fam, size = attrs.get("font-family", ""), float(attrs.get("font-size", 16))
            bold, ital = attrs.get("font-weight") == "700", attrs.get("font-style") == "italic"
            text = el.text
            x, y = float(el.get("x")), float(el.get("y"))
            fill = attrs.get("fill", "#000")
            for k in ("font-family", "font-size", "font-weight", "font-style"):
                el.attrib.pop(k, None)
            if "Courier" in fam:  # grid rows: re-place each letter at the original monospace pitch
                letters = text.split(" ")
                pitch = 0.6 * size * 2
                parent_children.append((el, [(x + i * pitch + 0.3 * size, y, c) for i, c in enumerate(letters)], size, fill))
                return
            if "Georgia" in fam:
                face, ns_ = "bang", size * 1.1
            elif ital:
                face, ns_ = "serifi", size * 1.05
            elif bold and size >= 13 and el.get("fill") in ("#7a2933",) :
                face, ns_ = "bebas", size * 1.2
            elif bold:
                face, ns_ = "bebas", size * 1.25
            else:
                face, ns_ = "narrow", size * 1.15
            css, fname = FACE[face]
            orig = width(text, "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf", size, lib=True)
            if face == "bang":
                orig = width(text, "LiberationSerif-Bold.ttf", size, lib=True)
            nw = width(text, fname, ns_)
            if nw > orig:
                ns_ *= orig / nw
            el.set("font-family", f"'{css}'")
            el.set("font-size", f"{ns_:.2f}")
            used.add(face)
            if bold and face == "bebas":
                el.set("letter-spacing", "0.5")
        for ch in list(el):
            swap(ch, attrs)

    parent_children: list = []
    used: set[str] = {"bebas"}
    swap(root, {})
    for el, letters, size, fill in parent_children:
        parent = next(p for p in root.iter() if el in list(p))
        idx = list(parent).index(el)
        parent.remove(el)
        for j, (x, y, c) in enumerate(letters):
            t = ET.Element(ns + "text", {"x": f"{x:.2f}", "y": f"{y:.2f}", "text-anchor": "middle",
                                           "font-family": "'Bebas Neue'", "font-size": f"{size * 1.2:.2f}", "fill": fill})
            t.text = c
            parent.insert(idx + j, t)
    css = "".join(
        f"@font-face{{font-family:'{FACE[f][0]}';src:url(data:font/woff;base64,{base64.b64encode((FONTS / FACE[f][1]).read_bytes()).decode()}) format('woff');}}"
        for f in sorted(used))
    style = ET.Element(ns + "style")
    style.text = css
    root.insert(0, style)
    ET.ElementTree(root).write(dst, encoding="utf-8", xml_declaration=True)


def main() -> int:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    jobs = {
        "sudoku.svg": (272, 323, {"bang", "bebas", "serifi"}),
        "crossword.svg": (468, 383, {"bang", "serifi", "narrowb"}),
        "crossword-clues.svg": (468, 174, {"bang", "narrow"}),
        "pizza-cipher.svg": (367, 142, {"bang", "bebas", "serif"}),
    }
    for name, (w, h, faces) in jobs.items():
        typeset_pdf_asset(src / name, dst / name, w, h, faces)
        print(dst / name, (dst / name).stat().st_size)
    typeset_neighborhood(src / "neighborhood-search.svg", dst / "neighborhood-search.svg")
    print(dst / "neighborhood-search.svg")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
