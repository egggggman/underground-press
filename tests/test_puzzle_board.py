from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from tools.puzzle_board import BoardConfig, calculate_geometry, load_contract, normalized_hash, render, write_proofs

ROOT = Path(__file__).resolve().parents[1]


class PuzzleBoardTests(unittest.TestCase):
    def setUp(self):
        self.puzzles, self.modes = load_contract()

    def test_all_modes_preserve_identical_sudoku_data_hash_and_coordinates(self):
        puzzle = self.puzzles["sudoku"]
        outputs = [render(puzzle, self.modes[mode]) for mode in ("compact", "standard", "feature")]
        for output in outputs:
            root = ET.fromstring(output)
            self.assertEqual(root.attrib["data-source-sha256"], puzzle.source_hash)
            cells = root.findall(".//{http://www.w3.org/2000/svg}rect[@data-row]")
            self.assertEqual([(c.attrib["data-row"], c.attrib["data-column"]) for c in cells], [(str(r), str(c)) for r in range(1, 10) for c in range(1, 10)])
        self.assertEqual(normalized_hash(puzzle.source), puzzle.source_hash)

    def test_crossword_modes_preserve_grid_numbering_source_and_coordinates(self):
        puzzle = self.puzzles["crossword"]
        before = puzzle.source.read_bytes()
        for mode in self.modes.values():
            root = ET.fromstring(render(puzzle, mode))
            self.assertEqual(root.attrib["data-source-sha256"], puzzle.source_hash)
            self.assertEqual(len(root.findall(".//{http://www.w3.org/2000/svg}rect[@data-row]")), 225)
        self.assertEqual(puzzle.source.read_bytes(), before)

    def test_undersized_and_invalid_modes_fail_clearly(self):
        puzzle = self.puzzles["crossword"]
        tiny = BoardConfig("compact", 100, 100, 10, 10, 14, 0.5, 1.5, "open")
        with self.assertRaisesRegex(ValueError, "undersized"):
            calculate_geometry(puzzle, tiny)
        invalid = BoardConfig("poster", 500, 500, 10, 10, 14, 0.5, 1.5, "open")
        with self.assertRaisesRegex(ValueError, "unsupported Puzzle Board mode"):
            calculate_geometry(puzzle, invalid)

    def test_rendering_is_deterministic_and_does_not_mutate_sources(self):
        before = {name: (p.source.read_bytes(), p.source.stat().st_mtime_ns) for name, p in self.puzzles.items()}
        with tempfile.TemporaryDirectory() as directory:
            first = write_proofs(Path(directory) / "first")
            second = write_proofs(Path(directory) / "second")
            self.assertEqual([hashlib.sha256(p.read_bytes()).digest() for p in first], [hashlib.sha256(p.read_bytes()).digest() for p in second])
            for path in first + second:
                ET.parse(path)
        after = {name: (p.source.read_bytes(), p.source.stat().st_mtime_ns) for name, p in self.puzzles.items()}
        self.assertEqual(before, after)

    def test_committed_proofs_resolve_their_canonical_sources(self):
        proof_root = ROOT / "prototypes/puzzle-board-v0.1/proofs"
        for path in sorted(proof_root.glob("sudoku-*.svg")) + sorted(proof_root.glob("crossword-*.svg")):
            root = ET.parse(path).getroot()
            image = root.find(".//{http://www.w3.org/2000/svg}image")
            self.assertIsNotNone(image)
            linked = (path.parent / image.attrib["href"]).resolve()
            self.assertTrue(linked.is_file(), linked)
            self.assertEqual(normalized_hash(linked), root.attrib["data-source-sha256"])


if __name__ == "__main__":
    unittest.main()
