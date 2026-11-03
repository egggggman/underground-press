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
    # Second handoff (five new ads): manifest rows are keyed by path, not filename.
    for r in csv.DictReader((LIB / "handoff_2026-11-02_five_new/ASSET_MANIFEST.csv").open(encoding="utf-8-sig")):
        manifest[Path(r["path"]).name] = {"sha256": r["sha256"]}
    for sheet in data.get("sheets", []):
        sp = LIB / sheet["file"]
        if not sp.is_file() or digest(sp) != sheet["sha256"] or manifest.get(sp.name, {}).get("sha256") != sheet["sha256"]:
            errors.append(f"approved sheet missing, changed or not in manifest: {sheet['file']}")
    listed = {s["file"] for s in data.get("sheets", [])}
    from PIL import Image
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
        for key in ("tight_crop_v2", "lettering_revision"):
            rev = ad.get(key)
            if rev:
                listed.add(rev["file"])
                rp = LIB / rev["file"]
                if not rp.is_file() or digest(rp) != rev["sha256"]:
                    errors.append(f"{key} missing or changed: {rev['file']}")
                else:
                    with Image.open(rp) as im:
                        if (im.width, im.height) != (rev["width_px"], rev["height_px"]):
                            errors.append(f"{key} dimension mismatch: {rev['file']}")
        for prev in ad["previous_versions"]:
            listed.add(prev["file"])
            p = LIB / prev["file"]
            if not p.is_file() or digest(p) != prev["sha256"]:
                errors.append(f"previous version missing or changed: {prev['file']}")
    for cand in data.get("candidates", []):
        listed.add(cand["file"])
        cp = LIB / cand["file"]
        if not cp.is_file() or digest(cp) != cand["sha256"]:
            errors.append(f"candidate missing or changed: {cand['file']}")
        else:
            with Image.open(cp) as im:
                if (im.width, im.height) != (cand["width_px"], cand["height_px"]):
                    errors.append(f"candidate dimension mismatch: {cand['file']}")
    for rej in data.get("rejected_attempts", []):
        listed.add(rej["file"])
        rp = LIB / rej["file"]
        if not rp.is_file() or digest(rp) != rej["sha256"]:
            errors.append(f"rejected-attempt record missing or changed: {rej['file']}")
    for folder in ("approved", "approved_sheets", "approved_v2", "revisions", "candidates", "rejected", "previous_versions"):
        for f in (LIB / folder).glob("*"):
            if f.is_file() and f"{folder}/{f.name}" not in listed:
                errors.append(f"file not recorded in ad_library.json: {folder}/{f.name}")
    if set(manifest) != {Path(a["file"]).name for a in data["ads"]} | {Path(s["file"]).name for s in data.get("sheets", [])}:
        errors.append("handoff manifest and ad_library.json list different files")
    if errors:
        print("\n".join(f"- {e}" for e in errors))
        return 1
    print(f"Ad library verified: {len(data['ads'])} approved assets, hashes and dimensions match the handoff manifest.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
