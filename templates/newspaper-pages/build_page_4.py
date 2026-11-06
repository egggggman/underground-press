#!/usr/bin/env python3
"""Build Issue 001 Page 4 (Editorial & Opinion): HTML master, PNG, PDF and fit report from SELECTION.json."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import press_pages as P
import press_page4 as P4

OUT = P.PROD / "page-4"
NAME = "issue_001_page_4_editorial_opinion"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    html = OUT / f"{NAME}.html"
    html.write_text(P4.page4(P4.load_selection()), encoding="utf-8")
    rep = P.render(html, OUT / f"{NAME}.png", OUT / f"{NAME}.pdf")
    (OUT / f"{NAME}.fit.json").write_text(json.dumps(rep, indent=1) + "\n")
    over = [f for f in rep["fit"] if f["overflow_px"] > 1 or f["widthOverflow_px"] > 1]
    print(NAME, "overflowing zones:", len(over))
    for f in over:
        print("   ", f)
    return 1 if over else 0


if __name__ == "__main__":
    sys.exit(main())
