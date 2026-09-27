#!/usr/bin/env python3
"""Render canonical Issue #1 puzzles through the Puzzle Grinder geometry contract."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "prototypes/puzzle-grinder-v0.2/grinder_contract.json"


def normalized_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


@dataclass(frozen=True)
class Board:
    mode: str
    width: float
    height: float
    padding: float
    header_allowance: float
    minimum_cell: float
    thin_rule: float
    thick_rule: float
    boundary: str


def load_contract(path: Path = CONTRACT) -> tuple[dict, dict[str, Board]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw["puzzles"], {name: Board(mode=name, **cfg) for name, cfg in raw["modes"].items()}


def geometry(spec: dict, board: Board) -> dict:
    if board.mode not in {"compact", "standard", "feature"}:
        raise ValueError(f"unsupported Puzzle Grinder mode: {board.mode}")
    if board.boundary not in {"open", "boxed"}:
        raise ValueError(f"unsupported boundary: {board.boundary}")
    aw = board.width - 2 * board.padding
    ah = board.height - 2 * board.padding - board.header_allowance
    if spec["geometry"] == "grid":
        cell = min(aw / spec["columns"], ah / spec["rows"])
        if cell < board.minimum_cell:
            raise ValueError(f"{board.mode} grid is undersized: {cell:.2f}pt cells")
        return {"cell": cell, "w": cell * spec["columns"], "h": cell * spec["rows"]}
    if spec["geometry"] == "panel":
        _, _, cw, ch = spec["content_box"]
        scale = min(aw / cw, ah / ch)
        width, height = cw * scale, ch * scale
        if width < spec["minimum_content_width"]:
            raise ValueError(f"{board.mode} panel is undersized: {width:.2f}pt content width")
        return {"cell": None, "w": width, "h": height}
    raise ValueError(f"unsupported puzzle geometry: {spec['geometry']}")


def validate_neighborhood(spec: dict) -> None:
    data = json.loads((ROOT / spec["data"]).read_text(encoding="utf-8"))
    if data["size"] != 15 or len(data["grid"]) != 15 or any(len(row) != 15 for row in data["grid"]):
        raise ValueError("Neighborhood Search must remain canonical 15x15")
    if len(data["placements"]) != 16:
        raise ValueError("Neighborhood Search must retain all 16 placements")
    hidden = data["hidden_message"]
    if hidden["answer"] != spec["hidden_answer"] or hidden["answer"] != "FOUNDYOURWAY":
        raise ValueError("Neighborhood Search hidden answer changed")
    cells = hidden["cells"]
    if len(cells) != len("FOUNDYOURWAY"):
        raise ValueError("Neighborhood Search marked-cell count changed")
    if len({r for r, _ in cells}) < 8 or len({c for _, c in cells}) < 8:
        raise ValueError("Neighborhood Search marked cells are no longer dispersed")


def render(name: str, spec: dict, board: Board) -> str:
    source = ROOT / spec["source"]
    if normalized_hash(source) != spec["source_hash"]:
        raise ValueError(f"immutable source hash mismatch: {source}")
    ET.parse(source)
    if name == "neighborhood_search":
        validate_neighborhood(spec)
    g = geometry(spec, board)
    x = (board.width - g["w"]) / 2
    y = board.padding + board.header_allowance
    sx, sy, sw, sh = spec["content_box"]
    scale = g["w"] / sw
    image_x, image_y = x - sx * scale, y - sy * scale
    href = source.relative_to(ROOT).as_posix()
    boundary = ""
    if board.boundary == "boxed":
        boundary = f'<rect fill="none" stroke="#111" stroke-width="{board.thick_rule}" x=".5" y=".5" width="{board.width-1}" height="{board.height-1}"/>'
    coord = ""
    if spec["geometry"] == "grid":
        cells = []
        for row in range(spec["rows"]):
            for col in range(spec["columns"]):
                cells.append(
                    f'<rect data-row="{row+1}" data-column="{col+1}" x="{x+col*g["cell"]:.4f}" '
                    f'y="{y+row*g["cell"]:.4f}" width="{g["cell"]:.4f}" height="{g["cell"]:.4f}" fill="none"/>'
                )
        coord = '<g id="coordinate-map">' + "".join(cells) + "</g>"
    cell_attr = "" if g["cell"] is None else f' data-cell-size-pt="{g["cell"]:.4f}"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{board.width}pt" height="{board.height}pt" viewBox="0 0 {board.width} {board.height}" '
        f'data-puzzle="{name}" data-mode="{board.mode}" data-source-sha256="{spec["source_hash"]}"{cell_attr}>'
        f'{boundary}<defs><clipPath id="content-clip"><rect x="{x:.4f}" y="{y:.4f}" width="{g["w"]:.4f}" height="{g["h"]:.4f}"/></clipPath></defs>'
        f'<image href="../../../{href}" xlink:href="../../../{href}" x="{image_x:.4f}" y="{image_y:.4f}" '
        f'width="{spec["source_width"]*scale:.4f}" height="{spec["source_height"]*scale:.4f}" '
        f'preserveAspectRatio="none" clip-path="url(#content-clip)"/>{coord}</svg>\n'
    )


def write_proofs(output: Path, contract: Path = CONTRACT) -> list[Path]:
    puzzles, modes = load_contract(contract)
    output.mkdir(parents=True, exist_ok=True)
    written = []
    for name, spec in puzzles.items():
        for mode, board in modes.items():
            path = output / f"{name.replace('_','-')}-{mode}.svg"
            path.write_text(render(name, spec, board), encoding="utf-8", newline="\n")
            written.append(path)
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "prototypes/puzzle-grinder-v0.2/proofs")
    args = parser.parse_args()
    for path in write_proofs(args.output):
        print(path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
