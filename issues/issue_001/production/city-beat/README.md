# Issue 001 City Beat production

Page 2 is a fictional-world local-news page for the fog-season Issue 001.
Operational details are Underground Press desk reporting for the invented
neighborhood above and below Portland; they are not real-world public guidance.

Build the editable SVG master and review proofs with:

```text
python scripts/build_city_beat.py
```

The build produces:

- `issue_001_page_2_city_beat.svg` — editable production master;
- `output/pdf/issue_001_page_2_city_beat_proof.pdf` — print proof;
- `output/png/issue_001_page_2_city_beat_proof.png` — review image.

Visual QA uses both the publication-wide Golden Image and the locked Page One
benchmark (SHA-256
`07d4e8332880a23b947d49ea4ea813ae558f4ada220529d63e5d37cd5bc43691`).

