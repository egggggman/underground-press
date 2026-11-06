#!/usr/bin/env python3
"""Build Issue 001 Pages 2 and 3 (HTML master, PNG, PDF, fit report) from their COPY.md files."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import press_pages as P

OUT = P.PROD / "pages-2-3"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [("issue_001_page_2_city_beat", P.page2, P.PROD / "city-beat/COPY.md"),
            ("issue_001_page_3_neighborhood_watch", P.page3, P.PROD / "neighborhood-watch/COPY.md")]
    bad = 0
    for name, fn, copy in jobs:
        html = OUT / f"{name}.html"
        html.write_text(fn(P.parse_copy(copy)), encoding="utf-8")
        rep = P.render(html, OUT / f"{name}.png", OUT / f"{name}.pdf")
        (OUT / f"{name}.fit.json").write_text(json.dumps(rep, indent=1) + "\n")
        over = [f for f in rep["fit"] if f["overflow_px"] > 1 or f["widthOverflow_px"] > 1]
        print(name, "overflowing zones:", len(over))
        for f in over: print("   ", f)
        bad += len(over)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
