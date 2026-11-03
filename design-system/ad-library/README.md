# Approved advertising art library

Approved PNG ad art for The Underground Press, imported from the 2026-11-02 advertising handoff (`handoff_2026-11-02/`).

- `approved/` holds the 12 approved assets, byte-for-byte as handed over. Never edit, redraw, recolour, reword or stretch them. Resize proportionally; crop only with editorial approval.
- `previous_versions/` is provenance only (superseded iterations). Never production art.
- `ad_library.json` is the machine-readable record: business, status, file, dimensions, SHA-256, the lettering the art contains, canon note, previous versions, and approval state.
- `handoff_2026-11-02/` keeps the original README, ASSET_MANIFEST.csv and CLAUDE_HANDOFF.md.

Check integrity any time: `python tools/verify_ad_library.py`.

## Approval is separate

Artwork approval is not canon approval, publication approval or print proofing (see each ad's `approvals` in `ad_library.json`). Which ads run in an issue is set by an assignments file, not by this library: `templates/puzzle-dojo/golden-skin/ad_assignments.issue_NNN.json`, whose `pool` lists every ad available for rotation.

## Open editorial items

- **Quality Cuts and Quality Shop (resolved in conversation, not yet in canon docs):** the barbershop is partnered with the Quality Shop; the two are run by a brother and sister who are twins. `world/businesses/FLAGSHIP_BUSINESSES.md` does not record this yet.
- **Gull & Ladle wording:** the handoff README gives "Home of the $1 Whoopie" / "Best Soup du Jour"; the approved image reads "HOME OF THE $1.00 WHOOPIE" / "AND THE BEST SOUP DU JOUR!".
- **Not in canon docs:** every business except The Crust Bucket and Tony's Donuts is an advertising concept only.
- **Illustration-only art:** Tony's Donuts and Myrtle St. Suds contain no lettering; the slot adds the business name only.
- **Deez Bait coupon:** perforations are drawn, not physical; print needs guidance.
- **Style references:** the three style reference images in the handoff are not byte-identical to the copies already in this repo. Nothing was replaced.
