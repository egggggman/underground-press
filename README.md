# The Underground Press

## Repository validation

Run `python tools/validate_repo.py` before production handoff. It performs the
repository's JSON, SVG/XML, editorial inventory, generator-drift, Puzzle Dojo
layout/source-integrity, placeholder, canon terminology, reference, and local
hygiene checks in one deterministic pass.

Committed files under `content/*/inventory.json` are the publication source of
truth. `tools/build_editorial_inventory.py` is the reproducible generator: it
checks for drift by default and writes only when invoked with `--write`.

The Underground Press is a reusable **1991 Portland, Maine underground tabloid publishing system**: a newsroom-in-a-box for producing recurring issues with a consistent editorial voice, visual language, advertisements, puzzles, characters, and production workflow.

It preserves the handmade energy of an underground newspaper while making every issue easier to assemble, revise, archive, and reproduce.

## Newsroom structure

- `docs/` — newsroom manual, editorial standards, and production checklists
- `design-system/` — colors, typography rules, layouts, widgets, and reusable page furniture
- `ads/` — fictional advertisers, coupons, classifieds, and gap-filling ad formats
- `sewer-caps/` — collectible Sewer Cap templates and issue-ready artwork
- `art/` — original characters, textures, halftones, and spot illustrations
- `artifacts/` — exclusive keepsakes for rare Special Editions and their production records
- `puzzles/` — reusable puzzle frames, generators, and issue-specific puzzle data
- `issues/issue_001/` — source material and production files for the first issue
- `scripts/` — layout, validation, and export automation

## Working principles

1. Reuse systems; customize stories.
2. Keep source assets separate from generated exports.
3. Preserve every published issue as an immutable snapshot.
4. Track original work and documentation—never bundled font files.
5. Make the paper feel like it came off a press in 1991 and out of Portland beneath Portland.

## Status

Issue #1 production is active. Puzzle Dojo is **BETA** pending the press checks in its preflight record. Prototype 0.2 remains frozen and Prototype 0.3 remains unauthorized.
