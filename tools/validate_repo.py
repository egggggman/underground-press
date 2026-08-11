#!/usr/bin/env python3
"""Run deterministic local repository validation in one pass."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".json", ".md", ".py", ".svg", ".txt", ".xml"}
PLACEHOLDER = re.compile(r"\[\[[^\]]+\]\]|\b(?:TODO|TBD|FIXME|LOREM IPSUM)\b", re.I)
RETIRED = re.compile(r"New York|subway|Tony[’']s Pizza|CANAL ST\.|WEST 17TH", re.I)
MOJIBAKE = re.compile("(?:\u00c3.|\u00e2[\u0080-\u00bf]{1,2}|\ufffd|\ufeff)")
MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
ACTIVE_CANON_FILES = {
    "README.md",
    "design-system/tokens/sample_content.json",
    "design-system/components/utility-widgets/transit_watch.svg",
    "design-system/components/page-furniture/issue_banner.svg",
    "scripts/build_component_library.py",
}


def tracked_files(root: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=root, capture_output=True, check=True,
    )
    return [root / value.decode("utf-8") for value in result.stdout.split(b"\0") if value]


def run_python(root: Path, relative: str, *arguments: str) -> None:
    result = subprocess.run(
        [sys.executable, relative, *arguments], cwd=root, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    if result.returncode:
        raise ValueError(f"{relative} failed:\n{result.stdout.rstrip()}")
    print(result.stdout.rstrip())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def check_markdown_links(root: Path, path: Path, text: str, errors: list[str]) -> None:
    relative = path.relative_to(root).as_posix()
    for raw_target in MARKDOWN_LINK.findall(text):
        target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
        if not target or target.startswith(("#", "http://", "https://", "mailto:")):
            continue
        target = target.split("#", 1)[0]
        if target and not (path.parent / target).resolve().exists():
            errors.append(f"{relative}: broken internal reference {target!r}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args(argv)
    root = args.root.resolve()
    errors: list[str] = []
    try:
        files = tracked_files(root)
    except (OSError, subprocess.SubprocessError, UnicodeError) as error:
        print(f"Repository validation failed: cannot list tracked files: {error}")
        return 1

    json_count = svg_count = 0
    for path in files:
        try:
            if path.suffix.lower() == ".json":
                json.loads(path.read_text(encoding="utf-8"))
                json_count += 1
            if path.suffix.lower() in {".svg", ".xml"}:
                ET.parse(path)
                svg_count += 1
        except (OSError, UnicodeError, json.JSONDecodeError, ET.ParseError) as error:
            errors.append(f"{path.relative_to(root)}: {error}")

    for path in files:
        relative = path.relative_to(root).as_posix()
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue
        match = MOJIBAKE.search(text)
        if match:
            errors.append(f"{relative}: UTF-8/mojibake corruption {match.group(0)!r}")
        if path.suffix.lower() == ".md":
            check_markdown_links(root, path, text, errors)
        if relative.startswith("issues/") and "/production/" in relative:
            match = PLACEHOLDER.search(text)
            if match:
                errors.append(f"{relative}: unresolved production placeholder {match.group(0)!r}")
        if relative in ACTIVE_CANON_FILES:
            match = RETIRED.search(text)
            if match:
                errors.append(f"{relative}: retired production default {match.group(0)!r}")
        if relative != "tools/validate_repo.py" and re.search(r"(?:[A-Za-z]:\\Users\\|/Users/[^/]+/|/home/[^/]+/)", text):
            errors.append(f"{relative}: machine-specific absolute path")

    manifest = root / "templates/puzzle-dojo/v1/manifest.json"
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
        if data.get("status") != "beta":
            errors.append(f"{manifest.relative_to(root)}: Puzzle Dojo status must be beta")
        reference = manifest.parent / data["content_policy"]["tracked_reference"]
        if not reference.is_file():
            errors.append(f"{manifest.relative_to(root)}: tracked reference is missing")
        else:
            ET.parse(reference)
    except (KeyError, TypeError, OSError, json.JSONDecodeError, ET.ParseError) as error:
        errors.append(f"Golden/reference integrity: {error}")

    registry = root / "design-system/references/visual_benchmarks.json"
    try:
        benchmarks = json.loads(registry.read_text(encoding="utf-8"))["benchmarks"]
        expected_roles = {"golden_image", "issue_001_page_one"}
        actual_roles = {item["id"] for item in benchmarks}
        if actual_roles != expected_roles:
            errors.append(f"{registry.relative_to(root)}: expected exactly {sorted(expected_roles)}")
        for item in benchmarks:
            source = root / item["path"]
            if not source.is_file():
                errors.append(f"{registry.relative_to(root)}: missing benchmark {item['path']}")
            elif sha256(source) != item["sha256"]:
                errors.append(f"{registry.relative_to(root)}: hash drift for {item['id']}")
    except (KeyError, TypeError, OSError, json.JSONDecodeError) as error:
        errors.append(f"Visual benchmark integrity: {error}")

    canonical_expectations = {
        "docs/NEWSROOM_CHARTER.md": ["We’re all looking for a place to land."],
        "world/WORLD_BIBLE.md": ["black fly", "Portland, Maine"],
        "docs/BUSINESS_BIBLE.md": ["world/businesses/FLAGSHIP_BUSINESSES.md", "Crust Bucket"],
    }
    for relative, needles in canonical_expectations.items():
        try:
            text = (root / relative).read_text(encoding="utf-8")
            for needle in needles:
                if needle not in text:
                    errors.append(f"{relative}: missing canonical assertion {needle!r}")
        except OSError as error:
            errors.append(f"{relative}: {error}")

    hygiene_names = {".DS_Store", "Thumbs.db", "desktop.ini"}
    for path in files:
        relative = path.relative_to(root)
        if path.name in hygiene_names or "__pycache__" in relative.parts or path.suffix in {".pyc", ".tmp", ".bak"}:
            errors.append(f"repository hygiene: tracked temporary file {relative}")

    for command, command_args in [
        ("tools/build_editorial_inventory.py", ()),
        ("tools/validate_editorial_inventory.py", ()),
        ("tools/validate_puzzle_dojo.py", ()),
    ]:
        try:
            run_python(root, command, *command_args)
        except ValueError as error:
            errors.append(str(error))

    print(f"Parsed {json_count} JSON files and {svg_count} SVG/XML files.")
    if errors:
        print("Repository validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Repository validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
