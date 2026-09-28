from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from tools.puzzle_grinder import Board, geometry, load_contract, normalized_hash, render, validate_neighborhood, write_proofs

ROOT = Path(__file__).resolve().parents[1]


class PuzzleGrinderTests(unittest.TestCase):
    def setUp(self):
        self.puzzles, self.modes = load_contract()

    def test_big_four_are_present_and_hash_locked(self):
        self.assertEqual(set(self.puzzles), {"crossword", "neighborhood_search", "pizza_cipher", "sudoku"})
        for spec in self.puzzles.values():
            self.assertEqual(normalized_hash(ROOT / spec["source"]), spec["source_hash"])

    def test_all_modes_render_without_mutating_sources(self):
        before = {name: (ROOT / spec["source"]).read_bytes() for name, spec in self.puzzles.items()}
        for name, spec in self.puzzles.items():
            for board in self.modes.values():
                root = ET.fromstring(render(name, spec, board))
                self.assertEqual(root.attrib["data-source-sha256"], spec["source_hash"])
        after = {name: (ROOT / spec["source"]).read_bytes() for name, spec in self.puzzles.items()}
        self.assertEqual(before, after)

    def test_grid_puzzles_keep_complete_coordinate_maps(self):
        for name in ("sudoku", "crossword", "neighborhood_search"):
            spec = self.puzzles[name]
            for board in self.modes.values():
                root = ET.fromstring(render(name, spec, board))
                cells = root.findall(".//{http://www.w3.org/2000/svg}rect[@data-row]")
                self.assertEqual(len(cells), spec["rows"] * spec["columns"])

    def test_neighborhood_search_semantics_are_locked(self):
        validate_neighborhood(self.puzzles["neighborhood_search"])

    def test_pizza_cipher_uses_panel_geometry(self):
        spec = self.puzzles["pizza_cipher"]
        self.assertEqual(spec["geometry"], "panel")
        for board in self.modes.values():
            g = geometry(spec, board)
            self.assertIsNone(g["cell"])
            self.assertGreaterEqual(g["w"], spec["minimum_content_width"])

    def test_undersized_layouts_fail_explicitly(self):
        tiny = Board("compact", 100, 100, 10, 10, 14, .5, 1.5, "open")
        with self.assertRaisesRegex(ValueError, "undersized"):
            geometry(self.puzzles["crossword"], tiny)
        with self.assertRaisesRegex(ValueError, "undersized"):
            geometry(self.puzzles["pizza_cipher"], tiny)

    def test_proof_generation_is_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            a = Path(directory) / "a"
            b = Path(directory) / "b"
            first, second = write_proofs(a), write_proofs(b)
            self.assertEqual([p.name for p in first], [p.name for p in second])
            self.assertEqual([p.read_bytes() for p in first], [p.read_bytes() for p in second])
            self.assertEqual(len(first), 13)\n            sheet = first[-1].read_text(encoding=\"utf-8\")\n            self.assertIn(\"Puzzle Grinder v0.2\", sheet)\n            self.assertEqual(sheet.count(\"| PASS</text>\"), 12)


if __name__ == "__main__":
    unittest.main()
