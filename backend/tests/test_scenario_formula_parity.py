"""The scenario constants and the product must use the same t_min formula.

`bench`'s verifier scores against `tests/hard_scenario_01/constants.py`, while the
product computes the minimum thickness in `app.services.findings`. Nothing tied
them together, so a change to one would silently invalidate the other's scores.
This pins them for the fixture geometry.
"""

import importlib.util
from pathlib import Path

from app.schemas.findings import FindingsObject, TankGeometry
from app.services.findings import minimal_thickness_mm

ROOT = Path(__file__).resolve().parents[2]
_SPEC = importlib.util.spec_from_file_location(
    "hs01_constants", ROOT / "tests" / "hard_scenario_01" / "constants.py"
)
assert _SPEC is not None and _SPEC.loader is not None
C = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(C)


def test_scenario_formula_matches_product_formula():
    findings = FindingsObject(
        geometry=TankGeometry(
            diameter_m=C.TANK["diameter_m"],
            fill_height_m=C.TANK["fill_height_m"],
            specific_gravity=C.TANK["specific_gravity"],
            allowable_stress_mpa=C.TANK["allowable_stress_mpa"],
            joint_efficiency=C.TANK["joint_efficiency"],
        )
    )
    assert minimal_thickness_mm(findings) == C.T_MIN_MM
