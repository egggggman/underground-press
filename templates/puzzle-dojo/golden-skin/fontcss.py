"""Shared embedded display faces (SIL OFL: Anton, Bebas Neue) for page furniture and boxes.

Components are loaded as SVG images and cannot reach external files, so the faces ride along as
data URIs. Full printable-ASCII subsets mean any headline text works."""
import base64
from pathlib import Path

HERE = Path(__file__).resolve().parent
FACES = {"Anton": "Anton-Regular-ascii.woff", "Bebas Neue": "BebasNeue-Regular-ascii.woff"}
HEAD = "Anton,Impact,'Arial Narrow Bold',sans-serif"      # page titles, box headers
STRIP = "'Bebas Neue','Arial Narrow',sans-serif"          # header strip, footer, labels


def style(*families: str) -> str:
    css = "".join(
        f"@font-face{{font-family:'{f}';src:url(data:font/woff;base64,{base64.b64encode((HERE / 'fonts' / FACES[f]).read_bytes()).decode()}) format('woff');}}"
        for f in families)
    return f"<style>{css}</style>"
