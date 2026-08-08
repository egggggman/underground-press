"""Shared editorial inventory contract and validation helpers."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

COLLECTION_TARGETS = {
    "classifieds": 50,
    "advertisements": 20,
    "letters": 20,
    "corrections": 15,
    "community_calendar": 50,
    "weather": 30,
    "polls": 20,
    "transit_watch": 30,
    "business_spotlights": 4,
    "editorials": 10,
}
REQUIRED_FIELDS = {
    "id", "type", "department", "category", "season", "district",
    "related_business", "canon_impact", "callback", "status",
}
SEASONS = {"evergreen", "spring", "summer", "autumn", "winter"}
BUSINESSES = {"The Crust Bucket", "Quality Shop", "Great Lost Bear", "Tony's Donuts"}


def read_json(path: Path) -> Any:
    """Read JSON with a stable, path-aware validation error."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{path}: cannot read JSON: {error}") from error


def validate_inventories(root: Path) -> dict[str, Any]:
    errors: list[str] = []
    seen: set[str] = set()
    counts: dict[str, int] = {}
    rows_by_collection: dict[str, list[Mapping[str, Any]]] = {}

    for collection, target in COLLECTION_TARGETS.items():
        path = root / "content" / collection / "inventory.json"
        try:
            data = read_json(path)
        except ValueError as error:
            errors.append(str(error))
            continue
        if not isinstance(data, list):
            errors.append(f"{collection}: inventory root must be a JSON array")
            continue
        counts[collection] = len(data)
        if len(data) != target:
            errors.append(f"{collection}: expected {target}, found {len(data)}")
        valid_rows: list[Mapping[str, Any]] = []
        for index, row in enumerate(data, 1):
            label = f"{collection}[{index}]"
            if not isinstance(row, Mapping):
                errors.append(f"{label}: entry must be a JSON object")
                continue
            valid_rows.append(row)
            missing = REQUIRED_FIELDS - row.keys()
            if missing:
                errors.append(f"{label}: missing {sorted(missing)}")
            item_id = row.get("id")
            if not isinstance(item_id, str) or not item_id.strip():
                errors.append(f"{label}: id must be a non-empty string")
                item_id = label
            elif item_id in seen:
                errors.append(f"duplicate id: {item_id}")
            else:
                seen.add(item_id)
            if row.get("season") not in SEASONS:
                errors.append(f"{item_id}: invalid season")
            if row.get("canon_impact") != "none":
                errors.append(f"{item_id}: inventory may not establish canon")
            if row.get("status") != "approved-inventory":
                errors.append(f"{item_id}: invalid status")
            if row.get("related_business") not in BUSINESSES | {None}:
                errors.append(f"{item_id}: unknown business")
            if row.get("callback") is not False:
                errors.append(f"{item_id}: callbacks require editorial approval")
            copy_values = (
                value for key, value in row.items() if key not in REQUIRED_FIELDS
            )
            if not any(isinstance(value, str) and len(value.strip()) >= 20 for value in copy_values):
                errors.append(f"{item_id}: no substantive copy field")
        rows_by_collection[collection] = valid_rows

    spotlight_businesses = {
        row.get("related_business")
        for row in rows_by_collection.get("business_spotlights", [])
    }
    if spotlight_businesses != BUSINESSES:
        errors.append(
            f"spotlights: expected {sorted(BUSINESSES)}, "
            f"found {sorted(str(value) for value in spotlight_businesses)}"
        )
    return {
        "counts": counts,
        "total": sum(counts.values()),
        "unique_ids": len(seen),
        "errors": errors,
    }


def serialized_inventory(rows: Sequence[Mapping[str, Any]]) -> str:
    return json.dumps(rows, indent=2, ensure_ascii=False) + "\n"
