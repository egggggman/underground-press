#!/usr/bin/env python3
"""Verify the approved ad library: files, SHA-256, dimensions, manifest agreement, no stray files."""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "design-system/ad-library"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    errors: list[str] = []
    data = json.loads((LIB / "ad_library.json").read_text(encoding="utf-8"))
    manifest = {r["filename"]: r for r in csv.DictReader((LIB / "handoff_2026-11-02/ASSET_MANIFEST.csv").open(encoding="utf-8-sig"))}
    listed = set()
    try:
        from PIL import Image
    except ImportError:
        Image = None
    for ad in data["ads"]:
        path = LIB / ad["file"]
        listed.add(ad["file"])
        if not path.is_file():
            errors.append(f"missing approved asset: {ad['file']}")
            continue
        if digest(path) != ad["sha256"]:
            errors.append(f"hash mismatch (approved art was changed): {ad['file']}")
        m = manifest.get(path.name)
        if not m or m["sha256"] != ad["sha256"]:
            errors.append(f"library and handoff manifest disagree: {ad['file']}")
        if Image:
            with Image.open(path) as im:
                if f"{im.width}x{im.height}" != f"{ad['width_px']}x{ad['height_px']}":
                    errors.append(f"dimension mismatch: {ad['file']}")
        for prev in ad["previous_versions"]:
            listed.add(prev["file"])
            p = LIB / prev["file"]
            if not p.is_file() or digest(p) != prev["sha256"]:
                errors.append(f"previous version missing or changed: {prev['file']}")
    for folder in ("approved", "previous_versions"):
        for f in (LIB / folder).glob("*"):
            if f.is_file() and f"{folder}/{f.name}" not in listed:
                errors.append(f"file not recorded in ad_library.json: {folder}/{f.name}")
    if set(manifest) != {Path(a["file"]).name for a in data["ads"]}:
        errors.append("handoff manifest and ad_library.json list different files")
    if errors:
        print("\n".join(f"- {e}" for e in errors))
        return 1
    print(f"Ad library verified: {len(data['ads'])} approved assets, hashes and dimensions match the handoff manifest.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
