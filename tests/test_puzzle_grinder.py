from __future__ import annotations

import json
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

    def test_neighborhood_search_data_actually_encodes_locked_words_and_message(self):
        spec = self.puzzles["neighborhood_search"]
        data = json.loads((ROOT / spec["data"]).read_text(encoding="utf-8"))
        grid = data["grid"]
        for placement in data["placements"]:
            letters = "".join(
                grid[placement["row"] - 1 + i * placement["dr"]][placement["col"] - 1 + i * placement["dc"]]
                for i in range(len(placement["word"]))
            )
            self.assertEqual(letters, placement["word"])
        cells = sorted(data["hidden_message"]["cells"])
        self.assertEqual("".join(grid[r - 1][col - 1] for r, col in cells), "FOUNDYOURWAY")

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

    def test_bad_geometry_contracts_fail_closed(self):
        crossword = dict(self.puzzles["crossword"])
        crossword["content_box"] = [460, 380, 20, 20]
        with self.assertRaisesRegex(ValueError, "invalid content_box"):
            render("crossword", crossword, self.modes["standard"])

        no_area = Board("compact", 20, 20, 20, 20, 14, .5, 1.5, "open")
        with self.assertRaisesRegex(ValueError, "no usable content area"):
            geometry(self.puzzles["sudoku"], no_area)

        unsupported = dict(self.puzzles["sudoku"])
        unsupported["geometry"] = "hex"
        with self.assertRaisesRegex(ValueError, "unsupported puzzle geometry"):
            geometry(unsupported, self.modes["standard"])

        zero_grid = dict(self.puzzles["sudoku"])
        zero_grid["rows"] = 0
        with self.assertRaisesRegex(ValueError, "rows and columns must be positive"):
            geometry(zero_grid, self.modes["standard"])

        zero_panel = dict(self.puzzles["pizza_cipher"])
        zero_panel["content_box"] = [0, 0, 0, 142]
        with self.assertRaisesRegex(ValueError, "content_box"):
            render("pizza_cipher", zero_panel, self.modes["standard"])

        negative_board = Board("compact", -1, 282, 9, 18, 14, .5, 1.5, "open")
        with self.assertRaisesRegex(ValueError, "dimensions must be positive"):
            geometry(self.puzzles["sudoku"], negative_board)

    def test_rendered_grid_coordinates_match_calculated_geometry(self):
        for name in ("sudoku", "crossword", "neighborhood_search"):
            spec = self.puzzles[name]
            for board in self.modes.values():
                g = geometry(spec, board)
                root = ET.fromstring(render(name, spec, board))
                cells = root.findall(".//{http://www.w3.org/2000/svg}rect[@data-row]")
                first, last = cells[0], cells[-1]
                expected_x = (board.width - g["w"]) / 2
                expected_y = board.padding + board.header_allowance
                self.assertAlmostEqual(float(first.attrib["x"]), expected_x, places=3)
                self.assertAlmostEqual(float(first.attrib["y"]), expected_y, places=3)
                self.assertAlmostEqual(float(first.attrib["width"]), g["cell"], places=3)
                self.assertAlmostEqual(
                    float(last.attrib["x"]) + float(last.attrib["width"]),
                    expected_x + g["w"],
                    places=3,
                )
                self.assertAlmostEqual(
                    float(last.attrib["y"]) + float(last.attrib["height"]),
                    expected_y + g["h"],
                    places=3,
                )

    def test_proof_generation_is_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            a = Path(directory) / "a"
            b = Path(directory) / "b"
            first, second = write_proofs(a), write_proofs(b)
            self.assertEqual([p.name for p in first], [p.name for p in second])
            self.assertEqual([p.read_bytes() for p in first], [p.read_bytes() for p in second])
            self.assertEqual(len(first), 13)
            sheet = first[-1].read_text(encoding="utf-8")
            self.assertIn("Puzzle Grinder v0.2", sheet)
            self.assertEqual(sheet.count("| PASS</text>"), 12)


if __name__ == "__main__":
    unittest.main()
