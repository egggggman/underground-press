"""Shared embedded faces (SIL OFL) for page furniture, boxes and comic art.

Components load as SVG images and cannot reach external files, so faces ride along as data URIs.
Full printable-ASCII subsets mean any text works."""
import base64
from pathlib import Path

HERE = Path(__file__).resolve().parent
FACES = {  # family -> (file, css extras)
    "Bangers": ("Bangers-Regular-ascii.woff", ""),
    "Bebas Neue": ("BebasNeue-Regular-ascii.woff", ""),
    "PT Serif": ("PTSerif-Regular-ascii.woff", ""),
    "PT Serif Italic": ("PTSerif-Italic-ascii.woff", ""),
    "PT Sans Narrow": ("PTSansNarrow-Regular-ascii.woff", ""),
    "PT Sans Narrow Bold": ("PTSansNarrow-Bold-ascii.woff", ""),
}
HEAD = "Bangers,Impact,'Arial Narrow Bold',sans-serif"   # page titles, box headers, comic lettering
STRIP = "'Bebas Neue','Arial Narrow',sans-serif"          # header strip, footer, small labels
SERIF = "'PT Serif',Georgia,serif"                        # body text
SERIF_I = "'PT Serif Italic','PT Serif',Georgia,serif"    # italic body (own face: SVG-as-image keeps it simple)
ALL = ("Bangers", "Bebas Neue", "PT Serif", "PT Serif Italic")  # default page-furniture set


def css(*families: str) -> str:
    return "".join(
        f"@font-face{{font-family:'{f}';src:url(data:font/woff;base64,{base64.b64encode((HERE / 'fonts' / FACES[f][0]).read_bytes()).decode()}) format('woff');}}"
        for f in (families or ALL))


def style(*families: str) -> str:
    return f"<style>{css(*families)}</style>"
