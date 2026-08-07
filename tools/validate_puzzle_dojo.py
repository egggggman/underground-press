#!/usr/bin/env python3
"""Validate Puzzle Dojo contract, immutable sources, components, and proof."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "issues/issue_001/assets/puzzle-dojo"
CONTRACT = ROOT / "templates/puzzle-dojo/v1/layout_contract.json"
COMPOSITION = ASSETS / "composition.json"
PROOF = ROOT / "issues/issue_001/production/puzzle-dojo/issue_001_pages_8_9.svg"
SIDECAR = PROOF.with_suffix(".svg.json")
LOCKED = {
    "crossword.svg": "a38e947c768cc280d1f24d71fa70da34b1defc19b440aae7796d7dcfbb68bb9f",
    "crossword-clues.svg": "1a6a3db6d9d171033dd86747ab96222c844e565d0fe048aae85d3f0407b7de51",
    "sudoku.svg": "0e9adf56396e614b17ee1a7a977093c805b82f3ad95ed30dc3a088c3b898f375",
    "pizza-cipher.svg": "aeb98f3d6f6ddf2f390899bb71f528329adb205907854fdedcd28e074d2b07a1",
    "brain-bender.svg": "12c11866cece1484e6ac548a75f23c9476c5e779716f2aa05032b2ecc40fcba2",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fail(message: str) -> None:
    raise ValueError(message)


def main() -> int:
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    composition = json.loads(COMPOSITION.read_text(encoding="utf-8"))
    report = json.loads(SIDECAR.read_text(encoding="utf-8"))
    width = contract["coordinate_system"]["page_width"]
    height = contract["coordinate_system"]["page_height"]
    zones = {}
    for page in contract["pages"]:
        for zone in page["zones"]:
            if zone["id"] in zones:
                fail(f"duplicate zone: {zone['id']}")
            if min(zone["width"], zone["height"]) <= 0:
                fail(f"empty zone: {zone['id']}")
            if zone["x"] < 0 or zone["y"] < 0 or zone["x"] + zone["width"] > width or zone["y"] + zone["height"] > height:
                fail(f"out-of-bounds zone: {zone['id']}")
            zones[zone["id"]] = zone
    required = {key for key, value in zones.items() if value.get("required")}
    if required - composition.keys():
        fail(f"missing composition zones: {sorted(required - composition.keys())}")
    if composition.keys() - zones.keys():
        fail(f"unknown composition zones: {sorted(composition.keys() - zones.keys())}")
    for filename, expected in LOCKED.items():
        actual = digest(ASSETS / filename)
        if actual != expected:
            fail(f"immutable puzzle asset changed: {filename} {actual}")
    for path in [*ROOT.glob("design-system/components/puzzle-dojo/*.svg"), PROOF]:
        ET.parse(path)
    proof = ET.parse(PROOF).getroot()
    images = proof.findall(".//{http://www.w3.org/2000/svg}image")
    if {image.attrib["id"] for image in images} != set(composition):
        fail("proof zones do not match composition map")
    if any(image.attrib.get("preserveAspectRatio") != "xMidYMid meet" for image in images):
        fail("proof contains a cropped or stretched placement")
    if report["missing_required"]:
        fail(f"compositor reported missing zones: {report['missing_required']}")
    if set(report["assets"]) != set(composition):
        fail("sidecar assets do not match composition map")
    print(f"Puzzle Dojo validation passed: {len(zones)} zones, {len(images)} linked assets, {len(LOCKED)} immutable puzzle sources.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, ET.ParseError, json.JSONDecodeError) as error:
        print(f"Puzzle Dojo validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
