# Puzzle Dojo Master Template v1.0

This is the first component-driven department template for *The Underground Press*. The editable SVG master contains measured drop zones but no puzzle data. Its two stacked artboards correspond to pages 8 and 9 of an 11 × 17 inch portrait spread.

## Compose a proof

Copy `assets.example.json`, replace its values with paths to approved SVG, PNG, or JPEG assets, and run:

```text
python templates/puzzle-dojo/v1/compose.py path/to/assets.json proofs/puzzle-dojo-proof.svg
```

The asset map is resolved relative to the map file. The output links each source with `preserveAspectRatio="xMidYMid meet"`; it never crops, embeds, rewrites, or upscales the source. A JSON sidecar records each source path and SHA-256 hash. Composition fails if a required zone is missing, an unknown zone is supplied, or a source changes while the output is being built. Use `--allow-missing` only for layout debugging.

Generated proofs belong in `proofs/` and remain ignored. The deliberately tracked `examples/issue_001_debug.svg` is a lightweight geometry reference, not a reader-facing proof and not a source of puzzle data.

## Editorial boundary

Puzzle setters own grids, clues, givens, cipher text, and answer logic. The compositor owns placement only. If supplied puzzle artwork does not fit its zone, return it to editorial or revise the layout contract in a new template version; do not crop, stretch, reflow, or rebuild the puzzle inside the compositor.
