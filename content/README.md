# Editorial Content Library

This directory holds reusable, issue-ready editorial material. Each collection has its own standards. Drafts must respect `docs/CANON.md`, `docs/EDITORIAL_PHILOSOPHY.md`, and the World Bible; publication makes continuity durable only through the canon process.

Keep source copy editable, identify its intended issue when known, and never use this library to overwrite approved page artwork or puzzle data.

## Inventory metadata

Production inventory files use JSON arrays. Every entry includes `id`, `type`, `department`, `category`, `season`, `district`, `related_business`, `canon_impact`, `callback`, and `status`. A `null` district or related business means the item is not tied to one. Inventory content uses `canon_impact: "none"`; durable facts still require the canon approval process.

Run `python tools/validate_editorial_inventory.py` before publication work to verify counts, ID uniqueness, shared metadata, and flagship spotlight coverage.
