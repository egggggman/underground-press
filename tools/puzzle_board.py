#!/usr/bin/env python3
"""Render immutable puzzle sources into neutral, geometry-aware SVG boards."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "prototypes/puzzle-board-v0.1/board_contract.json"


@dataclass(frozen=True)
class PuzzleSpec:
    kind: str
    rows: int
    columns: int
    source: Path
    source_hash: str


@dataclass(frozen=True)
class BoardConfig:
    mode: str
    width: float
    height: float
    padding: float
    header_allowance: float
    minimum_cell: float
    thin_rule: float
    thick_rule: float
    boundary: str


@dataclass(frozen=True)
class BoardGeometry:
    cell_size: float
    grid_x: float
    grid_y: float
    grid_width: float
    grid_height: float


def normalized_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def load_contract(path: Path = CONTRACT) -> tuple[dict[str, PuzzleSpec], dict[str, BoardConfig]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    puzzles = {
        name: PuzzleSpec(
            name,
            value["rows"],
            value["columns"],
            ROOT / value["source"],
            value["source_hash"],
        )
        for name, value in raw["puzzles"].items()
    }
    modes = {name: BoardConfig(mode=name, **value) for name, value in raw["modes"].items()}
    return puzzles, modes


def calculate_geometry(puzzle: PuzzleSpec, board: BoardConfig) -> BoardGeometry:
    if board.mode not in {"compact", "standard", "feature"}:
        raise ValueError(f"unsupported Puzzle Board mode: {board.mode}")
    if board.boundary not in {"open", "boxed"}:
        raise ValueError(f"unsupported boundary: {board.boundary}")
    available_width = board.width - 2 * board.padding
    available_height = board.height - 2 * board.padding - board.header_allowance
    cell = min(available_width / puzzle.columns, available_height / puzzle.rows)
    if cell < board.minimum_cell:
        raise ValueError(
            f"{puzzle.kind} {board.mode} board is undersized: "
            f"{cell:.2f}pt cells are below {board.minimum_cell:.2f}pt minimum"
        )
    grid_width = cell * puzzle.columns
    grid_height = cell * puzzle.rows
    return BoardGeometry(
        cell,
        (board.width - grid_width) / 2,
        board.padding + board.header_allowance,
        grid_width,
        grid_height,
    )


def render(puzzle: PuzzleSpec, board: BoardConfig) -> str:
    if normalized_hash(puzzle.source) != puzzle.source_hash:
        raise ValueError(f"immutable source hash mismatch: {puzzle.source}")
    ET.parse(puzzle.source)
    geometry = calculate_geometry(puzzle, board)
    href = puzzle.source.relative_to(ROOT).as_posix()
    cells = "\n".join(
        f'    <rect id="cell-r{row + 1}-c{column + 1}" data-row="{row + 1}" '
        f'data-column="{column + 1}" x="{geometry.grid_x + column * geometry.cell_size:.4f}" '
        f'y="{geometry.grid_y + row * geometry.cell_size:.4f}" '
        f'width="{geometry.cell_size:.4f}" height="{geometry.cell_size:.4f}"/>'
        for row in range(puzzle.rows)
        for column in range(puzzle.columns)
    )
    boundary = (
        f'  <rect class="board-boundary" x="0.5" y="0.5" width="{board.width - 1:.4f}" '
        f'height="{board.height - 1:.4f}"/>\n'
        if board.boundary == "boxed"
        else ""
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="{board.width}pt" height="{board.height}pt" viewBox="0 0 {board.width} {board.height}"
  data-puzzle="{puzzle.kind}" data-mode="{board.mode}" data-source-sha256="{puzzle.source_hash}"
  data-cell-size-pt="{geometry.cell_size:.4f}">
  <style>.board-boundary{{fill:none;stroke:#111;stroke-width:{board.thick_rule}}}
  .coordinate-map rect{{fill:none;stroke:none;pointer-events:none}}</style>
{boundary}  <g id="canonical-puzzle-layer">
    <image href="../../../{href}" xlink:href="../../../{href}" x="{geometry.grid_x:.4f}"
      y="{geometry.grid_y:.4f}" width="{geometry.grid_width:.4f}" height="{geometry.grid_height:.4f}"
      preserveAspectRatio="xMidYMid meet"/>
  </g>
  <g id="coordinate-map" class="coordinate-map" data-rows="{puzzle.rows}" data-columns="{puzzle.columns}">
{cells}
  </g>
</svg>
'''


def write_proofs(output: Path, contract: Path = CONTRACT) -> list[Path]:
    puzzles, modes = load_contract(contract)
    output.mkdir(parents=True, exist_ok=True)
    written = []
    for puzzle in puzzles.values():
        for board in modes.values():
            path = output / f"{puzzle.kind}-{board.mode}.svg"
            path.write_text(render(puzzle, board), encoding="utf-8", newline="\n")
            written.append(path)
    sheet = output / "proof-sheet.svg"
    panels = []
    for row, puzzle in enumerate(puzzles):
        for column, mode in enumerate(modes):
            x, y = 20 + column * 320, 35 + row * 420
            panels.append(
                f'  <text x="{x}" y="{y - 10}" font-family="sans-serif" font-size="13">'
                f'{puzzle} / {mode}</text>\n'
                f'  <image href="{puzzle}-{mode}.svg" x="{x}" y="{y}" width="300" height="385" '
                f'preserveAspectRatio="xMidYMin meet"/>'
            )
    sheet.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="980" height="860" viewBox="0 0 980 860">\n'
        '<rect width="980" height="860" fill="white"/>\n'
        '<text x="20" y="22" font-family="sans-serif" font-size="16">Puzzle Board v0.1 proof sheet</text>\n'
        + "".join(panels)
        + "</svg>\n",
        encoding="utf-8",
        newline="\n",
    )
    written.append(sheet)
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "prototypes/puzzle-board-v0.1/proofs")
    args = parser.parse_args()
    for path in write_proofs(args.output):
        print(path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
