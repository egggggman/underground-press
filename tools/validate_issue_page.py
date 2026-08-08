#!/usr/bin/env python3
"""Validate an Underground Press page production manifest."""
from __future__ import annotations
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CONTRACT=json.loads((ROOT/"design-system/issue-production-v1/page_contract.json").read_text(encoding="utf-8"))
def main(argv=None):
 p=argparse.ArgumentParser(); p.add_argument("manifest",type=Path); a=p.parse_args(argv); path=a.manifest if a.manifest.is_absolute() else ROOT/a.manifest
 data=json.loads(path.read_text(encoding="utf-8")); errors=[]; roles=set(data.get("roles",[]))
 for role in CONTRACT["required_roles"]:
  if role not in roles: errors.append(f"missing role: {role}")
 if len(data.get("modules",[]))<CONTRACT["minimum_distinct_modules"]: errors.append("too few distinct modules")
 if len(data.get("spot_objects",[]))<CONTRACT["minimum_spot_objects"]: errors.append("too few spot objects")
 if len(set(data.get("typographic_scales",[])))<CONTRACT["minimum_typographic_scales"]: errors.append("too few typographic scales")
 if data.get("safe_area_occupancy",0)<CONTRACT["minimum_safe_area_occupancy"]: errors.append("safe-area occupancy below contract")
 if data.get("maximum_empty_region_ratio",1)>CONTRACT["maximum_empty_region_ratio"]: errors.append("empty region exceeds contract")
 if data.get("motto")!=CONTRACT["motto"]: errors.append("motto mismatch")
 benchmark=ROOT/"issues/issue_001/production/page-one/issue_001_page_one_polished_press_v3.png"
 if hashlib.sha256(benchmark.read_bytes()).hexdigest()!=CONTRACT["benchmark_sha256"]: errors.append("Page One benchmark hash mismatch")
 for relative in data.get("tracked_assets",[]):
  if not (ROOT/relative).is_file(): errors.append(f"missing tracked asset: {relative}")
 if errors: print("Issue page validation failed:\n- "+"\n- ".join(errors)); return 1
 print(f"Issue page contract passed: {path.relative_to(ROOT)}"); return 0
if __name__=="__main__": raise SystemExit(main())
