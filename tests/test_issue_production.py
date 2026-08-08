import importlib.util,json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

class IssueProductionTests(unittest.TestCase):
    def test_contract_names_every_required_visual_role(self):
        data=json.loads((ROOT/"design-system/issue-production-v1/page_contract.json").read_text(encoding="utf-8"))
        self.assertEqual(data["version"],1)
        self.assertIn("dominant-art",data["required_roles"])
        self.assertIn("discovery",data["required_roles"])
        self.assertGreaterEqual(data["minimum_safe_area_occupancy"],.8)

    def test_press_primitives_import_without_writing(self):
        before={p for p in ROOT.rglob("*") if p.is_file() and "__pycache__" not in p.parts}
        spec=importlib.util.spec_from_file_location("newspaper_press",ROOT/"scripts/newspaper_press.py")
        module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        after={p for p in ROOT.rglob("*") if p.is_file() and "__pycache__" not in p.parts}
        self.assertEqual(before,after)
        self.assertEqual(module.PAPER,"#eadcae")

if __name__=="__main__": unittest.main()
