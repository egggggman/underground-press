# The Underground Press Component Library v1.0

A reusable production asset pack derived from the established Puzzle Dojo visual system: 1991 mutant-subway tabloid, warm newsprint, oxblood/sewer-green spot color, condensed headlines, strong rules, live editorial type, and modular boxes.

## Quick start

1. Open any file in `assets_svg/` in Illustrator, Inkscape, Affinity Designer, or Figma.
2. Replace every `[[FIELD_NAME]]` token. Keep artwork groups locked; edit only live text and explicitly named editable groups.
3. Resize proportionally. For a new aspect ratio, use the nearest drop-zone module and move its inner safe-area rectangle.
4. Use `tokens/design_tokens.json` for colors, font stacks, bleed, and safe-area values.
5. Use `tokens/sample_content.json` as a content schema. Production code can replace the bracketed tokens before placing the SVG.

## Folder map

- `assets_svg/typography`: type specimen and hierarchy.
- `assets_svg/decorative_rules`: heavy, double, dashed, and pipe rules.
- `assets_svg/page_furniture`: page number, issue banner, jump/continued lines, end mark, editor note.
- `assets_svg/utility_widgets`: weather, subway status, press status, calendar, next issue, puzzle desk.
- `assets_svg/advertisements`: Tony’s Pizza master, quarter-page, classified, and coupon variants.
- `assets_svg/collectibles`: blank Sewer Cap and collector frame.
- `assets_svg/seagullotine`: quote, editorial, and caption panels with editable vector mascot.
- `assets_svg/drop_zones`: full-width, two-column, sidebar, puzzle, photo, and ad modules.
- `source/build_component_library.py`: regenerates the library and catalog.
- `reference_raster`: inherited Puzzle Dojo spot art for visual reference only; not required by the SVG masters.

## Production rules

- SVG is the master format. Text remains live and artwork is vector.
- The green `[[...]]` values are swappable content fields. Change them to ink after merge if desired.
- Preserve oxblood for alerts/headers and sewer green for status/editorial fields.
- Keep rules at 0.75 pt minimum at final size. Keep body copy at 7.5 pt minimum for tabloid print.
- Default trim is 11 × 17 in, portrait; 0.125 in bleed and 0.25 in safe area.
- For one-color output, map oxblood, green, and mustard to black; patterns and borders retain hierarchy.
- Raster spot art is allowed as a linked halftone layer, but it should never contain changeable copy.

## Component use

- Typography: copy styles, not the sample wording.
- Decorative rules: stretch only along the long axis.
- Page furniture: place on master pages; bind `[[PAGE]]`, issue, and section at export.
- Widgets: feed values from JSON; keep title and icon locked.
- Tony’s Pizza: the master is fully vector. Swap address, offer, and coupon code without redrawing the pizza.
- Sewer Cap: replace number/issue/rarity and optionally add art inside the inner ring.
- Seagullotine: keep the bird group; replace quote/body/credit fields.
- Drop zones: compose pages from measured modules first, then inject content.

## Rebuild

Run `python source/build_component_library.py` with ReportLab installed. The script writes the catalog and refreshes all generated SVG masters. The delivered ZIP is a transport copy; work from the unzipped folder.
