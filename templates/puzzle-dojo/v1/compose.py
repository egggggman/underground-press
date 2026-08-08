#!/usr/bin/env python3
"""Compose immutable external assets into the Puzzle Dojo v1 layout."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from xml.etree import ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)
SUPPORTED = {".svg", ".png", ".jpg", ".jpeg"}


def sha256(path: Path) -> str:
    data = path.read_bytes()
    if path.suffix.lower() == ".svg":
        data = data.replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def zone_index(contract: dict) -> dict[str, tuple[int, dict]]:
    result: dict[str, tuple[int, dict]] = {}
    for page in contract["pages"]:
        for zone in page["zones"]:
            if zone["id"] in result:
                raise ValueError(f"duplicate zone id: {zone['id']}")
            result[zone["id"]] = (page["page"], zone)
    return result


def validate_contract(contract: dict) -> None:
    coords = contract["coordinate_system"]
    width, height = coords["page_width"], coords["page_height"]
    if coords["origin"] != "bottom-left":
        raise ValueError("only bottom-left contracts are supported")
    seen = zone_index(contract)
    for zone_id, (_, zone) in seen.items():
        values = (zone["x"], zone["y"], zone["width"], zone["height"])
        if any(not isinstance(value, (int, float)) for value in values):
            raise ValueError(f"zone {zone_id} has non-numeric geometry")
        if zone["width"] <= 0 or zone["height"] <= 0:
            raise ValueError(f"zone {zone_id} has an empty rectangle")
        if zone["x"] < 0 or zone["y"] < 0 or zone["x"] + zone["width"] > width or zone["y"] + zone["height"] > height:
            raise ValueError(f"zone {zone_id} falls outside the page")


def compose(contract_path: Path, assets_path: Path, output: Path, allow_missing: bool) -> dict:
    contract = load_json(contract_path)
    validate_contract(contract)
    supplied = load_json(assets_path)
    if not isinstance(supplied, dict):
        raise ValueError("asset map must be a JSON object of zone IDs to file paths")
    zones = zone_index(contract)
    unknown = sorted(set(supplied) - set(zones))
    if unknown:
        raise ValueError(f"unknown zone IDs: {', '.join(unknown)}")

    resolved: dict[str, Path] = {}
    before: dict[str, str] = {}
    for zone_id, raw_path in supplied.items():
        asset = (assets_path.parent / raw_path).resolve()
        if not asset.is_file():
            raise FileNotFoundError(f"asset for {zone_id} not found: {asset}")
        if asset.suffix.lower() not in SUPPORTED:
            raise ValueError(f"asset for {zone_id} must be SVG, PNG, or JPEG: {asset}")
        if asset == output.resolve():
            raise ValueError(f"output cannot overwrite input asset: {asset}")
        resolved[zone_id] = asset
        before[zone_id] = sha256(asset)

    required = {zone_id for zone_id, (_, zone) in zones.items() if zone.get("required")}
    missing = sorted(required - set(resolved))
    if missing and not allow_missing:
        raise ValueError(f"missing required zones: {', '.join(missing)}")

    coords = contract["coordinate_system"]
    page_width, page_height = coords["page_width"], coords["page_height"]
    pages = contract["pages"]
    root = ET.Element(f"{{{SVG_NS}}}svg", {
        "width": f"{page_width / 72:g}in", "height": f"{len(pages) * page_height / 72:g}in",
        "viewBox": f"0 0 {page_width} {len(pages) * page_height}",
        "role": "img", "data-template": contract["contract_id"], "data-version": contract["version"]
    })
    ET.SubElement(root, f"{{{SVG_NS}}}title").text = "Puzzle Dojo composed spread"
    ET.SubElement(root, f"{{{SVG_NS}}}desc").text = "Linked external assets placed without cropping or mutation."
    for page_offset, page in enumerate(pages):
        group = ET.SubElement(root, f"{{{SVG_NS}}}g", {"id": f"page-{page['page']}", "transform": f"translate(0 {page_offset * page_height})"})
        ET.SubElement(group, f"{{{SVG_NS}}}rect", {"width": str(page_width), "height": str(page_height), "fill": "#EDE0B3"})
        for zone in page["zones"]:
            zone_id = zone["id"]
            asset = resolved.get(zone_id)
            if not asset:
                continue
            y_top = page_height - zone["y"] - zone["height"]
            href = Path(os.path.relpath(asset, output.parent.resolve())).as_posix()
            ET.SubElement(group, f"{{{SVG_NS}}}image", {
                "id": zone_id, "x": str(zone["x"]), "y": str(y_top),
                "width": str(zone["width"]), "height": str(zone["height"]),
                "preserveAspectRatio": "xMidYMid meet", "href": href,
                f"{{{XLINK_NS}}}href": href, "data-sha256": before[zone_id]
            })

    output.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(output, encoding="utf-8", xml_declaration=True)
    after = {zone_id: sha256(asset) for zone_id, asset in resolved.items()}
    changed = sorted(zone_id for zone_id in before if before[zone_id] != after[zone_id])
    if changed:
        output.unlink(missing_ok=True)
        raise RuntimeError(f"input assets changed during composition: {', '.join(changed)}")
    report = {
        "template": contract["contract_id"], "version": contract["version"],
        "output": str(output.resolve()), "missing_required": missing,
        "assets": {zone_id: {"path": str(resolved[zone_id]), "sha256": before[zone_id]} for zone_id in sorted(resolved)}
    }
    report_path = output.with_suffix(output.suffix + ".json")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assets", type=Path, help="JSON map of zone IDs to external asset paths")
    parser.add_argument("output", type=Path, help="generated linked SVG proof")
    parser.add_argument("--contract", type=Path, default=Path(__file__).with_name("layout_contract.json"))
    parser.add_argument("--allow-missing", action="store_true", help="compose a partial/debug proof")
    args = parser.parse_args()
    report = compose(args.contract.resolve(), args.assets.resolve(), args.output.resolve(), args.allow_missing)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
