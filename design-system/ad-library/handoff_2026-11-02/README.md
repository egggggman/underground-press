# The Underground Press — Approved Advertising Art Library

**Handoff date:** 2026-11-02  
**Project:** The Underground Press, fictional underground Portland, Maine, 1991-inspired tabloid  
**Status:** 11 business designs approved in conversation; 12 approved PNG assets including one coupon. These are *artwork approvals*, not verified print or publication approvals.

## Folders
- `approved_artwork/` — files to use in layout, one PNG per approved business plus Deez Bait coupon.
- `style_references/` — original Golden Image, Seagullotine Puzzle Desk illustration, Tony's Pizza illustration. References only, not advertising deliverables.
- `previous_versions/` — selected superseded iterations for provenance; DO NOT substitute for approved files without editorial review. One early Myrtle variant is not reliably distinguishable from the final in this file export, so no separate earlier Myrtle version is asserted.
- `documentation/ASSET_MANIFEST.csv` — canonical filenames, approvals, source file mappings, dimensions and SHA-256 checksums.

## Approved businesses and art decisions
1. **Tony's Donuts** (`tonys-donuts.png`): three frosted sprinkled donuts, one bitten, next to steaming diner mug.
2. **Myrtle St. Suds** (`myrtle-suds.png`): washer, sock/bubbles, cat modeled on photo of real Myrtle (tortoiseshell, green eyes). Keep her distinct face and coat.
3. **Foghorn Tapes** (`foghorn-tapes.png`): nautical record-store *logo with tagline*, not a still life of tapes.
4. **Harbor Heights Hardware** (`harbor-heights-hardware.png`): **renamed** from Harbor Lantern Hardware; gritty pirate emblem. Use final name.
5. **The Gull & Ladle** (`gull-ladle.png`): bold, less-detailed logo. Copy: **“Home of the $1 Whoopie”** and **“Best Soup du Jour”**.
6. **Cassiopeia Books** (`cassiopeia-books.png`): *book cover*, not another generic sign; Portland, Maine waterfront skyline, cat, books and constellation. Use Portland revision, not earlier skyline.
7. **Quality Cuts** (`quality-cuts.png`): simple barber pole and comb barbershop identity.
8. **Deez Bait** (`deez-bait.png`): **renamed** from Ferry Fare Bait. Chum-bucket logo. Separate perforated `deez-bait-coupon.png` reads **“BUY 2 GET NONE FREE!”**; joke is intentional.
9. **Alice's Alterations** (`alice-alterations.png`): elderly woman with tiny bifocals struggling to thread a needle with split/frayed thread; more whimsical and less detailed.
10. **Seagull Cab Co.** (`gull-taxi.png`): anatomically legible vintage yellow checker taxi, gull cabbie wearing cap, **lit cigarette in beak**. The cigarette revision was approved.
11. **The Crust Bucket** (`crust-bucket.png`): pizza-crust bucket mascot, arcade cabinets instead of skyline, **SNES-era 16-bit pixel art**. Exact motto **“Any Pizza is Good Pizza!”**. Pixel-art divergence from the standard halftone style is intentional and approved.

## Visual system and layout notes
- Shared family: 1991 tabloid/retro commercial art, bold hand-inked lines, imperfect registration, gritty worn print, cream paper, limited spot-color feel. Some final approved logos intentionally use additional accent colors; **do not silently recolor approved artwork**.
- Original *illustration-only* brief specified landscape 3:2, flat cream background, no text or borders. During review, the user explicitly pivoted many ads to **lettered logos, taglines, borders, coupon and pixel art**. Later approvals supersede the initial no-text rule for those assets.
- Files are raster PNG, not layered design sources. They may not be exact 1536×1024 and may contain textured backgrounds and borders. Check dimensions in manifest and inspect bleed, trim, effective DPI, type legibility and any print cut lines before publication.
- For newspaper layout: use approved images without AI-redrawing or changing wording; resize proportionally, do not stretch, crop only with editorial approval. The Deez Bait coupon needs real layout/print perforation guidance; drawn perforations are not physical perforations.
- This pack is an **artwork handoff**, not evidence that images have been imported into Replit, committed to GitHub, approved by Myrtle, or passed physical print proofing.

## Canon / editorial caution
These businesses are accepted **advertising-art concepts**. Approval of an image does not automatically make each business permanent world canon or authorize paid advertisements. Cross-check against `docs/BUSINESS_BIBLE.md`, `world/businesses/FLAGSHIP_BUSINESSES.md`, and the issue's editorial permissions before placement. The Crust Bucket and other flagship businesses may have preexisting canon entries. Do not replace historical Tony's Pizza reference art in-place.

## Suggested Claude / layout handoff
Use `approved_artwork/` and `documentation/ASSET_MANIFEST.csv` as the source of truth for this batch. Display each image in an ad asset library with business, status, approved art direction, and version history. Preserve exact filename and hash. Keep placement assignments and page-level editorial/print approval separate from artwork approval. Do not assume the ad is already in Issue #1.
