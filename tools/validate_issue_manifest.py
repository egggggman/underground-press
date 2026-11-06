#!/usr/bin/env python3
"""Validate the Issue 001 page manifest (issues/issue_001/production/issue_001_manifest.json).

Checks: every page of the 10-page plan appears once; statuses are legal; every source records a SHA-256;
sources on main exist and match their hash; READY pages have no blockers and all-main sources; MISSING pages
list no sources; the gate and return status agree with the page statuses. It does not build or approve anything.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "issues/issue_001/production/issue_001_manifest.json"
STATUSES = {"READY", "PARTIAL", "MISSING"}
HEX = re.compile(r"^[0-9a-f]{64}$")
PLAN = [1, 2, 3, 4, 5, 6, 7, "8-9", 10]


def sources(page: dict):
    for key in ("source_layouts", "artwork"):
        yield from page.get(key, [])
    if "benchmark" in page:
        yield page["benchmark"]
    content = page.get("content", {})
    if "path" in content:
        yield content


def main() -> int:
    errors: list[str] = []
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    pages = data["pages"]
    if [p["page"] for p in pages] != PLAN:
        errors.append(f"pages must be exactly {PLAN} in order")
    for p in pages:
        label = f"page {p['page']}"
        if p["status"] not in STATUSES:
            errors.append(f"{label}: illegal status {p['status']!r}")
        for s in sources(p):
            if not HEX.match(s.get("sha256", "")):
                errors.append(f"{label}: {s.get('path')} has no valid sha256")
            if s.get("location") == "main":
                f = ROOT / s["path"]
                if not f.is_file():
                    errors.append(f"{label}: missing on main: {s['path']}")
                elif hashlib.sha256(f.read_bytes()).hexdigest() != s["sha256"]:
                    errors.append(f"{label}: hash mismatch on main: {s['path']}")
            elif s.get("location") == "unmerged":
                if not s.get("ref") or not s.get("pr"):
                    errors.append(f"{label}: unmerged source needs ref and pr: {s.get('path')}")
            else:
                errors.append(f"{label}: source location must be 'main' or 'unmerged': {s.get('path')}")
        if p["status"] == "READY":
            if p["blockers"]:
                errors.append(f"{label}: READY page lists blockers")
            if not p["source_layouts"] or any(s["location"] != "main" for s in p["source_layouts"]):
                errors.append(f"{label}: READY needs source layouts on main")
        if p["status"] == "MISSING" and p["source_layouts"]:
            errors.append(f"{label}: MISSING page lists source layouts")
        if p["status"] != "READY" and not p["outstanding"]:
            errors.append(f"{label}: non-READY page must say what is outstanding")
    ready = all(p["status"] == "READY" for p in pages)
    gate = data["gate"]
    if gate["all_10_pages_have_source_layouts"] != all(p["source_layouts"] for p in pages):
        errors.append("gate.all_10_pages_have_source_layouts disagrees with the pages")
    expected = "READY FOR ASSEMBLY" if ready and all(gate.values()) else "BLOCKED"
    if data["return_status"] != expected:
        errors.append(f"return_status should be {expected}")
    if errors:
        print("\n".join(f"- {e}" for e in errors))
        return 1
    counts = {s: sum(p["status"] == s for p in pages) for s in sorted(STATUSES)}
    print(f"Issue 001 manifest valid: {len(pages)} page entries {counts}; return status {data['return_status']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
