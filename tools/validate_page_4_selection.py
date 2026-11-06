#!/usr/bin/env python3
"""Check Issue 001 Page 4 against its editorial selection.

Every selected ID must exist in its inventory with status approved-inventory, and every selected headline,
body and byline must appear verbatim (ignoring display case and line breaks) in the Page 4 HTML master. Proves nothing was rewritten;
it does not approve the selection.
"""
from __future__ import annotations

import json
import re
import sys
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEL = ROOT / "issues/issue_001/production/editorial/SELECTION.json"
HTML = ROOT / "issues/issue_001/production/page-4/issue_001_page_4_editorial_opinion.html"


def main() -> int:
    sel = json.loads(SEL.read_text(encoding="utf-8"))
    inv = {}
    for name in ("editorials", "letters", "polls"):
        for item in json.loads((ROOT / f"content/{name}/inventory.json").read_text(encoding="utf-8")):
            inv[item["id"]] = item
    raw = HTML.read_text(encoding="utf-8")
    raw = re.sub(r"<style>.*?</style>", " ", raw, flags=re.S)
    text = " ".join(unescape(re.sub(r"<[^>]+>", " ", raw)).split()).casefold()

    def printed(s: str) -> bool:  # verbatim apart from display case and line breaks
        return " ".join(s.split()).casefold() in text
    ids = [sel["lead_editorial"], *sel["board_editorials"], sel["seagullotine"], *sel["letters"], sel["poll"]]
    errors = []
    if len(set(ids)) != len(ids):
        errors.append("selection repeats an ID")
    for i in ids:
        item = inv.get(i)
        if not item:
            errors.append(f"{i}: not in inventory"); continue
        if item["status"] != "approved-inventory":
            errors.append(f"{i}: status {item['status']!r}")
        for field in ("body", "byline", "prompt", "method", "disclaimer"):
            if item.get(field) and not printed(item[field]):
                errors.append(f"{i}: {field} not printed verbatim")
        head = item.get("headline")
        if head and not all(printed(part) for part in head.split(":")):
            errors.append(f"{i}: headline not printed verbatim")
    if errors:
        print("\n".join(f"- {e}" for e in errors))
        return 1
    print(f"Page 4 selection valid: {len(ids)} inventory items printed verbatim; status {sel['status']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
