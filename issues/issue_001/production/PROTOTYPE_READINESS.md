# Issue 001 Prototype v0.1: assembly readiness audit (UP-001)

**Return status: BLOCKED.** Audited 2026-11-03 against `main` and all open PRs. Evidence: `issue_001_manifest.json` (validated by `python tools/validate_issue_manifest.py`). This audit changes no layouts, art, puzzles, canon or approved assets, and invents no content. It builds on the architecture audit in PR #30.

## HQ update 2026-11-06 (Directive UP-004)

- **Pages 2–3:** visual direction accepted provisionally (spacing, colour, density, presentation). Not final artwork, not print approval. PR #33 at `a418eab`.
- **Page 1:** reconstruction deferred. The benchmark PNG stays locked; the editable-source fidelity gap below is documented, not resolved by redesign.
- **Page 4:** prototype built (PR #34); copy selection proposed and awaiting HQ approval.
- **Page plan:** all 10 pages assigned (see matrix).
- **Next:** HQ approval of the Page 4 selection; then Pages 5, 6, 7 and 10 in the same system.

## Page-by-page matrix (10 pages)

| Page | Department | Status | Source layout | Content | Artwork | Outstanding |
|---|---|---|---|---|---|---|
| 1 | Front Page | PARTIAL | SVG master + `build_page_one.py` and locked benchmark PNG (`07d4e833…`), only in draft PRs #13/#14 (PNG also #15) | Embedded in the builder; populated | Waterfront halftone placed | Not on main. **The SVG master does not match the benchmark** (title clipped at the right edge, lead headline overlaps the Crust Bucket box), so the approved Page One has no usable editable source. Benchmark is 1009x1559 px (about 92 ppi at 11x17 in): proof grade, not print grade. |
| 2 | City Beat | PARTIAL | HTML master + `press_pages.py`/`build_pages_2_3.py`, PR #33 (supersedes #13/#14 SVGs) | `COPY.md` populated | Fog study placed as lead (study, not final) | **Direction accepted provisionally (UP-004).** Not on main; formatting issues listed in #33. |
| 3 | Crime & Neighborhood Watch | PARTIAL | HTML master, PR #33 | `COPY.md` populated | Vector placeholders (evidence board, corridor map, props) | **Direction accepted provisionally (UP-004).** Not on main; underfilled modules noted in #33. |
| 4 | Editorial & Opinion | PARTIAL | HTML master + `press_page4.py`/`build_page_4.py`, PR #34 | Proposed selection of 11 inventory items (`editorial/SELECTION.json`), **pending HQ approval** | Seagullotine figure (approved component); fog/lantern panel placeholder | Selection approval; lead dek (none in inventory). Not on main. |
| 5 | Arts, Music & Entertainment | MISSING | none | none selected | none | Assigned by HQ (UP-002/UP-004); layout and selection needed |
| 6 | Business & Neighborhood Life | MISSING | none | none selected (business spotlights inventory exists) | none | Assigned by HQ (UP-002/UP-004); layout and selection needed |
| 7 | Community & Classifieds | MISSING | drop-zone templates only | Inventories exist (50 classifieds, 50 calendar, 20 letters, 20 polls, 4 spotlights, 20 ad copies), none selected | Tony's classified master on main | Layout and selection needed |
| 8-9 | Puzzle Dojo | READY | v1 production-linked spread on main, composition and templates; validators pass | Four puzzles present and hash-locked | Tony's, Sewer Cap, Seagullotine placed | READY = source-complete, not visually or print approved. See below. |
| 10 | Back Page — Sewer Cap & Community Features | MISSING | none | none selected | Sewer Cap component exists | Assigned by HQ (UP-002/UP-004); layout and selection needed |

Count (2026-11-06): 2 pages READY (8-9), 4 PARTIAL (1-4), 4 MISSING (5, 6, 7, 10).

**Page plan (HQ-approved, UP-002 confirmed in UP-004):** 1 Front Page · 2 City Beat · 3 Crime & Neighborhood Watch · 4 Editorial & Opinion · 5 Arts, Music & Entertainment · 6 Business & Neighborhood Life · 7 Community & Classifieds · 8–9 Puzzle Dojo · 10 Back Page — Sewer Cap & Community Features.

## Blockers vs polish

**Genuine blockers to a first complete PDF proof**
1. ~~No page plan for pages 5, 6 and 10~~ Resolved: HQ assigned them (UP-002/UP-004).
2. No layouts for pages 4 and 7 (and 5, 6, 10 once assigned).
3. Pages 1-3 live only in draft PRs; #13 and #14 diverged from `main` (10 ahead / 3 behind and 9 ahead / 3 behind), and #13 has the art-style-lock commits that #14 lacks, while #14 has the page contract and press system. They must be reconciled and landed.
4. Pages 2 and 3 lack dominant art and the density the page contract requires.
5. No issue build command assembles more than the Puzzle Dojo spread; no 10-page PDF exists.

**Not blockers for a v0.1 proof (defer)**
- Golden-skin and v2 puzzle fonts for Puzzle Dojo (PRs #25/#27, awaiting HQ).
- Snapper's Market regeneration (the approved lobster ad fills its slot; Issue 1 uses The Crust Bucket, Tony's Donuts and the Deez Bait coupon).
- Pizza Cipher generator (PR #29) and the Puzzle Grinder (PR #18).
- Rotation ad library expansion, vendor print specs, automated preflight.

**Needed before a print-ready claim (not before a proof)**
- Print-resolution Page One master; answer keys for the crossword, sudoku and Pizza Cipher (Issue 2 must print them; only Neighborhood Search has answer data); physical proof inspection.

## Validation results (2026-11-03)

| Check | Result |
|---|---|
| `main`: `tools/validate_repo.py`, `validate_editorial_inventory.py`, `validate_puzzle_dojo.py` | pass (19 puzzle zones, 5 immutable puzzle sources, inventories OK) |
| `main`: unit tests | 9 pass |
| `tools/validate_issue_manifest.py` (new) | pass: 9 entries, 1 READY / 3 PARTIAL / 5 MISSING, BLOCKED |
| Draft #13: repo, City Beat and Page 3 validators | pass |
| Draft #14: repo validator and 6 unit tests | pass (`validate_issue_page.py` needs a page manifest, none exists) |
| Page One benchmark hash | `07d4e833…43691` confirmed on all three branches |
| Complete 10-page build or PDF | **does not exist** |

## Smallest task list to the first complete PDF proof

1. ~~**HQ:** assign departments for pages 5, 6 and 10~~ Done (UP-002/UP-004).
2. **Reconcile and land Pages 1-3:** merge #13 and #14 sources into one reviewed PR against current `main` (page SVGs, builders, copy, benchmark, page contract). Do not modify the locked Page One PNG.
3. **Select content** from the existing inventories for pages 4, 7 and any new pages (HQ approves the selection; no new copy).
4. **Build layouts** for those pages from the approved drop-zone templates and page contract; place existing art (Seagullotine panels, ads, Sewer Cap).
5. **Place dominant art** on pages 2 and 3 (the Page 2 fog study is the approved direction, not final art).
6. **Add an issue build command** driven by `issue_001_manifest.json` that renders all 10 pages to one PDF without overwriting sources; extend the validator to require every page READY.
7. **Print and inspect a physical proof;** log defects in GitHub.

Tasks 2 to 6 can start as soon as task 1 is answered. Until pages 5, 6 and 10 are defined, a "complete" 10-page proof cannot honestly exist.

## Prototype checklist (repository-verified)

- [ ] All 10 pages have identified source layouts (3 pages partially, 5 missing)
- [ ] Every required content field is populated
- [ ] Approved artwork and advertisements are placed
- [x] Puzzle Dojo is complete and verified (source-level; answer keys and visual approval pending)
- [x] Repository validation passes
- [ ] A reproducible 10-page PDF proof exists

Score: 2 of 6.
