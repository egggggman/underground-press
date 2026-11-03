# Approved advertising art library

Approved PNG ad art for The Underground Press, imported from the 2026-11-02 advertising handoff (`handoff_2026-11-02/`).

- `approved/` holds the 12 approved assets from the first handoff, byte-for-byte as handed over, plus five derived crops from the five-ad sheet (see below). Never edit, redraw, recolour, reword or stretch them. Resize proportionally; crop only with editorial approval.
- `previous_versions/` is provenance only (superseded iterations). Never production art.
- `ad_library.json` is the machine-readable record: business, status, file, dimensions, SHA-256, the lettering the art contains, canon note, previous versions, and approval state.
- `handoff_2026-11-02/` keeps the original README, ASSET_MANIFEST.csv and CLAUDE_HANDOFF.md.

Check integrity any time: `python tools/verify_ad_library.py`.

## Approval is separate

Artwork approval is not canon approval, publication approval or print proofing (see each ad's `approvals` in `ad_library.json`). Which ads run in an issue is set by an assignments file, not by this library: `templates/puzzle-dojo/golden-skin/ad_assignments.issue_NNN.json`, whose `pool` lists every ad available for rotation.

## Open editorial items

- **Quality Cuts and Quality Shop (HOLD):** a partnership and a Shamos-sibling barber are an editorial idea only. HQ has not approved the identities or relationship, so nothing is recorded as fact and `world/businesses/FLAGSHIP_BUSINESSES.md` is unchanged.
- **Gull & Ladle wording (resolved):** HQ kept the approved image as is: "HOME OF THE $1.00 WHOOPIE / AND THE BEST SOUP DU JOUR!". The handoff README paraphrase is superseded.
- **Not in canon docs:** every business except The Crust Bucket and Tony's Donuts is an advertising concept only.
- **Illustration-only art:** Tony's Donuts and Myrtle St. Suds contain no lettering; the slot adds the business name only.
- **Deez Bait coupon:** perforations are drawn, not physical; print needs guidance.
- **Style references:** the three style reference images in the handoff are not byte-identical to the copies already in this repo. Nothing was replaced.

## Five-ad sheet (second handoff, rotation only)

`approved_sheets/five_new_ads_approved_sheet.png` is the original approved composition, kept byte-for-byte as the creative source of truth (hashes in `handoff_2026-11-02_five_new/ASSET_MANIFEST.csv`). The five crops in `approved/` are exact pixel slices of it (`derived_from.origin_px` in `ad_library.json`): Portland Pipe & Drain Co., Coastal Byte Computers, Maine Comics & Collectibles, The Snapper's Market, Brine & Grinder Records. They are in the Issue 1 rotation pool only; none is placed in Issue 1.

Review notes before any placement (nothing was edited):
- **Crop edges:** the sheet's panels sit a few pixels apart, so every crop carries a sliver of a neighbour or the dark gutter. The three bottom-row crops (Maine Comics, Snapper's, Brine & Grinder) show the top row's lower plaque edge along their top, and Snapper's and Brine & Grinder show slivers of the adjacent panel at the sides. Slots that fit art to a matte will show these. Fix by an editorially approved tighter crop or a clean regeneration, not by editing the sheet.
- **Resolution:** crops are 497-762 px wide (about 60-100 dpi at the slot sizes used for the large ad). Fine for proofing; likely soft in print, so a higher-resolution master is needed.
- **Typography:** The Snapper's Market's "M" in "Market" is clipped by a scratch/overlap in the original art, and "The" overlaps the checker border. Spelling in the manifest is "Snapper’s" with a curly apostrophe; the art uses a straight one. Portland Pipe & Drain's "Portland" script sits tight to the top rim.
- **IP flavour:** the Portland Pipe & Drain turtle mascot, Coastal Byte's turtle-shell screen and Maine Comics' purple masked ninja plus a "TURTLES" comic cover are TMNT references. That is on-theme for this fan project but HQ may want to review it before publication.
- **Canon:** none of the five is in the business bible; placement needs a separate editorial decision.

## Checkpoint revisions (HQ 2026-11-02, proposals pending approval)

- `approved_v2/`: tight crops of the five-ad sheet (plaque bounding box, exact pixel slices). The v1 crops in `approved/` stay as historical evidence. The v1 Portland crop had cut ~25 px off the plaque's right edge, and the v1 Coastal Byte crop carried that strip; both are fixed in v2.
- `revisions/snappers-market-v3-lettering.png`: separate artwork revision made by `tools/repair_snappers_lettering.py`. It is a conservative cleanup (the M's smeared left stroke recoloured to ink, haze removed, crowding border squares cleared), not a redrawn letterform, so it is **not approved** and print needs a clean master.
- `PRINT_RESOLUTION.md`: minimum masters from the real slot sizes. Print approval stays blocked; none of the five is print-ready.

## Candidates (not approved)

`candidates/snappers-market-alt-turtle.png` is HQ's regenerated Snapper's Market, kept as an **alternate concept**, not a replacement. It fixes the lettering and border overlap but changes the character (red-masked turtle instead of the two lobsters), the copy and the composition, and still has a dark band along its top edge. The approved lobster ad is unchanged. Details and open issues: `candidates` in `ad_library.json`.
