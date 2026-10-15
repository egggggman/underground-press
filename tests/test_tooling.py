"""Lightweight regression tests for production tooling."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


class ToolingTests(unittest.TestCase):
    def test_component_builder_import_has_no_output_side_effect(self):
        output = ROOT / "outputs/underground_press_component_library_v1"
        existed = output.exists()
        load_module("component_builder", ROOT / "scripts/build_component_library.py")
        self.assertEqual(output.exists(), existed)

    def test_compositor_rejects_asset_outside_repository(self):
        compose = load_module("puzzle_compose", ROOT / "templates/puzzle-dojo/v1/compose.py")
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "inside repository"):
                compose.portable_path(Path(directory) / "asset.svg", ROOT)

    def test_neighborhood_search_rejects_negative_index(self):
        validator = load_module("puzzle_validator", ROOT / "tools/validate_puzzle_dojo.py")
        with self.assertRaisesRegex(ValueError, "outside the grid"):
            validator.checked_cell([["A"]], -1, 0, "test")

    def test_inventory_files_are_arrays(self):
        for path in sorted((ROOT / "content").glob("*/inventory.json")):
            self.assertIsInstance(json.loads(path.read_text(encoding="utf-8")), list)

    def test_visual_benchmark_registry_matches_files(self):
        validator = load_module("repo_validator", ROOT / "tools/validate_repo.py")
        registry = json.loads(
            (ROOT / "design-system/references/visual_benchmarks.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            {entry["id"] for entry in registry["benchmarks"]},
            {"golden_image", "issue_001_page_one"},
        )
        for entry in registry["benchmarks"]:
            self.assertEqual(validator.sha256(ROOT / entry["path"]), entry["sha256"])

    def test_puzzle_dojo_is_beta(self):
        manifest = json.loads(
            (ROOT / "templates/puzzle-dojo/v1/manifest.json").read_text(encoding="utf-8")
        )
        self.assertEqual(manifest["status"], "beta")


if __name__ == "__main__":
    unittest.main()
