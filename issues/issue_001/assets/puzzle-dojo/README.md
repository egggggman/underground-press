# Issue #1 Puzzle Dojo canonical assets

These are the canonical immutable puzzle source assets for Issue #1. They were extracted on 2026-08-06 from page 1 of the validated vector production PDF `source_pages_8_9.pdf` (SHA-256 `3e2e2daec656621c7fb5990c5e4f9fcd69b4886bd54fe003e395aff8754a7aab`).

## Extraction method

PyMuPDF 1.28.2 applied fixed crop rectangles in the PDF's native 792 × 1224 point, top-left coordinate system and exported the published vector display list with text converted to paths. No OCR, redrawing, regeneration, correction, reflow, or puzzle-content editing was performed.

| Asset | Crop `(x0, y0, x1, y1)` pt | SHA-256 |
| --- | --- | --- |
| `crossword.svg` | `(22, 107, 490, 490)` | `a38e947c768cc280d1f24d71fa70da34b1defc19b440aae7796d7dcfbb68bb9f` |
| `crossword-clues.svg` | `(22, 490, 490, 664)` | `1a6a3db6d9d171033dd86747ab96222c844e565d0fe048aae85d3f0407b7de51` |
| `sudoku.svg` | `(498, 107, 770, 430)` | `0e9adf56396e614b17ee1a7a977093c805b82f3ad95ed30dc3a088c3b898f375` |
| `pizza-cipher.svg` | `(22, 675, 389, 817)` | `aeb98f3d6f6ddf2f390899bb71f528329adb205907854fdedcd28e074d2b07a1` |
| `brain-bender.svg` | `(498, 441, 770, 1176)` | `12c11866cece1484e6ac548a75f23c9476c5e779716f2aa05032b2ecc40fcba2` |

Treat any hash change as a new editorial revision requiring validation. The compositor may link and scale these files according to the layout contract but must never rewrite them.
