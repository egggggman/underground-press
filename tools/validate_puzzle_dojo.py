#!/usr/bin/env python3
"""Validate Puzzle Dojo contract, immutable sources, components, and proof."""

from __future__ import annotations

import hashlib
import argparse
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "issues/issue_001/assets/puzzle-dojo/validation_manifest.json"


def digest(path: Path) -> str:
    data = path.read_bytes()
    if path.suffix.lower() == ".svg":
        data = data.replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def fail(message: str) -> None:
    raise ValueError(message)


def load_object(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail(f"cannot read JSON {path}: {error}")
    if not isinstance(value, dict):
        fail(f"JSON root must be an object: {path}")
    return value


def checked_cell(grid: list, row: int, col: int, label: str) -> str:
    if not isinstance(row, int) or not isinstance(col, int):
        fail(f"{label}: coordinates must be integers")
    if not (0 <= row < len(grid)) or not (0 <= col < len(grid[row])):
        fail(f"{label}: cell ({row + 1}, {col + 1}) is outside the grid")
    value = grid[row][col]
    if not isinstance(value, str) or len(value) != 1:
        fail(f"{label}: grid cells must contain one character")
    return value


def resolve_from_manifest(manifest_path: Path, value: str) -> Path:
    path = (manifest_path.parent / value).resolve()
    try:
        path.relative_to(ROOT)
    except ValueError as error:
        fail(f"validation manifest path leaves repository: {value}")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args(argv)
    manifest_path = args.manifest.resolve()
    manifest = load_object(manifest_path)
    assets = manifest_path.parent
    contract_path = resolve_from_manifest(manifest_path, manifest["layout_contract"])
    composition_path = resolve_from_manifest(manifest_path, manifest["composition"])
    proof_path = resolve_from_manifest(manifest_path, manifest["proof"])
    sidecar_path = proof_path.with_suffix(".svg.json")
    search_path = resolve_from_manifest(manifest_path, manifest["neighborhood_search"])
    locked = manifest["immutable_assets"]
    required_puzzles = set(manifest["required_puzzles"])
    rules = manifest["neighborhood_search_rules"]
    contract = load_object(contract_path)
    composition = load_object(composition_path)
    report = load_object(sidecar_path)
    search = load_object(search_path)
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
    if not required_puzzles <= composition.keys():
        fail(f"missing required puzzle: {sorted(required_puzzles - composition.keys())}")
    grid = search["grid"]
    size = search["size"]
    expected_size = rules["size"]
    if not isinstance(grid, list) or size != expected_size or len(grid) != size or any(not isinstance(row, (list, str)) or len(row) != size for row in grid):
        fail(f"Neighborhood Search grid must be {expected_size}x{expected_size}")
    allowed_directions = {-1, 0, 1}
    for placement in search["placements"]:
        row = placement["row"] - 1
        col = placement["col"] - 1
        dr = placement["dr"]
        dc = placement["dc"]
        if dr not in allowed_directions or dc not in allowed_directions or (dr, dc) == (0, 0):
            fail(f"bent or invalid placement: {placement['word']}")
        word = placement["word"]
        if not isinstance(word, str) or not word:
            fail("Neighborhood Search placement word must be a non-empty string")
        found = "".join(
            checked_cell(grid, row + i * dr, col + i * dc, f"placement {word}")
            for i in range(len(word))
        )
        if found != word:
            fail(f"word placement mismatch: {word} found {found}")
    hidden_cells = search["hidden_message"]["cells"]
    hidden = "".join(checked_cell(grid, row - 1, col - 1, "hidden message") for row, col in hidden_cells)
    if hidden != search["hidden_message"]["answer"] or hidden != rules["hidden_answer"]:
        fail(f"hidden message mismatch: {hidden}")
    hidden_rows = {row for row, _ in hidden_cells}
    hidden_columns = {col for _, col in hidden_cells}
    if len(hidden_rows) < rules["minimum_distinct_rows"] or len(hidden_columns) < rules["minimum_distinct_columns"]:
        fail("hidden message cells are too clustered to remain hidden")
    for filename, expected in locked.items():
        actual = digest(assets / filename)
        if actual != expected:
            fail(f"immutable puzzle asset changed: {filename} {actual}")
    for path in [*ROOT.glob("design-system/components/puzzle-dojo/*.svg"), proof_path]:
        ET.parse(path)
    proof = ET.parse(proof_path).getroot()
    images = proof.findall(".//{http://www.w3.org/2000/svg}image")
    if {image.attrib["id"] for image in images} != set(composition):
        fail("proof zones do not match composition map")
    if any(image.attrib.get("preserveAspectRatio") != "xMidYMid meet" for image in images):
        fail("proof contains a cropped or stretched placement")
    if report["missing_required"]:
        fail(f"compositor reported missing zones: {report['missing_required']}")
    if set(report["assets"]) != set(composition):
        fail("sidecar assets do not match composition map")
    if report.get("path_base") != "repository-root":
        fail("sidecar paths must be repository-root relative")
    if Path(report["output"]).is_absolute():
        fail("sidecar output path must not be absolute")
    for zone_id, record in report["assets"].items():
        if not isinstance(record, dict) or not isinstance(record.get("path"), str):
            fail(f"sidecar asset record is malformed: {zone_id}")
        asset_path = Path(record["path"])
        if asset_path.is_absolute() or ".." in asset_path.parts:
            fail(f"sidecar asset path is not portable: {zone_id}")
        resolved = ROOT / asset_path
        if not resolved.is_file() or digest(resolved) != record.get("sha256"):
            fail(f"sidecar asset integrity mismatch: {zone_id}")
    print(f"Puzzle Dojo validation passed: {len(zones)} zones, {len(images)} linked assets, {len(locked)} immutable puzzle sources.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (KeyError, TypeError, IndexError, OSError, ValueError, ET.ParseError) as error:
        print(f"Puzzle Dojo validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
