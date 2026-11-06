# Issue 001 Page 4 — Editorial & Opinion: proposed copy selection

**Status: PROPOSED, pending HQ approval (UP-004).** Every item below is existing `approved-inventory` copy, printed verbatim by ID from `content/*/inventory.json`. Nothing is rewritten; the page adds layout labels only. Machine-readable selection: `SELECTION.json`. Check: `python tools/validate_page_4_selection.py`.

| Slot | ID | Headline | Byline | Why |
|---|---|---|---|---|
| Lead editorial (dominant) | EDT-003 | Fog Requires Manners | The Editorial Board | Responds to the issue's news: the Page 2 fog lead and the fog-limited sightlines on Page 3. An editorial page should answer the week. |
| Pull quote + art caption | EDT-003 | (sentences 1–2; sentence 3) | — | Drawn from the lead, verbatim. |
| Board editorial | EDT-001 | The Useful Inch | The Editorial Board | First-issue statement of what the paper is for. |
| Board editorial | EDT-005 | Corrections Are Part of the Record | The Editorial Board | Sets the paper's correction standard alongside Page 3's "resemblance is not certainty" reporting. |
| The Seagullotine | EDT-004 | The Seagullotine: Crumb Policy | The Seagullotine | Humor column; pairs with LTR-007. |
| Letter | LTR-001 | Fog Is Not a Shortcut | M. Dyer | Fog thread. |
| Letter | LTR-015 | A Bench for Waiting | Helen R. | Transit thread (Page 2 Transit Watch). |
| Letter | LTR-020 | Leave One Light | Night walker | Echoes "leave a light" in the lead. |
| Letter | LTR-018 | Storm-Day Neighbors | L. Green | Neighborhood-as-protagonist. |
| Letter | LTR-007 | Let the Gulls Lose | P. Ames | Discovery: a reader letter arguing with the Seagullotine's own column. |
| Reader poll | POL-010 | Is a bicycle bell polite, necessary, or both? | — | Ties the fog/bell thread to reader participation. |
| Discovery band | LTR-007 | "LET THE GULLS LOSE." | — | Headline of the letter, verbatim. |

## Deliberately not selected
- **LTR-011, LTR-013, LTR-016** refer to earlier issues (a prior bell complaint, a past forecast, a past correction). Issue 001 has no earlier issues.
- **LTR-004** implies a long-time reader of the paper; same continuity problem.
- **Corrections inventory**: Issue 001 has nothing to correct.

## Open items for HQ
1. Approve or swap any slot above (e.g. EDT-001 as the lead if HQ prefers a founding-mission lead over a news-responsive one).
2. Letters carry the inventory note "identity and factual claims require issue-level verification before publication": bylines are inventory placeholders until verified.
3. POL-010's `response_window` and `sample_size` are unfilled template fields (`{{open_date}}`, `{{close_date}}`); they are omitted from the ballot rather than invented.
4. The page contract asks for a lead **dek**; editorial inventory items have none, so the page has none. HQ can approve one or waive the role for opinion pages.
