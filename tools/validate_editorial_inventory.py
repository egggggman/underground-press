#!/usr/bin/env python3
"""Validate committed editorial inventories against the shared contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from inventory_contract import validate_inventories

ROOT = Path(__file__).resolve().parents[1]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args(argv)
    report = validate_inventories(args.root.resolve())
    print(json.dumps(report, indent=2))
    return bool(report["errors"])


if __name__ == "__main__":
    raise SystemExit(main())
