import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {"classifieds":50,"advertisements":20,"letters":20,"corrections":15,"community_calendar":50,"weather":30,"polls":20,"transit_watch":30,"business_spotlights":4,"editorials":10}
REQUIRED = {"id","type","department","category","season","district","related_business","canon_impact","callback","status"}
SEASONS = {"evergreen","spring","summer","autumn","winter"}
BUSINESSES = {"The Crust Bucket","Quality Shop","Great Lost Bear","Tony's Donuts"}

errors=[]; seen=set(); counts={}
for collection,target in TARGETS.items():
    path=ROOT/"content"/collection/"inventory.json"
    try: rows=json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{collection}: cannot read inventory: {exc}"); continue
    counts[collection]=len(rows)
    if len(rows)!=target: errors.append(f"{collection}: expected {target}, found {len(rows)}")
    for index,row in enumerate(rows,1):
        missing=REQUIRED-set(row)
        if missing: errors.append(f"{collection}[{index}]: missing {sorted(missing)}")
        id_=row.get("id")
        if id_ in seen: errors.append(f"duplicate id: {id_}")
        seen.add(id_)
        if row.get("season") not in SEASONS: errors.append(f"{id_}: invalid season")
        if row.get("canon_impact") != "none": errors.append(f"{id_}: inventory may not establish canon")
        if row.get("status") != "approved-inventory": errors.append(f"{id_}: invalid status")
        if row.get("related_business") not in BUSINESSES|{None}: errors.append(f"{id_}: unknown business")
        if row.get("callback") is not False: errors.append(f"{id_}: callbacks require editorial approval")
        if not any(isinstance(v,str) and len(v.strip())>=20 for k,v in row.items() if k not in REQUIRED): errors.append(f"{id_}: no substantive copy field")
spotlight_biz={r["related_business"] for r in json.loads((ROOT/"content/business_spotlights/inventory.json").read_text(encoding="utf-8"))}
if spotlight_biz != BUSINESSES: errors.append(f"spotlights: expected {sorted(BUSINESSES)}, found {sorted(spotlight_biz)}")
print(json.dumps({"counts":counts,"total":sum(counts.values()),"unique_ids":len(seen),"errors":errors},indent=2))
sys.exit(bool(errors))
