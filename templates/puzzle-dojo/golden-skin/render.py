#!/usr/bin/env python3
"""Render a composed Puzzle Dojo spread SVG to one PNG per page (needs playwright + chromium)."""

from __future__ import annotations

import argparse
from pathlib import Path

PAGE_W, PAGE_H = 11 * 96, 17 * 96  # CSS px at 96 dpi


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spread", type=Path)
    parser.add_argument("prefix", type=Path, help="output prefix; writes <prefix>-p8.png, <prefix>-p9.png")
    parser.add_argument("--scale", type=float, default=2.0, help="device scale factor (2 = 192 dpi)")
    args = parser.parse_args()
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": PAGE_W, "height": PAGE_H * 2}, device_scale_factor=args.scale)
        page.goto(args.spread.resolve().as_uri())
        page.wait_for_timeout(5000)
        for index, number in enumerate((8, 9)):
            target = args.prefix.parent / f"{args.prefix.name}-p{number}.png"
            page.screenshot(path=str(target), clip={"x": 0, "y": index * PAGE_H, "width": PAGE_W, "height": PAGE_H})
            print(target)
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
